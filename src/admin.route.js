const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const configModule = require('./config');
const buildTileDB = require('../scripts/build.db');
const mosaicQueue = require('./mosaic.queue');

const router = express.Router();
let uploadRouterReference = null;

// 의존성 주입 (upload 라우터의 DB 리로드를 위해)
router.setUploadRouter = (routerRef) => {
  uploadRouterReference = routerRef;
};

// ===== 빌드 Job Queue (FIFO, 동시 빌드 방지) =====
const buildJobs = new Map(); // jobId → {status, result, error, theme}
let buildJobCounter = 0;
let isBuildRunning = false;
const buildQueue = []; // 대기 중인 빌드 요청 [{jobId, theme}]

async function processBuildQueue() {
  if (isBuildRunning || buildQueue.length === 0) return;

  isBuildRunning = true;
  const job = buildQueue.shift();
  const { jobId, theme } = job;

  buildJobs.set(jobId, { status: 'building', theme, startedAt: Date.now() });
  console.log(`\n[빌드 큐] 빌드 시작: ${theme} (Job #${jobId})`);

  try {
    const result = await buildTileDB(theme);
    buildJobs.set(jobId, { status: 'done', theme, result, completedAt: Date.now() });
    console.log(`[빌드 큐] 빌드 완료: ${theme} (Job #${jobId})`);

    // 빌드 성공 시 자동으로 테마 전환 실행
    if (uploadRouterReference) {
      uploadRouterReference.reloadTileDB(theme);
      if (uploadRouterReference.preloadTileCache) {
        const config = configModule.getConfig();
        await uploadRouterReference.preloadTileCache(config.tileSize || 20, theme);
      }
    }
  } catch (err) {
    console.error(`[빌드 큐] 빌드 실패: ${theme} (Job #${jobId}):`, err.message);
    buildJobs.set(jobId, { status: 'failed', theme, error: err.message, completedAt: Date.now() });
    // 실패 시 reloadTileDB를 호출하지 않음 → 이전 테마 계속 서빙
  }

  isBuildRunning = false;
  processBuildQueue(); // 다음 작업 처리
}

// ===== 테마 관련 헬퍼 =====
const RAW_TILES_DIR = path.join(__dirname, '../public/raw_tiles');

function getAvailableThemes() {
  if (!fs.existsSync(RAW_TILES_DIR)) return [];
  return fs.readdirSync(RAW_TILES_DIR).filter(name => {
    const fullPath = path.join(RAW_TILES_DIR, name);
    return fs.statSync(fullPath).isDirectory();
  });
}

function isThemeBuilt(theme) {
  const tileDBPath = path.join(__dirname, '../data/themes', theme, 'tileDB.json');
  return fs.existsSync(tileDBPath);
}

// ===== API 엔드포인트 =====

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const usedMemPercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);

  const tileCount = uploadRouterReference ? uploadRouterReference.getTileCount() : 0;
  const qStats = mosaicQueue.getStats();
  const config = configModule.getConfig();

  res.json({
    tileCount,
    config,
    currentTheme: config.currentTheme || 'default_nasa',
    system: {
      cpuCores: os.cpus().length,
      memoryUsage: `${usedMemPercent}%`,
      queueLength: qStats.queueLength,
      activeWorkers: qStats.activeWorkers,
      maxWorkers: qStats.maxWorkers,
      poolInitialized: qStats.poolInitialized,
      tileDBVersion: qStats.tileDBVersion,
      emaProcessTime: qStats.emaProcessTime,
      estimatedWaitTime: mosaicQueue.estimateWaitTime(),
    }
  });
});

// GET /api/admin/themes — 테마 목록 조회
router.get('/themes', (req, res) => {
  const themes = getAvailableThemes();
  const config = configModule.getConfig();

  const themeList = themes.map(name => ({
    name,
    isBuilt: isThemeBuilt(name),
    isActive: name === config.currentTheme,
  }));

  res.json({ themes: themeList, currentTheme: config.currentTheme });
});

// POST /api/admin/config — 설정 및 테마 반영
router.post('/config', async (req, res) => {
  const prevConfig = configModule.getConfig();
  const prevTheme = prevConfig.currentTheme || 'default_nasa';
  const newThemeRequested = req.body.currentTheme;

  // currentTheme 화이트리스트 검증
  if (newThemeRequested && newThemeRequested !== prevTheme) {
    const validThemes = getAvailableThemes();
    if (!validThemes.includes(newThemeRequested)) {
      return res.status(400).json({
        error: `유효하지 않은 테마입니다: "${newThemeRequested}"`,
        validThemes,
      });
    }
  }

  // config 업데이트 (원자적 쓰기는 config.js 내부에서 처리)
  const newConfig = configModule.updateConfig(req.body);

  console.log('\n======================================================');
  console.log(`[Admin] ⚙️ 관리자 설정 라이브 반영 완료!`);
  console.log(` - 최대 해상도 제한: ${newConfig.maxResolution}px`);
  console.log(` - 타일 크기: ${newConfig.tileSize}px`);
  console.log(` - 원본 투명도: ${Math.round(newConfig.opacity * 100)}%`);
  console.log(` - 블렌딩 모드: ${newConfig.blendMode}`);
  console.log(` - 현재 테마: ${newConfig.currentTheme}`);
  console.log(` - 타일 중복 제한: ${newConfig.maxTileUsage}회`);
  console.log(` - Ban Radius: ${newConfig.banRadius}`);
  console.log('======================================================\n');

  // Socket.io로 설정 변경 알림
  const socketManager = require('./socket.manager');
  socketManager.getIo().emit('config_updated', newConfig);

  // 워커 풀에 config 변경 브로드캐스트
  mosaicQueue.broadcastConfigUpdate(newConfig);

  // 테마 전환 로직
  if (newThemeRequested && newThemeRequested !== prevTheme) {
    if (isThemeBuilt(newThemeRequested)) {
      // 이미 빌드된 테마 → 즉시 전환
      console.log(`[Admin] 테마 전환: ${prevTheme} → ${newThemeRequested} (빌드 완료 상태, 즉시 적용)`);

      if (uploadRouterReference) {
        uploadRouterReference.reloadTileDB(newThemeRequested);
        if (uploadRouterReference.preloadTileCache) {
          uploadRouterReference.preloadTileCache(newConfig.tileSize || 20, newThemeRequested).catch(err => {
            console.error('[Admin] RAM 캐시 재장전 중 에러:', err);
          });
        }
      }

      return res.json({ success: true, config: newConfig, themeStatus: 'switched' });
    } else {
      // 빌드 필요 → 비동기 빌드 큐에 추가
      const jobId = ++buildJobCounter;
      buildJobs.set(jobId, { status: 'pending', theme: newThemeRequested });
      buildQueue.push({ jobId, theme: newThemeRequested });

      console.log(`[Admin] 테마 빌드 요청: ${newThemeRequested} (Job #${jobId}, 큐 대기: ${buildQueue.length})`);

      processBuildQueue(); // 큐 처리 시작

      return res.status(202).json({
        success: true,
        config: newConfig,
        themeStatus: 'building',
        jobId,
        message: `테마 "${newThemeRequested}" 빌드가 백그라운드에서 진행 중입니다.`,
      });
    }
  }

  // 테마 변경 없는 일반 config 변경
  // 타일 크기가 변경되었을 수 있으므로 RAM 캐시 재장전
  if (uploadRouterReference && uploadRouterReference.preloadTileCache) {
    const currentTheme = newConfig.currentTheme || 'default_nasa';
    uploadRouterReference.preloadTileCache(newConfig.tileSize, currentTheme).catch(err => {
      console.error('[Admin] RAM 캐시 재장전 중 에러:', err);
    });
  }

  res.json({ success: true, config: newConfig });
});

// GET /api/admin/build-status — 빌드 상태 폴링
router.get('/build-status', (req, res) => {
  const jobId = parseInt(req.query.jobId);

  if (!jobId || !buildJobs.has(jobId)) {
    return res.status(404).json({ error: '해당 빌드 작업을 찾을 수 없습니다.' });
  }

  const job = buildJobs.get(jobId);
  res.json(job);
});

// POST /api/admin/build-db — 수동 빌드 트리거 (기존 API 유지)
router.post('/build-db', async (req, res) => {
  const config = configModule.getConfig();
  const theme = req.body.theme || config.currentTheme || 'default_nasa';

  // 화이트리스트 검증
  const validThemes = getAvailableThemes();
  if (!validThemes.includes(theme)) {
    return res.status(400).json({ error: `유효하지 않은 테마: "${theme}"`, validThemes });
  }

  const jobId = ++buildJobCounter;
  buildJobs.set(jobId, { status: 'pending', theme });
  buildQueue.push({ jobId, theme });

  processBuildQueue();

  res.status(202).json({
    success: true,
    jobId,
    message: `빌드 시작됨 (테마: ${theme})`,
  });
});

module.exports = router;
