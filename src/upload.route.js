const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const configModule = require('./config');
const mosaicQueue = require('./mosaic.queue');
const socketManager = require('./socket.manager');
const sessionManager = require('./session.manager');
const sessionLogger = require('./session.logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const FRONTEND_DIR = path.join(__dirname, '../public');
const OUTPUTS_DIR = path.join(FRONTEND_DIR, 'outputs');
const DB_ROOT = path.join(__dirname, '../data/themes');

let globalTileDB = [];
let globalKDTree = null;
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

// ===== 디스플레이 상태 머신 연결 =====
mosaicQueue.onStateChange = (state, stats) => {
  try {
    const io = socketManager.getIo();
    io.emit('display_state', {
      state,  // 'idle' | 'processing' | 'overloaded'
      queueLength: stats.queueLength,
      activeWorkers: stats.activeWorkers,
      maxWorkers: stats.maxWorkers,
    });
  } catch (e) {
    // 소켓 미초기화 시 무시
  }
};

// ===== 게이트 & 세션 REST API =====
router.get('/gate-state', (req, res) => {
  res.json(sessionManager.getGateState());
});

router.post('/claim-slot', (req, res) => {
  const { gateToken, socketId } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const result = sessionManager.claimSlot(gateToken, socketId || null, { ip: clientIp, userAgent });
  res.json(result);
});

router.post('/record-download', (req, res) => {
  const { sessionToken, shotNumber, filename } = req.body || {};
  const session = sessionManager.getSession(sessionToken);
  if (!session) {
    return res.status(404).json({ success: false, error: '세션을 찾을 수 없습니다.' });
  }
  const recorded = sessionLogger.recordDownload(
    session.sessionId,
    parseInt(shotNumber) || 1,
    filename || `mosaic_${shotNumber || 1}.jpg`
  );
  res.json({ success: recorded });
});

router.post('/start-capture', (req, res) => {
  const { sessionToken } = req.body || {};
  const result = sessionManager.startCapture(sessionToken);
  res.json(result);
});

router.post('/decision-choice', (req, res) => {
  const { sessionToken, choice } = req.body || {};
  if (choice === 'retry') {
    res.json(sessionManager.startSecondShot(sessionToken));
  } else {
    res.json(sessionManager.finishExperience(sessionToken));
  }
});

router.post('/finish', (req, res) => {
  const { sessionToken } = req.body || {};
  res.json(sessionManager.finishExperience(sessionToken));
});

router.get('/session-status', (req, res) => {
  const token = req.query.token || req.headers['x-session-token'];
  const session = sessionManager.getSession(token);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  res.json({
    sessionId: session.sessionId,
    state: session.state,
    shotCount: session.shotCount,
    currentShot: session.currentShot,
    records: sessionManager.getAllRecords(session)
  });
});

// ===== 슬롯 확인 API (하위 호환) =====
router.get('/slot-check', (req, res) => {
  const slotInfo = mosaicQueue.canAcceptUpload();
  res.json(slotInfo);
});

// ===== 업로드 및 모자이크 생성 =====
router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '사진 누락' });
  if (globalTileDB.length === 0) return res.status(500).json({ error: '타일 데이터(DB)가 존재하지 않습니다.' });

  const sessionToken = req.query.sessionToken || req.body.sessionToken || req.headers['x-session-token'] || null;
  const requestId = req.body?.requestId || req.query?.requestId || null;

  let session = null;
  if (sessionToken) {
    session = sessionManager.getSession(sessionToken);
    // 세션이 만료되었거나 메모리에서 정리된 경우에도 관람객 사진을 버리지 않고 안전하게 처리
    if (!session) {
      console.log(`[Upload] 만료된 세션 토큰 복구 생성: ${sessionToken}`);
      session = {
        sessionId: `sess_${Date.now()}`,
        sessionToken,
        state: 'CAPTURING_1',
        shotCount: 0,
        currentShot: 1,
        shotRecords: new Map(),
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };
      sessionManager.sessions.set(sessionToken, session);
    }

    if (session.shotCount >= 2) {
      return res.json({
        success: true,
        message: '체험 횟수(2회)를 모두 완료했습니다.',
        shotCount: session.shotCount,
        allRecords: sessionManager.getAllRecords(session)
      });
    }

    // 멱등성 검사 (Idempotency)
    const currentShot = session.currentShot;
    const existingRecord = session.shotRecords.get(currentShot);
    if (existingRecord && existingRecord.status === 'COMPLETED' && existingRecord.resultUrl) {
      console.log(`[Upload] 멱등성 캐시 반환: ${session.sessionId} (회차: ${currentShot})`);
      return res.json({
        success: true,
        imageUrl: existingRecord.resultUrl,
        cached: true,
        shotCount: session.shotCount,
        currentShot: session.currentShot,
        allRecords: sessionManager.getAllRecords(session)
      });
    }
    if (existingRecord && existingRecord.status === 'PROCESSING') {
      return res.status(429).json({ error: '이미 처리 중입니다. 잠시만 기다려주세요.' });
    }

    sessionManager.beginProcessing(sessionToken, requestId);
    sessionLogger.recordUploadReceived(session.sessionId, session.currentShot, {
      size: req.file.size
    });
  }

  const config = configModule.getConfig();
  // 그리드 밀도 (가상 단위). 작을수록 모자이크 칸수(가로/세로 장수)가 폭증함
  const TILE_SIZE = config.tileSize || 20; 
  // 실제 타일 렌더링 물리적 화질 (픽셀). (최종 캔버스 해상도 폭증의 원인)
  const RENDER_TILE_SIZE = config.renderTileSize || 200; 
  // 가상 그리드 해상도 기준. (실제 출력물 크기가 아님, 칸수를 계산하기 위한 가상 도화지)
  const MAX_RES = config.maxResolution || 1920;

  const sessionId = session ? session.sessionId : (req.query.sessionId || req.body.sessionId || null);
  const io = socketManager.getIo();

  try {
    const startTime = Date.now();

    // 1. 원본 비율 파악 및 가상 그리드(MAX_RES) 기준으로 가상 픽셀 스케일링
    const originalInfo = await sharp(req.file.buffer, { limitInputPixels: false }).metadata();
    let targetWidth = originalInfo.width;
    let targetHeight = originalInfo.height;

    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_RES) / targetWidth);
      targetWidth = MAX_RES;
    } else {
      targetWidth = Math.round((targetWidth * MAX_RES) / targetHeight);
      targetHeight = MAX_RES;
    }

    // 2. 가로/세로 모자이크 칸 수(장수) 계산 (Density)
    const cols = Math.floor(targetWidth / TILE_SIZE);
    const rows = Math.floor(targetHeight / TILE_SIZE);
    
    // 타일 렌더링 물리적 화질 결정
    let safeRenderTileSize = RENDER_TILE_SIZE;
    if (config.lowMemoryMode && cols * safeRenderTileSize > 15000) {
      // 저사양 안전 모드 (Low-Memory Mode) 활성화 시에만 8GB 이하 저사양 OOM 방지 캡 적용
      safeRenderTileSize = Math.floor(15000 / cols);
      if (safeRenderTileSize < TILE_SIZE) safeRenderTileSize = TILE_SIZE;
      console.warn(`[저사양 안전모드] RENDER_TILE_SIZE 다운스케일: ${RENDER_TILE_SIZE}px -> ${safeRenderTileSize}px`);
    } else if (cols * safeRenderTileSize > 19200) {
      // 고해상도 안전가드: 19,200px (3.68억 픽셀) 초과 시 Node.js OOM 방지를 위해 safeRenderTileSize 비례 조정
      safeRenderTileSize = Math.floor(19200 / cols);
      if (safeRenderTileSize < TILE_SIZE) safeRenderTileSize = TILE_SIZE;
      console.log(`[렌더링] 💎 Full-Quality 안전가드: 타일 화질 ${safeRenderTileSize}px (최종 캔버스: ${cols * safeRenderTileSize}×${rows * safeRenderTileSize}px)`);
    } else {
      console.log(`[렌더링] 💎 Full-Quality 모드: 타일 화질 ${safeRenderTileSize}px (최종 캔버스: ${cols * safeRenderTileSize}×${rows * safeRenderTileSize}px)`);
    }

    const CANVAS_W = cols * TILE_SIZE;
    const CANVAS_H = rows * TILE_SIZE;
    const totalCells = cols * rows;

    const originalResized = await sharp(req.file.buffer, { limitInputPixels: false })
      .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover' })
      .toBuffer();

    // 2. 픽셀 데이터 추출
    const { data: rawData, info } = await sharp(originalResized, { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true });

    // 디스플레이 상태 → processing
    io.emit('display_state', { state: 'processing', percent: 0, queueLength: mosaicQueue.getStats().queueLength });

    // 3. 워커에 전체 파이프라인(매칭+합성+블렌딩) 위임
    const currentTheme = config.currentTheme || 'default_nasa';
    const tilesDir = path.join(FRONTEND_DIR, 'tiles', currentTheme);

    const workerJobData = {
      rawData,
      info,
      cols,
      rows,
      tileSize: TILE_SIZE,
      renderTileSize: safeRenderTileSize,
      originalBuffer: req.file.buffer,
      tilesDir,
      theme: currentTheme,
      globalTileDB,    // 고정 풀 모드에서는 무시됨 (워커 내부 참조 사용)
      kdTree: globalKDTree,
      config: {
        maxTileUsage: config.maxTileUsage,
        banRadius: config.banRadius,
        candidatePoolSize: config.candidatePoolSize,
        turboMode: config.turboMode,
        opacity: config.opacity || 0,
        blendMode: config.blendMode || 'multiply',
        secondOpacity: config.secondOpacity || 0,
      }
    };

    // 진행률 콜백: 워커의 PROGRESS를 소켓으로 중계
    const onProgress = (progressData) => {
      if (sessionId) {
        io.to(sessionId).emit('mosaic_progress', {
          phase: progressData.phase,
          message: progressData.detail,
          percent: progressData.percent,
          cols, rows,
        });
      }
      // 디스플레이에도 진행률 전달
      io.emit('display_state', {
        state: 'processing',
        percent: progressData.percent,
        queueLength: mosaicQueue.getStats().queueLength,
      });
    };

    // 진행 상황 알림: 업로드 수신됨
    if (sessionId) {
      io.to(sessionId).emit('mosaic_progress', {
        phase: 'matching',
        message: `그리드 분석 시작 [${cols}×${rows}]`,
        percent: 0,
        cols, rows,
      });
    }

    // ★ 전체 파이프라인을 워커에 위임 (매칭+합성+블렌딩)
    const result = await mosaicQueue.addJob(workerJobData, onProgress);

    // 4. 워커에서 받은 최종 이미지 버퍼를 파일로 저장
    const outputFilename = `mosaic_${Date.now()}.jpg`;
    
    if (!fs.existsSync(OUTPUTS_DIR)) {
      fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    }
    
    // 워커가 인코딩한 고화질 JPEG 버퍼를 재디코딩 없이 다이렉트로 디스크에 저장 (CPU/RAM 제로 오버헤드 & 픽셀 제한 원천 차단)
    await fs.promises.writeFile(path.join(OUTPUTS_DIR, outputFilename), result.finalImageBuffer);

    // --- 타일 사용 통계 및 로그 ---
    const usageLog = {};
    const matchedTiles = result.matchedTiles;
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
    const canvasWidth = result.canvasWidth;
    const canvasHeight = result.canvasHeight;

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
    console.log(`✅ 모자이크 완료! ${outputFilename} [${canvasWidth}x${canvasHeight}] (${elapsed}s 소요, 테마: ${currentTheme})`);
    console.log(`   📊 총 ${totalCells.toLocaleString()}칸 배치 / 고유 타일 ${sortedUsage.length.toLocaleString()} / ${totalTilesInDB.toLocaleString()}종 사용 (활용률 ${usageRate}%)`);

    // 월간 통계 로깅
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dateString = `${yyyy}-${mm}`;

      const statsFile = path.join(__dirname, `../logs/stats_${dateString}.log`);

      const kstTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const logLine = `[${kstTime}] 새로운 모자이크 완성 (소요시간: ${elapsed}s, 해상도: ${canvasWidth}x${canvasHeight}, 타일 수: ${totalCells.toLocaleString()}개 (${cols}x${rows}), 고유 타일: ${sortedUsage.length}종, 테마: ${currentTheme})\n`;
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

    // 5. 세션 매니저에 성공 기록 및 1회차 완료 즉시 게이트 오픈
    let displayDuration = config.displayShowcaseDuration || 20;
    let shotCount = 1;
    let currentShot = 1;
    let allRecords = [];

    if (sessionToken && session) {
      const recordResult = sessionManager.recordUploadSuccess(sessionToken, `/outputs/${outputFilename}`, {
        elapsed,
        totalCells,
        theme: currentTheme,
        resolution: `${canvasWidth}x${canvasHeight}`,
        resultUrl: `/outputs/${outputFilename}`
      });
      if (recordResult) {
        displayDuration = recordResult.displayDuration;
        shotCount = recordResult.shotCount;
        currentShot = recordResult.currentShot;
        allRecords = recordResult.allRecords;
      }
    }

    // 디스플레이에 결과 전시 (SHOWCASE 상태 및 1회차 동적/2회차 8초 전달)
    io.emit('display_state', { state: 'showcase', duration: displayDuration });
    io.emit('new_mosaic', {
      imageUrl: `/outputs/${outputFilename}`,
      tileSize: TILE_SIZE,
      width: CANVAS_W,
      height: CANVAS_H,
      displayDuration: displayDuration,
      shotNumber: currentShot
    });

    res.json({
      success: true,
      imageUrl: `/outputs/${outputFilename}`,
      timeElapsed: elapsed,
      shotCount,
      currentShot,
      displayDuration,
      allRecords
    });

  } catch (err) {
    sessionLogger.logServerError('/api/upload', err, {
      sessionId: req.body?.sessionId,
      sessionToken,
      tileSize: TILE_SIZE,
      targetWidth, targetHeight,
      cols, rows
    });
    if (sessionToken) {
      sessionManager.recordUploadFailure(sessionToken, err.message);
    }
    res.status(500).json({ error: '서버 에러가 발생했습니다. 다시 촬영해주세요.' });
  }
});

module.exports = router;
