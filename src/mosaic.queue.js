const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const configModule = require('./config');

class MosaicQueue {
  constructor() {
    this.queue = [];           // 대기 중인 작업 [{jobData, resolve, reject, jobId}]
    this.workers = [];         // 고정 워커 풀
    this.workerBusy = [];      // 각 워커의 사용 중 여부
    this.pendingJobs = new Map(); // jobId → {resolve, reject}
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
        this.handleWorkerResult(i, result);
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

    worker.on('message', (result) => this.handleWorkerResult(index, result));
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
   * 워커 결과 핸들러
   */
  handleWorkerResult(workerIndex, result) {
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

    this.processNext();
  }

  /**
   * 작업을 큐에 추가
   */
  addJob(jobData) {
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
      });

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

    // pending에 워커 인덱스 기록 (에러 핸들링용)
    this.pendingJobs.set(job.jobId, {
      resolve: job.resolve,
      reject: job.reject,
      workerIndex: freeIndex,
      startTime: job.startTime,
    });

    // 워커에 작업 전송 (globalTileDB는 이미 워커 내부에 있으므로 보내지 않음)
    const { globalTileDB, kdTree, ...lightJobData } = job.jobData;
    this.workers[freeIndex].postMessage({
      type: 'PROCESS',
      jobId: job.jobId,
      jobData: lightJobData,
    });
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
   * 예상 대기시간 (EMA 기반)
   */
  estimateWaitTime() {
    const stats = this.getStats();
    if (stats.queueLength === 0) return 0;
    const effectiveWorkers = Math.max(1, stats.maxWorkers);
    return Math.ceil(this.emaProcessTime * stats.queueLength / effectiveWorkers);
  }
}

module.exports = new MosaicQueue();
