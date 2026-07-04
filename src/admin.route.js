const express = require('express');
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

router.get('/stats', (req, res) => {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const usedMemPercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
  
  const tileCount = uploadRouterReference ? uploadRouterReference.getTileCount() : 0;
  const qStats = mosaicQueue.getStats();

  res.json({
    tileCount,
    config: configModule.getConfig(),
    system: {
      cpuCores: os.cpus().length,
      memoryUsage: `${usedMemPercent}%`,
      queueLength: qStats.queueLength,
      activeWorkers: qStats.activeWorkers
    }
  });
});

router.post('/config', (req, res) => {
  const newConfig = configModule.updateConfig(req.body);
  
  console.log('\n======================================================');
  console.log(`[Admin] ⚙️ 관리자 설정 라이브 반영 완료!`);
  console.log(` - 최대 해상도 제한: ${newConfig.maxResolution}px`);
  console.log(` - 타일 크기: ${newConfig.tileSize}px`);
  console.log(` - 원본 투명도: ${Math.round(newConfig.opacity * 100)}%`);
  console.log(` - 블렌딩 모드: ${newConfig.blendMode}`);
  console.log('======================================================\n');
  
  const socketManager = require('./socket.manager');
  socketManager.getIo().emit('config_updated', newConfig);

  // 타일 크기가 변경되었을 수 있으므로 즉시 RAM 캐시 재장전 비동기 호출
  if (uploadRouterReference && uploadRouterReference.preloadTileCache) {
    uploadRouterReference.preloadTileCache(newConfig.tileSize).catch(err => {
      console.error('[Admin] RAM 캐시 재장전 중 에러:', err);
    });
  }

  res.json({ success: true, config: newConfig });
});

router.post('/build-db', async (req, res) => {
  try {
    await buildTileDB();
    if (uploadRouterReference) uploadRouterReference.reloadTileDB();
    res.json({ success: true, count: uploadRouterReference ? uploadRouterReference.getTileCount() : 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
