const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const configModule = require('./config');

class MosaicQueue {
  constructor() {
    this.queue = [];           // 대기 중인 작업 [{jobData, resolve, reject, jobId, onProgress}]
    this.workers = [];         // 고정 워커 풀
    this.workerBusy = [];      // 각 워커의 사용 중 여부
    this.pendingJobs = new Map(); // jobId → {resolve, reject, onProgress, workerIndex}
    this.jobCounter = 0;
    this.poolSize = 0;
    this.initialized = false;

    // EMA 기반 처리 시간 추적
    this.emaProcessTime = 5.0; // 초기값 5초 (보수적 추정)
    this.emaAlpha = 0.2;       // 지수이동평균 가중치

    // tileDB 버전 관리
    this.tileDBVersion = 0;
    this.currentTileDB = null;
    this.currentKDTree = null;
    this.currentConfig = null;

    // 상태 변경 콜백 (디스플레이 상태 머신용)
    this.onStateChange = null;
  }

  /**
   * 워커 풀 초기화
   */
  initPool(tileDB, kdTree) {
    const config = configModule.getConfig();
    this.poolSize = config.workerPoolSize > 0
      ? config.workerPoolSize
      : Math.max(1, Math.floor(os.cpus().length / 2));

    this.currentTileDB = tileDB;
    this.currentKDTree = kdTree;
    this.currentConfig = config;
    this.tileDBVersion++;

    // 기존 워커가 있으면 안전하게 종료
    this.destroyPool();

    console.log(`[워커 풀] 고정 워커 풀 초기화: ${this.poolSize}개 워커`);

    const workerPath = path.join(__dirname, './matcher.worker.js');

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(workerPath, {
        workerData: {
          config: this.currentConfig,
          globalTileDB: this.currentTileDB,
          kdTree: this.currentKDTree,
          tileDBVersion: this.tileDBVersion,
        }
      });

      worker.on('message', (result) => {
        this.handleWorkerMessage(i, result);
      });

      worker.on('error', (err) => {
        console.error(`[워커 풀] 워커 #${i} 에러:`, err.message);
        this.handleWorkerError(i, err);
      });

      worker.on('exit', (code) => {
        if (code !== 0 && this.initialized) {
          console.warn(`[워커 풀] 워커 #${i} 비정상 종료 (code: ${code}), 재생성 중...`);
          this.respawnWorker(i);
        }
      });

      this.workers.push(worker);
      this.workerBusy.push(false);
    }

    this.initialized = true;
  }

  /**
   * 워커 풀 안전 종료
   */
  destroyPool() {
    this.initialized = false;
    for (const worker of this.workers) {
      try { worker.terminate(); } catch (e) {}
    }
    this.workers = [];
    this.workerBusy = [];
  }

  /**
   * 비정상 종료된 워커 재생성
   */
  respawnWorker(index) {
    const workerPath = path.join(__dirname, './matcher.worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        config: this.currentConfig,
        globalTileDB: this.currentTileDB,
        kdTree: this.currentKDTree,
        tileDBVersion: this.tileDBVersion,
      }
    });

    worker.on('message', (result) => this.handleWorkerMessage(index, result));
    worker.on('error', (err) => this.handleWorkerError(index, err));
    worker.on('exit', (code) => {
      if (code !== 0 && this.initialized) {
        console.warn(`[워커 풀] 워커 #${index} 재생성 후 또 비정상 종료`);
        setTimeout(() => this.respawnWorker(index), 1000);
      }
    });

    this.workers[index] = worker;
    this.workerBusy[index] = false;
    this.processNext();
  }

  /**
   * 워커 메시지 핸들러 (PROGRESS + 완료 결과 모두 처리)
   */
  handleWorkerMessage(workerIndex, result) {
    // PROGRESS 메시지: 워커가 작업 중간에 진행률을 보고함
    if (result.type === 'PROGRESS') {
      const pending = this.pendingJobs.get(result.jobId);
      if (pending && pending.onProgress) {
        pending.onProgress({
          percent: result.percent,
          phase: result.phase,
          detail: result.detail
        });
      }
      return; // PROGRESS는 작업 완료가 아니므로 워커를 해제하지 않음
    }

    // 작업 완료 메시지
    this.workerBusy[workerIndex] = false;

    const { jobId } = result;
    const pending = this.pendingJobs.get(jobId);

    if (pending) {
      this.pendingJobs.delete(jobId);
      if (result.success) {
        // EMA 처리 시간 업데이트
        if (pending.startTime) {
          const elapsed = (Date.now() - pending.startTime) / 1000;
          this.emaProcessTime = this.emaAlpha * elapsed + (1 - this.emaAlpha) * this.emaProcessTime;
        }
        pending.resolve(result);
      } else {
        pending.reject(new Error(result.error));
      }
    }

    // 상태 변경 알림
    this._notifyStateChange();

    this.processNext();
  }

  /**
   * 워커 에러 핸들러
   */
  handleWorkerError(workerIndex, err) {
    this.workerBusy[workerIndex] = false;

    // 현재 이 워커에 할당된 작업이 있으면 reject
    for (const [jobId, pending] of this.pendingJobs) {
      if (pending.workerIndex === workerIndex) {
        this.pendingJobs.delete(jobId);
        pending.reject(err);
        break;
      }
    }

    this._notifyStateChange();
    this.processNext();
  }

  /**
   * 작업을 큐에 추가 (progress 콜백 지원)
   * @param {Object} jobData - 워커에 전달할 작업 데이터
   * @param {Function} onProgress - 진행률 콜백 ({percent, phase, detail})
   */
  addJob(jobData, onProgress) {
    return new Promise((resolve, reject) => {
      const jobId = ++this.jobCounter;

      // 레거시 호환: 아직 풀이 초기화되지 않은 경우 요청별 워커 생성
      if (!this.initialized) {
        return this.addJobLegacy(jobData, resolve, reject);
      }

      this.queue.push({
        jobData,
        resolve,
        reject,
        jobId,
        startTime: Date.now(),
        onProgress: onProgress || null,
      });

      // 상태 변경 알림
      this._notifyStateChange();

      this.processNext();
    });
  }

  /**
   * 레거시 모드: 요청별 워커 생성 (풀 초기화 전 호환용)
   */
  addJobLegacy(jobData, resolve, reject) {
    const workerPath = path.join(__dirname, './matcher.worker.js');
    const worker = new Worker(workerPath, { workerData: jobData });

    worker.on('message', (result) => {
      if (result.success) {
        resolve(result);
      } else {
        reject(new Error(result.error));
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  }

  /**
   * 큐에서 다음 작업 꺼내서 유휴 워커에 배정
   */
  processNext() {
    if (this.queue.length === 0) return;

    // 유휴 워커 찾기
    const freeIndex = this.workerBusy.indexOf(false);
    if (freeIndex === -1) return; // 모든 워커 사용 중

    const job = this.queue.shift();
    this.workerBusy[freeIndex] = true;

    // pending에 워커 인덱스 및 progress 콜백 기록
    this.pendingJobs.set(job.jobId, {
      resolve: job.resolve,
      reject: job.reject,
      workerIndex: freeIndex,
      startTime: job.startTime,
      onProgress: job.onProgress,
    });

    // 워커에 작업 전송 (globalTileDB는 이미 워커 내부에 있으므로 보내지 않음)
    const { globalTileDB, kdTree, ...lightJobData } = job.jobData;
    this.workers[freeIndex].postMessage({
      type: 'PROCESS',
      jobId: job.jobId,
      jobData: lightJobData,
    });

    // 상태 변경 알림
    this._notifyStateChange();
  }

  /**
   * 전체 워커에 tileDB/config 업데이트 브로드캐스트
   */
  broadcastTileDBUpdate(tileDB, kdTree) {
    this.currentTileDB = tileDB;
    this.currentKDTree = kdTree;
    this.tileDBVersion++;

    for (const worker of this.workers) {
      try {
        worker.postMessage({
          type: 'TILEDB_UPDATE',
          tileDB,
          kdTree,
          version: this.tileDBVersion,
        });
      } catch (e) {
        console.error('[워커 풀] tileDB 업데이트 브로드캐스트 실패:', e.message);
      }
    }

    console.log(`[워커 풀] tileDB 업데이트 브로드캐스트 완료 (v${this.tileDBVersion}, ${tileDB.length}개 타일)`);
  }

  /**
   * 전체 워커에 config 업데이트 브로드캐스트
   */
  broadcastConfigUpdate(config) {
    this.currentConfig = config;

    for (const worker of this.workers) {
      try {
        worker.postMessage({
          type: 'CONFIG_UPDATE',
          config,
        });
      } catch (e) {
        console.error('[워커 풀] config 업데이트 브로드캐스트 실패:', e.message);
      }
    }
  }

  /**
   * 큐 통계 (EMA 포함)
   */
  getStats() {
    const activeWorkers = this.workerBusy.filter(b => b).length;
    return {
      queueLength: this.queue.length,
      activeWorkers,
      maxWorkers: this.poolSize || Math.max(1, Math.floor(os.cpus().length / 2)),
      poolInitialized: this.initialized,
      tileDBVersion: this.tileDBVersion,
      emaProcessTime: Math.round(this.emaProcessTime * 100) / 100,
    };
  }

  /**
   * 현재 시스템 상태 (디스플레이 상태 머신용)
   */
  getSystemState() {
    const stats = this.getStats();
    const totalBusy = stats.activeWorkers + stats.queueLength;
    const maxSlots = stats.maxWorkers + 2;

    // 다중 접속(큐)을 지원하므로, 단순히 1명이 작업중이라고 QR을 숨기면 안 됨.
    // 수용량 한계치(maxSlots)에 도달했을 때만 'overloaded'를 반환하여 QR을 숨김.
    if (totalBusy >= maxSlots) {
      return 'overloaded';
    }
    
    // 그 외에는 항상 큐가 열려있으므로 'idle' (QR 표시) 상태 유지
    // 개별 유저의 진행 상황은 각자의 모바일 폰에서 확인하므로 사이니지는 계속 접속을 받음.
    return 'idle';
  }

  /**
   * 슬롯 사용 가능 여부 (업로드 입구 제어용)
   */
  canAcceptUpload() {
    const stats = this.getStats();
    const totalBusy = stats.activeWorkers + stats.queueLength;
    const maxSlots = stats.maxWorkers + 1; // 워커 수 + 대기 1명까지 허용
    return {
      available: totalBusy < maxSlots,
      position: totalBusy + 1,
      totalSlots: maxSlots,
      waitTime: this.estimateWaitTime(),
    };
  }

  /**
   * 예상 대기시간 (EMA 기반)
   */
  estimateWaitTime() {
    const stats = this.getStats();
    if (stats.queueLength === 0) return 0;
    const effectiveWorkers = Math.max(1, stats.maxWorkers);
    return Math.ceil(this.emaProcessTime * stats.queueLength / effectiveWorkers);
  }

  /**
   * 상태 변경 알림 (내부 헬퍼)
   */
  _notifyStateChange() {
    if (this.onStateChange) {
      try {
        this.onStateChange(this.getSystemState(), this.getStats());
      } catch (e) {
        // 콜백 에러 무시
      }
    }
  }
}

module.exports = new MosaicQueue();
