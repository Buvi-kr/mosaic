const { parentPort, workerData } = require('worker_threads');
const convert = require('color-convert').default || require('color-convert');
const KDTree = require('./kdtree');

// ===== 런타임 갱신 가능한 변수들 =====
let currentConfig = workerData.config || {};
let globalTileDB = workerData.globalTileDB;
let kdTree = workerData.kdTree || null;
let tileDBVersion = workerData.tileDBVersion || 0;

// config에서 동적 로드되는 매칭 파라미터
let MAX_USAGE = currentConfig.maxTileUsage || 4;
let RAD = currentConfig.banRadius || 2;
let CANDIDATE_POOL = currentConfig.candidatePoolSize || 150;
const DISTANCE_WEIGHT = 0.3;
const PENALTY_FACTOR = 40.0;

// ===== 런타임 메시지 핸들러 (고정 워커 풀용) =====
if (parentPort) {
  parentPort.on('message', (msg) => {
    if (msg.type === 'CONFIG_UPDATE') {
      currentConfig = msg.config;
      MAX_USAGE = currentConfig.maxTileUsage || 4;
      RAD = currentConfig.banRadius || 2;
      CANDIDATE_POOL = currentConfig.candidatePoolSize || 150;
    } else if (msg.type === 'TILEDB_UPDATE') {
      globalTileDB = msg.tileDB;
      kdTree = msg.kdTree;
      tileDBVersion = msg.version;
    } else if (msg.type === 'PROCESS') {
      // 고정 워커 풀에서 작업 요청이 들어온 경우
      processJob(msg.jobData, msg.jobId);
    }
  });
}

// ===== 매칭 코어 로직 =====
function processJob(jobData, jobId) {
  try {
    const { rawData, info, cols, rows, tileSize } = jobData;
    // 고정 풀 모드에서는 워커 내부의 globalTileDB 사용
    const tileDB = jobData.globalTileDB || globalTileDB;
    const tree = jobData.kdTree || kdTree;
    const version = jobData.tileDBVersion || tileDBVersion;

    const result = runMatching(rawData, info, cols, rows, tileSize, tileDB, tree);

    if (jobId !== undefined) {
      // 고정 풀 모드: jobId와 함께 결과 반환
      parentPort.postMessage({ success: true, jobId, ...result, tileDBVersion: version });
    } else {
      // 레거시 모드: 단순 결과 반환
      parentPort.postMessage({ success: true, ...result });
    }
  } catch (err) {
    if (jobId !== undefined) {
      parentPort.postMessage({ success: false, jobId, error: err.message });
    } else {
      parentPort.postMessage({ success: false, error: err.message });
    }
  }
}

function runMatching(rawData, info, cols, rows, tileSize, tileDB, tree) {
  const matchedTiles = [];
  const pixelData = Buffer.from(rawData);

  // 픽셀 데이터 추출 및 targetLab 사전 계산
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const startX = x * tileSize;
      const startY = y * tileSize;

      let rSum = 0, gSum = 0, bSum = 0, pCount = 0;

      for (let py = startY; py < startY + tileSize; py++) {
        for (let px = startX; px < startX + tileSize; px++) {
          if (px >= info.width || py >= info.height) continue;
          const offset = (py * info.width + px) * info.channels;
          rSum += pixelData[offset];
          gSum += pixelData[offset + 1];
          bSum += pixelData[offset + 2];
          pCount++;
        }
      }

      if (pCount === 0) continue;

      const lab = convert.rgb.lab(rSum / pCount, gSum / pCount, bSum / pCount);
      const targetLab = { l: lab[0], a: lab[1], b: lab[2] };

      cells.push({ startX, startY, targetLab });
    }
  }

  // 배열 랜덤 셔플 (특정 영역 편중 방지)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const usedCounts = new Int32Array(tileDB.length);
  const placedGrid = new Array(rows).fill(null).map(() => new Array(cols).fill(-1));

  const dbSize = tileDB.length;

  // k-d tree 사용 가능 여부 확인
  const useKDTree = tree !== null && tree !== undefined;

  // 랜덤 순서대로 캔버스 모든 칸에 대해 매칭 수행
  for (const cell of cells) {
    const cx = Math.floor(cell.startX / tileSize);
    const cy = Math.floor(cell.startY / tileSize);

    // 1. ban radius 내에 이미 배치된 타일 ID와 Lab 색상 수집
    const bannedTiles = new Set();
    const bannedLabs = [];
    for (let ry = Math.max(0, cy - RAD); ry <= Math.min(rows - 1, cy + RAD); ry++) {
      for (let rx = Math.max(0, cx - RAD); rx <= Math.min(cols - 1, cx + RAD); rx++) {
        const tId = placedGrid[ry][rx];
        if (tId !== -1) {
          bannedTiles.add(tId);
          bannedLabs.push(tileDB[tId].lab);
        }
      }
    }

    const tLab = cell.targetLab;
    let validCandidates = [];
    let fallbackIdx = 0;

    if (currentConfig.turboMode) {
      // ===== 100% 랜덤 터보 모드 (색상 매칭 생략) =====
      const filterFn = (i) => {
        if (usedCounts[i] >= MAX_USAGE) return false;
        if (bannedTiles.has(i)) return false;
        return true;
      };

      // 시도 횟수 제한 (무한루프 방지)
      let found = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const rIdx = Math.floor(Math.random() * dbSize);
        if (filterFn(rIdx)) {
          fallbackIdx = rIdx;
          validCandidates = [{ idx: rIdx, dist: 0 }];
          found = true;
          break;
        }
      }
      if (!found) {
        fallbackIdx = Math.floor(Math.random() * dbSize);
        validCandidates = [{ idx: fallbackIdx, dist: 0 }];
      }

    } else if (useKDTree) {
      // ===== ONE-PASS 매칭: k-d tree 내에서 공간/사용 제약 필터링 =====
      const filterFn = (i) => {
        // 조건 1: 사용 횟수 제한
        if (usedCounts[i] >= MAX_USAGE) return false;

        // 조건 2: ban radius 내 동일 타일 금지
        if (bannedTiles.has(i)) return false;

        // 조건 3: ban radius 내 시각적 유사 타일 금지
        const candLab = tileDB[i].lab;
        for (let b = 0; b < bannedLabs.length; b++) {
          const bl = bannedLabs[b];
          const dl = candLab.l - bl.l;
          const da = candLab.a - bl.a;
          const db = candLab.b - bl.b;
          if (dl * dl + da * da + db * db < 100) {
            return false;
          }
        }
        return true;
      };

      // tree 탐색 중 유효한 후보 60개(기존 조건)를 찾을 때까지 계속 탐색함
      const kNearest = KDTree.kNearest(tree, [tLab.l, tLab.a, tLab.b], 60, filterFn);

      if (kNearest.length > 0) {
        fallbackIdx = kNearest[0].idx;
        validCandidates = kNearest.map(cand => ({ idx: cand.idx, dist: Math.sqrt(cand.distSq) }));
      } else {
        // 필터를 통과하는 타일이 아예 없는 극단적인 경우 강제로 가장 가까운 타일 가져오기 (오류 방지)
        const absoluteNearest = KDTree.kNearest(tree, [tLab.l, tLab.a, tLab.b], 1);
        if (absoluteNearest.length > 0) fallbackIdx = absoluteNearest[0].idx;
      }


    } else {
      // ===== 폴백: 브루트포스 (k-d tree 없는 경우) =====
      const candidateIndices = new Int32Array(dbSize);
      const distancesSq = new Float32Array(dbSize);

      for (let i = 0; i < dbSize; i++) {
        const cLab = tileDB[i].lab;
        distancesSq[i] = (tLab.l - cLab.l)**2 + (tLab.a - cLab.a)**2 + (tLab.b - cLab.b)**2;
        candidateIndices[i] = i;
      }

      candidateIndices.sort((a, b) => distancesSq[a] - distancesSq[b]);
      fallbackIdx = candidateIndices[0];

      for (let j = 0; j < dbSize; j++) {
        const i = candidateIndices[j];

        if (usedCounts[i] >= MAX_USAGE) continue;
        if (bannedTiles.has(i)) continue;

        const candLab = tileDB[i].lab;
        let isVisuallySimilar = false;
        for (let b = 0; b < bannedLabs.length; b++) {
          const bl = bannedLabs[b];
          const dl = candLab.l - bl.l;
          const da = candLab.a - bl.a;
          const db = candLab.b - bl.b;
          if (dl * dl + da * da + db * db < 100) {
            isVisuallySimilar = true;
            break;
          }
        }
        if (isVisuallySimilar) continue;

        validCandidates.push({ idx: i, dist: Math.sqrt(distancesSq[i]) });
        if (validCandidates.length >= 60) break;
      }
    }

    // 3. 점수 계산 — 사용자 공식 보존
    let bestIdx = -1;

    if (validCandidates.length > 0) {
      let bestScore = Infinity;
      for (const cand of validCandidates) {
        const jitter = Math.random() * 5;
        const score = (cand.dist * DISTANCE_WEIGHT) + (usedCounts[cand.idx] * PENALTY_FACTOR) + jitter;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = cand.idx;
        }
      }
    } else {
      bestIdx = fallbackIdx;
    }

    usedCounts[bestIdx]++;
    placedGrid[cy][cx] = bestIdx;
    matchedTiles.push({
      filename: tileDB[bestIdx].filename,
      top: cell.startY,
      left: cell.startX
    });
  }

  return { matchedTiles, remainingTiles: tileDB.length };
}

// ===== 초기 실행 (레거시 모드: 요청별 워커 생성 시) =====
// workerData에 jobData가 직접 들어있는 경우 (기존 mosaic.queue.js 호환)
if (workerData && workerData.rawData) {
  try {
    const { rawData, info, cols, rows, tileSize, globalTileDB: tDB, kdTree: tree } = workerData;
    const result = runMatching(rawData, info, cols, rows, tileSize, tDB, tree);
    parentPort.postMessage({ success: true, ...result });
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
}
