const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const configModule = require('./config');
const mosaicQueue = require('./mosaic.queue');
const socketManager = require('./socket.manager');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const FRONTEND_DIR = path.join(__dirname, '../public');
const OUTPUTS_DIR = path.join(FRONTEND_DIR, 'outputs');
const DB_ROOT = path.join(__dirname, '../data/themes');

let globalTileDB = [];
let globalKDTree = null;
const globalTileCache = new Map();
let globalCachedTileSize = -1;
let currentLoadedTheme = '';

// ===== 테마별 경로 헬퍼 =====
function themeDataPaths(theme) {
  return {
    tileDBFile: path.join(DB_ROOT, theme, 'tileDB.json'),
    kdTreeFile: path.join(DB_ROOT, theme, 'tileIndex.kdtree.json'),
    tilesDir: path.join(FRONTEND_DIR, 'tiles', theme),
  };
}

// ===== tileDB + k-d tree 로딩 =====
function loadTileDB(theme) {
  if (!theme) {
    const config = configModule.getConfig();
    theme = config.currentTheme || 'default_nasa';
  }

  const paths = themeDataPaths(theme);

  // tileDB 로드
  if (fs.existsSync(paths.tileDBFile)) {
    globalTileDB = JSON.parse(fs.readFileSync(paths.tileDBFile, 'utf-8'));
    console.log(`[tileDB] 테마 "${theme}" 로드 완료: ${globalTileDB.length.toLocaleString()}개 타일`);
  } else {
    console.warn(`[tileDB] 테마 "${theme}"의 tileDB가 존재하지 않습니다: ${paths.tileDBFile}`);
    globalTileDB = [];
  }

  // k-d tree 로드
  if (fs.existsSync(paths.kdTreeFile)) {
    try {
      globalKDTree = JSON.parse(fs.readFileSync(paths.kdTreeFile, 'utf-8'));
      console.log(`[tileDB] k-d tree 인덱스 로드 완료`);
    } catch (e) {
      console.warn(`[tileDB] k-d tree 파싱 실패:`, e.message);
      globalKDTree = null;
    }
  } else {
    console.warn(`[tileDB] k-d tree 인덱스가 없습니다 — 브루트포스 폴백`);
    globalKDTree = null;
  }

  currentLoadedTheme = theme;

  // 워커 풀 초기화 또는 업데이트
  if (mosaicQueue.initialized) {
    mosaicQueue.broadcastTileDBUpdate(globalTileDB, globalKDTree);
  } else {
    mosaicQueue.initPool(globalTileDB, globalKDTree);
  }
}

// 최초 로드
loadTileDB();

// 외부에서 DB 리로드 가능하게 노출
router.reloadTileDB = loadTileDB;
router.getTileCount = () => globalTileDB.length;

// ===== 타일 이미지 RAM 캐시 =====
async function preloadTileCache(targetTileSize, theme) {
  if (!theme) {
    const config = configModule.getConfig();
    theme = config.currentTheme || 'default_nasa';
  }

  const paths = themeDataPaths(theme);

  // 테마가 바뀌었거나 사이즈가 바뀌면 캐시 전체 flush
  if (currentLoadedTheme !== theme || globalCachedTileSize !== targetTileSize) {
    globalTileCache.clear();
    globalCachedTileSize = targetTileSize;
    console.log(`[캐시] 테마 전환으로 타일 캐시 전체 flush (${theme}, ${targetTileSize}px)`);
  }

  if (globalTileCache.size >= globalTileDB.length && globalTileCache.size > 0) return;

  console.log(`\n[시스템] 타일 이미지 램(RAM) 적재를 시작합니다. (테마: ${theme}, 크기: ${targetTileSize}px) ...`);
  const startTime = Date.now();
  const BATCH_SIZE = 50;
  let loaded = 0;

  for (let i = 0; i < globalTileDB.length; i += BATCH_SIZE) {
    const batch = globalTileDB.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (tileInfo) => {
      const filename = tileInfo.filename;
      if (globalTileCache.has(filename)) return; // 이미 캐시됨
      try {
        const tilePath = path.join(paths.tilesDir, filename);
        const { data: tileRaw } = await sharp(tilePath)
          .resize(targetTileSize, targetTileSize)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        globalTileCache.set(filename, tileRaw);
        loaded++;
      } catch (err) {
        // 파일 누락 시 조용히 스킵 (빌드 에러 가능성)
      }
    }));
    process.stdout.write(`\r  -> 적재 중... ${loaded + (globalTileCache.size - loaded)} / ${globalTileDB.length} 완료`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n[시스템] 타일 램(RAM) 장전 완료! (${elapsed}초 소요)\n`);
}

// 최초 설정값 기준으로 즉시 장전 시작
const initialConfig = configModule.getConfig();
preloadTileCache(initialConfig.tileSize || 20, initialConfig.currentTheme || 'default_nasa');

// 외부에서 설정 변경 시 재장전 가능하도록 노출
router.preloadTileCache = preloadTileCache;

// ===== 업로드 및 모자이크 생성 =====
router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진 누락' });
  if (globalTileDB.length === 0) return res.status(500).json({ error: '타일 데이터(DB)가 존재하지 않습니다.' });

  const config = configModule.getConfig();
  const TILE_SIZE = config.tileSize || 20;
  const MAX_RES = config.maxResolution || 1920;

  const sessionId = req.query.sessionId || req.body.sessionId || null;
  const io = socketManager.getIo();

  try {
    const startTime = Date.now();

    // 1. 원본 해상도 파악 및 MAX_RES 기준 비율 조정
    const originalInfo = await sharp(req.file.buffer).metadata();
    let targetWidth = originalInfo.width;
    let targetHeight = originalInfo.height;

    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_RES) / targetWidth);
      targetWidth = MAX_RES;
    } else {
      targetWidth = Math.round((targetWidth * MAX_RES) / targetHeight);
      targetHeight = MAX_RES;
    }

    const cols = Math.floor(targetWidth / TILE_SIZE);
    const rows = Math.floor(targetHeight / TILE_SIZE);
    const CANVAS_W = cols * TILE_SIZE;
    const CANVAS_H = rows * TILE_SIZE;
    const totalCells = cols * rows;

    const originalResized = await sharp(req.file.buffer)
      .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover' })
      .toBuffer();

    // 2. 픽셀 데이터 추출
    const { data: rawData, info } = await sharp(originalResized).raw().toBuffer({ resolveWithObject: true });

    // 3. Worker Thread Queue에 작업 등록
    const workerJobData = {
      rawData,
      info,
      cols,
      rows,
      tileSize: TILE_SIZE,
      globalTileDB,  // 고정 풀 모드에서는 무시됨 (워커 내부 참조 사용)
      kdTree: globalKDTree,
      config: {
        maxTileUsage: config.maxTileUsage,
        banRadius: config.banRadius,
        candidatePoolSize: config.candidatePoolSize,
      },
      tileDBVersion: mosaicQueue.tileDBVersion,
    };

    // 진행 상황: 매칭 시작 알림 + 대기열 정보
    if (sessionId) {
      const stats = mosaicQueue.getStats();
      io.to(sessionId).emit('mosaic_progress', {
        phase: 'matching',
        message: stats.queueLength > 0
          ? `대기열 ${stats.queueLength}번째... (예상 ${mosaicQueue.estimateWaitTime()}초)`
          : '색상 분석 및 타일 매칭 중...',
        percent: 0,
        queuePosition: stats.queueLength,
        estimatedWait: mosaicQueue.estimateWaitTime(),
        cols, rows
      });
    }

    console.log(`⏳ 모자이크 생성 큐 대기... (현재 대기: ${mosaicQueue.getStats().queueLength}명)`);

    const matchResult = await mosaicQueue.addJob(workerJobData);

    if (!matchResult.success) {
      throw new Error(matchResult.error);
    }

    const { matchedTiles } = matchResult;

    // 4. 모자이크 베이스 합성
    const canvasWidth = cols * TILE_SIZE;
    const canvasHeight = rows * TILE_SIZE;
    const rawCanvas = Buffer.alloc(canvasWidth * canvasHeight * 3);

    // 타일 이미지 캐시 확인 & 누락분 로드
    const currentTheme = config.currentTheme || 'default_nasa';
    const tilesDir = path.join(FRONTEND_DIR, 'tiles', currentTheme);

    if (globalCachedTileSize !== TILE_SIZE) {
      globalTileCache.clear();
      globalCachedTileSize = TILE_SIZE;
    }

    const uniqueFilenames = [...new Set(matchedTiles.map(t => t.filename))];
    const missingFilenames = uniqueFilenames.filter(f => !globalTileCache.has(f));

    const CACHE_BATCH_SIZE = 50;
    for (let i = 0; i < missingFilenames.length; i += CACHE_BATCH_SIZE) {
      const batch = missingFilenames.slice(i, i + CACHE_BATCH_SIZE);
      await Promise.all(batch.map(async (filename) => {
        try {
          const { data: tileRaw } = await sharp(path.join(tilesDir, filename))
            .resize(TILE_SIZE, TILE_SIZE)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          globalTileCache.set(filename, tileRaw);
        } catch (err) {
          // 파일 누락 시 스킵
        }
      }));
    }

    // 진행 상황: 합성 시작
    if (sessionId) {
      io.to(sessionId).emit('mosaic_progress', {
        phase: 'compositing',
        message: '타일을 조합하는 중...',
        percent: 10,
        placedCount: 0,
        totalCount: matchedTiles.length
      });
    }

    // 메모리 캐시를 이용해 캔버스에 픽셀 덮어쓰기
    for (let i = 0; i < matchedTiles.length; i++) {
      const t = matchedTiles[i];
      const tileRaw = globalTileCache.get(t.filename);
      if (!tileRaw) continue; // 캐시 누락 시 스킵
      for (let y = 0; y < TILE_SIZE; y++) {
        const destOffset = ((t.top + y) * canvasWidth + t.left) * 3;
        const srcOffset = y * TILE_SIZE * 3;
        tileRaw.copy(rawCanvas, destOffset, srcOffset, srcOffset + TILE_SIZE * 3);
      }
    }

    // 5. 블렌딩
    let finalImageBuffer;

    if (config.opacity > 0) {
      const alphaVal = Math.max(0, Math.min(255, Math.round(255 * config.opacity)));
      const transparentOriginal = await sharp(originalResized)
        .ensureAlpha()
        .composite([{
          input: Buffer.from([255, 255, 255, alphaVal]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }])
        .png()
        .toBuffer();

      finalImageBuffer = await sharp(rawCanvas, {
        raw: { width: canvasWidth, height: canvasHeight, channels: 3 }
      })
        .composite([{ input: transparentOriginal, blend: config.blendMode }])
        .jpeg({ quality: 90 })
        .toBuffer();
    } else {
      finalImageBuffer = await sharp(rawCanvas, {
        raw: { width: canvasWidth, height: canvasHeight, channels: 3 }
      }).jpeg({ quality: 90 }).toBuffer();
    }

    const outputFilename = `mosaic_${Date.now()}.jpg`;
    await sharp(finalImageBuffer).toFile(path.join(OUTPUTS_DIR, outputFilename));

    // --- 타일 사용 통계 및 로그 ---
    const usageLog = {};
    const detailedPlacements = [];

    matchedTiles.forEach(t => {
      usageLog[t.filename] = (usageLog[t.filename] || 0) + 1;
      detailedPlacements.push({
        col: Math.floor(t.left / TILE_SIZE),
        row: Math.floor(t.top / TILE_SIZE),
        x_pixel: t.left,
        y_pixel: t.top,
        filename: t.filename
      });
    });

    detailedPlacements.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const sortedUsage = Object.entries(usageLog).sort((a, b) => b[1] - a[1]);

    const logData = {
      timestamp: new Date().toISOString(),
      outputFile: outputFilename,
      theme: currentTheme,
      totalCells: cols * rows,
      uniqueTilesUsed: sortedUsage.length,
      topUsages: sortedUsage.slice(0, 50).map(([filename, count]) => ({ filename, count })),
      placements: detailedPlacements
    };

    const logsDir = path.join(__dirname, '../logs/history');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, `log_${outputFilename}.json`), JSON.stringify(logData, null, 2));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalTilesInDB = globalTileDB.length;
    const usageRate = totalTilesInDB > 0 ? ((sortedUsage.length / totalTilesInDB) * 100).toFixed(1) : '0.0';
    console.log(`✅ 모자이크 완료! ${outputFilename} [${CANVAS_W}x${CANVAS_H}] (${elapsed}s 소요, 테마: ${currentTheme})`);
    console.log(`   📊 총 ${totalCells.toLocaleString()}칸 배치 / 고유 타일 ${sortedUsage.length.toLocaleString()} / ${totalTilesInDB.toLocaleString()}종 사용 (활용률 ${usageRate}%)`);

    // 월간 통계 로깅
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dateString = `${yyyy}-${mm}`;

      const statsFile = path.join(__dirname, `../logs/stats_${dateString}.log`);

      const kstTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const logLine = `[${kstTime}] 새로운 모자이크 완성 (소요시간: ${elapsed}s, 해상도: ${CANVAS_W}x${CANVAS_H}, 고유 타일: ${sortedUsage.length}종, 테마: ${currentTheme})\n`;
      fs.appendFileSync(statsFile, logLine);
    } catch (e) {
      console.error('월간 통계 로깅 실패:', e);
    }

    // 업로드 클라이언트에 완료 알림
    if (sessionId) {
      io.to(sessionId).emit('mosaic_progress', {
        phase: 'done',
        percent: 100,
        imageUrl: `/outputs/${outputFilename}`,
        tileSize: TILE_SIZE,
        width: CANVAS_W,
        height: CANVAS_H
      });
    }

    // 디스플레이에 푸시
    socketManager.getIo().emit('new_mosaic', {
      imageUrl: `/outputs/${outputFilename}`,
      tileSize: TILE_SIZE,
      width: CANVAS_W,
      height: CANVAS_H
    });

    res.json({ success: true, imageUrl: `/outputs/${outputFilename}`, timeElapsed: elapsed });

  } catch (err) {
    console.error('❌ 처리 에러:', err);
    try {
      const logPath = path.join(__dirname, '../logs/server.error.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR in /api/upload: ${err.stack || err.message}\n`);
    } catch (e) {}
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

module.exports = router;
