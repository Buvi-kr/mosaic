const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

class MosaicQueue {
  constructor() {
    this.queue = [];
    this.activeWorkers = 0;
    // CPU 코어 수의 절반 정도를 최대 병렬 처리 워커 수로 제한 (시스템 뻗음 방지)
    this.maxWorkers = Math.max(1, Math.floor(os.cpus().length / 2));
  }

  // 작업을 큐에 추가
  addJob(jobData) {
    return new Promise((resolve, reject) => {
      this.queue.push({ jobData, resolve, reject });
      this.processNext();
    });
  }

  processNext() {
    if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
      return;
    }

    const { jobData, resolve, reject } = this.queue.shift();
    this.activeWorkers++;

    const workerPath = path.join(__dirname, './matcher.worker.js');
    const worker = new Worker(workerPath, { workerData: jobData });

    worker.on('message', (result) => {
      this.activeWorkers--;
      if (result.success) {
        resolve(result);
      } else {
        reject(new Error(result.error));
      }
      this.processNext(); // 다음 작업 실행
    });

    worker.on('error', (err) => {
      this.activeWorkers--;
      reject(err);
      this.processNext();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.activeWorkers--;
        reject(new Error(`Worker stopped with exit code ${code}`));
        this.processNext();
      }
    });
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxWorkers
    };
  }
}

module.exports = new MosaicQueue();
