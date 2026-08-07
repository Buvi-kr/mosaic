const { parentPort, workerData } = require('worker_threads');
const convert = require('color-convert').default || require('color-convert');
const KDTree = require('./kdtree');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ===== 런타임 갱신 가능한 변수들 =====
let currentConfig = workerData.config || {};
let globalTileDB = workerData.globalTileDB;
let kdTree = workerData.kdTree || null;
let tileDBVersion = workerData.tileDBVersion || 0;

// 워커 내부 타일 이미지 캐시 (메인 스레드 캐시와 독립)
const workerTileCache = new Map();
let workerCachedTileSize = -1;
let workerCachedTheme = '';

// config에서 동적 로드되는 매칭 파라미터
let MAX_USAGE = currentConfig.maxTileUsage || 4;
let RAD = currentConfig.banRadius || 2;
let CANDIDATE_POOL = currentConfig.candidatePoolSize || 150;
const DISTANCE_WEIGHT = 0.3;
const PENALTY_FACTOR = 40.0;

// ===== 진행률 보고 헬퍼 =====
function sendProgress(jobId, percent, phase, detail) {
  if (parentPort) {
    parentPort.postMessage({
      type: 'PROGRESS',
      jobId,
      percent: Math.round(percent),
      phase,   // 'matching' | 'caching' | 'compositing' | 'blending'
      detail: detail || ''
    });
  }
}

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
      // 테마가 바뀌면 타일 캐시도 flush
      workerTileCache.clear();
    } else if (msg.type === 'PROCESS') {
      // 고정 워커 풀에서 작업 요청이 들어온 경우
      processJobFull(msg.jobData, msg.jobId);
    }
  });
}

// ===== 풀 파이프라인: 매칭 → 합성 → 블렌딩 → 최종 버퍼 반환 =====
async function processJobFull(jobData, jobId) {
  try {
    const { rawData, info, cols, rows, tileSize, renderTileSize, originalBuffer, tilesDir, theme } = jobData;
    const tileDB = jobData.globalTileDB || globalTileDB;
    const tree = jobData.kdTree || kdTree;
    const version = jobData.tileDBVersion || tileDBVersion;

    const config = jobData.config || currentConfig;
    const totalCells = cols * rows;

    // ── Phase 1: 타일 매칭 (0~40%) ──
    sendProgress(jobId, 0, 'matching', `그리드 ${cols}×${rows} (${totalCells.toLocaleString()}칸) 분석 시작`);
    const { matchedTiles } = runMatching(rawData, info, cols, rows, tileSize, tileDB, tree, jobId, totalCells);
    sendProgress(jobId, 40, 'matching', '타일 매칭 완료');

    // ── Phase 2: 타일 캐시 로딩 (40~50%) ──
    sendProgress(jobId, 42, 'caching', '타일 이미지 로딩 중...');
    const safeRenderTileSize = renderTileSize;

    // 캐시 크기/테마 변경 시 flush
    if (workerCachedTileSize !== safeRenderTileSize || workerCachedTheme !== theme) {
      workerTileCache.clear();
      workerCachedTileSize = safeRenderTileSize;
      workerCachedTheme = theme;
    }

    const uniqueFilenames = [...new Set(matchedTiles.map(t => t.filename))];
    const missingFilenames = uniqueFilenames.filter(f => !workerTileCache.has(f));

    const CACHE_BATCH_SIZE = 50;
    for (let i = 0; i < missingFilenames.length; i += CACHE_BATCH_SIZE) {
      const batch = missingFilenames.slice(i, i + CACHE_BATCH_SIZE);
      await Promise.all(batch.map(async (filename) => {
        try {
          const { data: tileRaw } = await sharp(path.join(tilesDir, filename))
            .resize(safeRenderTileSize, safeRenderTileSize)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          workerTileCache.set(filename, tileRaw);
        } catch (err) {
          // 파일 누락 시 스킵
        }
      }));
    }
    sendProgress(jobId, 50, 'caching', `타일 ${uniqueFilenames.length}종 로드 완료`);

    // ── Phase 3: 캔버스 합성 (50~75%) ──
    const canvasWidth = cols * safeRenderTileSize;
    const canvasHeight = rows * safeRenderTileSize;
    const rawCanvas = Buffer.alloc(canvasWidth * canvasHeight * 3);

    sendProgress(jobId, 52, 'compositing', `캔버스 ${canvasWidth}×${canvasHeight} 합성 시작`);

    for (let i = 0; i < matchedTiles.length; i++) {
      const t = matchedTiles[i];
      const tileRaw = workerTileCache.get(t.filename);
      if (!tileRaw) continue;

      const renderLeft = Math.floor(t.left / tileSize) * safeRenderTileSize;
      const renderTop = Math.floor(t.top / tileSize) * safeRenderTileSize;

      for (let y = 0; y < safeRenderTileSize; y++) {
        const destOffset = ((renderTop + y) * canvasWidth + renderLeft) * 3;
        const srcOffset = y * safeRenderTileSize * 3;
        tileRaw.copy(rawCanvas, destOffset, srcOffset, srcOffset + safeRenderTileSize * 3);
      }

      // 10% 단위 진행률 보고
      if (i > 0 && i % Math.ceil(matchedTiles.length / 5) === 0) {
        const pct = 52 + (i / matchedTiles.length) * 23;
        sendProgress(jobId, pct, 'compositing', `타일 배치: ${i.toLocaleString()} / ${matchedTiles.length.toLocaleString()}`);
      }
    }
    sendProgress(jobId, 75, 'compositing', '타일 배치 완료');

    // ── Phase 4: 블렌딩 (75~95%) ──
    sendProgress(jobId, 77, 'blending', '블렌딩 처리 중...');
    let finalImageBuffer;

    if (config.opacity > 0) {
      const alphaVal = Math.max(0, Math.min(255, Math.round(255 * config.opacity)));
      
      const originalRaw = await sharp(Buffer.from(originalBuffer))
        .resize({ width: canvasWidth, height: canvasHeight, fit: 'cover' })
        .toColorspace('srgb') // 원본의 ICC 프로필을 sRGB로 변환하여 Raw 색상 손실 방지
        .ensureAlpha()
        .raw()
        .toBuffer();
        
      sendProgress(jobId, 80, 'blending', '원본 투명도 처리 중 (RAW)...');

      const transparentOriginalRaw = await sharp(originalRaw, { raw: { width: canvasWidth, height: canvasHeight, channels: 4 } })
        .composite([{
          input: Buffer.from([255, 255, 255, alphaVal]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }])
        .ensureAlpha()
        .raw()
        .toBuffer();

      let composites = [{ 
        input: transparentOriginalRaw, 
        raw: { width: canvasWidth, height: canvasHeight, channels: 4 },
        blend: config.blendMode 
      }];

      // 이중 하이브리드 (Multiply + Over) 로직 추가
      if (config.blendMode === 'multiply' && config.secondOpacity > 0) {
        sendProgress(jobId, 85, 'blending', '이중 하이브리드 투명도 처리 중 (RAW)...');
        
        const secondAlphaVal = Math.max(0, Math.min(255, Math.round(255 * config.secondOpacity)));
        const secondTransparentOriginalRaw = await sharp(originalRaw, { raw: { width: canvasWidth, height: canvasHeight, channels: 4 } })
          .composite([{
            input: Buffer.from([255, 255, 255, secondAlphaVal]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: 'dest-in'
          }])
          .ensureAlpha()
          .raw()
          .toBuffer();

        // 1차로 Multiply 적용 후, 2차로 옅게 Over 적용
        composites.push({ 
          input: secondTransparentOriginalRaw, 
          raw: { width: canvasWidth, height: canvasHeight, channels: 4 },
          blend: 'over' 
        });
      }

      sendProgress(jobId, 90, 'blending', '최종 캔버스 합성 중...');

      finalImageBuffer = await sharp(rawCanvas, {
        raw: { width: canvasWidth, height: canvasHeight, channels: 3 }
      })
        .composite(composites)
        .jpeg({ quality: 95 })
        .toBuffer();
    } else {
      finalImageBuffer = await sharp(rawCanvas, {
        raw: { width: canvasWidth, height: canvasHeight, channels: 3 }
      }).jpeg({ quality: 95 }).toBuffer();
    }

    sendProgress(jobId, 95, 'blending', '최종 이미지 인코딩 완료');

    // ── 완료: 결과 반환 ──
    parentPort.postMessage({
      success: true,
      jobId,
      finalImageBuffer,
      matchedTiles,
      canvasWidth,
      canvasHeight,
      uniqueTilesUsed: [...new Set(matchedTiles.map(t => t.filename))].length,
      tileDBVersion: version,
      tileSize,
    });

  } catch (err) {
    parentPort.postMessage({ success: false, jobId, error: err.message });
  }
}

// ===== 매칭 코어 로직 =====
function processJob(jobData, jobId) {
  try {
    const { rawData, info, cols, rows, tileSize } = jobData;
    const tileDB = jobData.globalTileDB || globalTileDB;
    const tree = jobData.kdTree || kdTree;
    const version = jobData.tileDBVersion || tileDBVersion;

    const result = runMatching(rawData, info, cols, rows, tileSize, tileDB, tree);

    if (jobId !== undefined) {
      parentPort.postMessage({ success: true, jobId, ...result, tileDBVersion: version });
    } else {
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

function runMatching(rawData, info, cols, rows, tileSize, tileDB, tree, jobId, totalCells) {
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

  // 진행률 보고 간격 (10% 단위, 매칭 전체가 0~40%에 매핑)
  const progressInterval = Math.max(1, Math.ceil(cells.length / 10));

  // 랜덤 순서대로 캔버스 모든 칸에 대해 매칭 수행
  let cellIndex = 0;
  for (const cell of cells) {
    cellIndex++;
    const cx = Math.floor(cell.startX / tileSize);
    const cy = Math.floor(cell.startY / tileSize);

    // 진행률 보고
    if (jobId !== undefined && cellIndex % progressInterval === 0) {
      const pct = (cellIndex / cells.length) * 40; // 0~40%
      sendProgress(jobId, pct, 'matching', `매칭: ${cellIndex.toLocaleString()} / ${cells.length.toLocaleString()}`);
    }

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
        const absoluteNearest = KDTree.kNearest(tree, [tLab.l, tLab.a, tLab.b], 1);
        if (absoluteNearest.length > 0) fallbackIdx = absoluteNearest[0].idx;
      }


    } else {
      // ===== 폴백: 브루트포스 (k-d tree 없는 경우) =====
      const candidateIndices = new Int32Array(dbSize);
      const distancesSq = new Float32Array(dbSize);

      for (let i = 0; i < dbSize; i++) {
        const cLab = tileDB[i].lab;
        distancesSq[i] = (tLab.l - cLab.l) ** 2 + (tLab.a - cLab.a) ** 2 + (tLab.b - cLab.b) ** 2;
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
