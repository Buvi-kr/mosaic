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
const TILES_DIR = path.join(FRONTEND_DIR, 'tiles');
const DB_FILE = path.join(__dirname, '../data/tileDB.json');

let globalTileDB = [];
const globalTileCache = new Map();
let globalCachedTileSize = -1;

function loadTileDB() {
  if (fs.existsSync(DB_FILE)) {
    globalTileDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  }
}

// 최초 로드
loadTileDB();

// 외부에서 DB 리로드 가능하게 노출
router.reloadTileDB = loadTileDB;
router.getTileCount = () => globalTileDB.length;

// [추가] 서버 구동 시 모든 타일을 RAM에 미리 적재 (사용자 요청 사항)
async function preloadTileCache(targetTileSize) {
  if (globalCachedTileSize === targetTileSize && globalTileCache.size >= globalTileDB.length) return;
  
  console.log(`\n[시스템] 타일 이미지 램(RAM) 적재를 시작합니다. (크기: ${targetTileSize}px) ...`);
  globalTileCache.clear();
  globalCachedTileSize = targetTileSize;
  
  const startTime = Date.now();
  const BATCH_SIZE = 50;
  let loaded = 0;
  
  for (let i = 0; i < globalTileDB.length; i += BATCH_SIZE) {
    const batch = globalTileDB.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (tileInfo) => {
      const filename = tileInfo.filename;
      try {
        const { data: tileRaw } = await sharp(path.join(TILES_DIR, filename))
          .resize(targetTileSize, targetTileSize)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        globalTileCache.set(filename, tileRaw);
        loaded++;
      } catch (err) {
        console.error(`타일 캐시 로드 실패: ${filename}`, err);
      }
    }));
    // 진행도 표시
    process.stdout.write(`\r  -> 적재 중... ${loaded} / ${globalTileDB.length} 완료`);
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n[시스템] 타일 램(RAM) 장전 완료! 첫 요청부터 2초 컷을 보장합니다. (${elapsed}초 소요)\n`);
}

// 최초 설정값 기준으로 즉시 장전 시작
const initialConfig = configModule.getConfig();
preloadTileCache(initialConfig.tileSize || 20);

// 외부에서 설정 변경 시 재장전 가능하도록 노출
router.preloadTileCache = preloadTileCache;

router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진 누락' });
  if (globalTileDB.length === 0) return res.status(500).json({ error: '타일 데이터(DB)가 존재하지 않습니다.' });

  const config = configModule.getConfig();
  const TILE_SIZE = config.tileSize || 20;
  const MAX_RES = config.maxResolution || 1920;

  // 실시간 진행 상황 push를 위한 sessionId
  const sessionId = req.query.sessionId || req.body.sessionId || null;
  const io = socketManager.getIo();

  try {
    const startTime = Date.now();
    
    // 1. 원본 해상도 파악 및 "무조건" MAX_RES 기준으로 비율 조정 (확대/축소 강제화)
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

    // 관람객 원본 리사이즈 (딱 떨어지는 픽셀로)
    const originalResized = await sharp(req.file.buffer)
      .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover' })
      .toBuffer();

    // 2. 픽셀 데이터 추출 (워커에 넘기기 위함)
    const { data: rawData, info } = await sharp(originalResized).raw().toBuffer({ resolveWithObject: true });

    // 3. Worker Thread Queue에 작업 등록
    const workerJobData = {
      rawData, 
      info, 
      cols, 
      rows, 
      tileSize: TILE_SIZE, 
      globalTileDB // 복사본 전송
    };

    // 진행 상황: 매칭 시작 알림
    if (sessionId) {
      io.to(sessionId).emit('mosaic_progress', {
        phase: 'matching',
        message: '색상 분석 및 타일 매칭 중...',
        percent: 0,
        cols, rows
      });
    }

    console.log(`⏳ 모자이크 생성 큐 대기... (현재 대기: ${mosaicQueue.getStats().queueLength}명)`);
    
    // 워커 스레드 병렬 처리 완료 대기
    const matchResult = await mosaicQueue.addJob(workerJobData);
    
    if (!matchResult.success) {
      throw new Error(matchResult.error);
    }

    const { matchedTiles } = matchResult;

    // 4. 모자이크 베이스 합성 (메인 스레드) - Raw Buffer 방식 (sharp composite 한계 돌파)
    const canvasWidth = cols * TILE_SIZE;
    const canvasHeight = rows * TILE_SIZE;
    const rawCanvas = Buffer.alloc(canvasWidth * canvasHeight * 3);

    // [글로벌 최적화] 중복 타일 디스크 읽기 및 sharp 리사이징 방지를 위한 글로벌 캐싱
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
        const { data: tileRaw } = await sharp(path.join(TILES_DIR, filename))
          .resize(TILE_SIZE, TILE_SIZE)
          .removeAlpha() // 무조건 3채널(RGB) 보장
          .raw()
          .toBuffer({ resolveWithObject: true });
        globalTileCache.set(filename, tileRaw);
      }));
    }

    // 진행 상황: 합성 시작 알림
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
      for (let y = 0; y < TILE_SIZE; y++) {
        const destOffset = ((t.top + y) * canvasWidth + t.left) * 3;
        const srcOffset = y * TILE_SIZE * 3;
        tileRaw.copy(rawCanvas, destOffset, srcOffset, srcOffset + TILE_SIZE * 3);
      }
    }

    // 5. 블렌딩 옵션
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
        .png() // 강제로 PNG 포맷으로 출력하여 투명도(Alpha) 보존 보장
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

    // --- 타일 사용 통계 및 맵핑 상세 위치 로그 저장 로직 ---
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

    // 유지보수 및 디버깅을 위해 개별 상세 로그(JSON) 생성 (정렬 후 저장)
    detailedPlacements.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const sortedUsage = Object.entries(usageLog).sort((a, b) => b[1] - a[1]);
    
    const logData = {
      timestamp: new Date().toISOString(),
      outputFile: outputFilename,
      totalCells: cols * rows,
      uniqueTilesUsed: sortedUsage.length,
      topUsages: sortedUsage.slice(0, 50).map(([filename, count]) => ({ filename, count })),
      placements: detailedPlacements // 전체 (x,y) 좌표별 맵핑 상세 내역 추가
    };
    
    const logsDir = path.join(__dirname, '../logs/history');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, `log_${outputFilename}.json`), JSON.stringify(logData, null, 2));
    // --------------------------------------------

    const elapsed = ((Date.now() - startTime)/1000).toFixed(2);
    const totalTilesInDB = globalTileDB.length;
    const usageRate = totalTilesInDB > 0 ? ((sortedUsage.length / totalTilesInDB) * 100).toFixed(1) : '0.0';
    console.log(`✅ 모자이크 완료! ${outputFilename} [${CANVAS_W}x${CANVAS_H}] (${elapsed}s 소요)`);
    console.log(`   📊 총 ${totalCells.toLocaleString()}칸 배치 / 고유 타일 ${sortedUsage.length.toLocaleString()} / ${totalTilesInDB.toLocaleString()}종 사용 (활용률 ${usageRate}%)`);

    // 월간 통계 로깅 (참여자 수 파악용)
    try {
      const now = new Date();
      // YYYY-MM 포맷 추출
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dateString = `${yyyy}-${mm}`;
      
      const statsFile = path.join(__dirname, `../logs/stats_${dateString}.log`);
      
      const kstTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const logLine = `[${kstTime}] 새로운 모자이크 완성 (소요시간: ${elapsed}s, 해상도: ${CANVAS_W}x${CANVAS_H}, 고유 타일: ${sortedUsage.length}종)\n`;
      fs.appendFileSync(statsFile, logLine);
    } catch(e) {
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
    } catch(e) {}
    res.status(500).json({ error: '서버 에러가 발생했습니다.' });
  }
});

module.exports = router;
