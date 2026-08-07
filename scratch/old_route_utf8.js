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

// ===== ?뚮쭏蹂?寃쎈줈 ?ы띁 =====
function themeDataPaths(theme) {
  return {
    tileDBFile: path.join(DB_ROOT, theme, 'tileDB.json'),
    kdTreeFile: path.join(DB_ROOT, theme, 'tileIndex.kdtree.json'),
    tilesDir: path.join(FRONTEND_DIR, 'tiles', theme),
  };
}

// ===== tileDB + k-d tree 濡쒕뵫 =====
function loadTileDB(theme) {
  if (!theme) {
    const config = configModule.getConfig();
    theme = config.currentTheme || 'default_nasa';
  }

  const paths = themeDataPaths(theme);

  // tileDB 濡쒕뱶
  if (fs.existsSync(paths.tileDBFile)) {
    globalTileDB = JSON.parse(fs.readFileSync(paths.tileDBFile, 'utf-8'));
    console.log(`[tileDB] ?뚮쭏 "${theme}" 濡쒕뱶 ?꾨즺: ${globalTileDB.length.toLocaleString()}媛????);
  } else {
    console.warn(`[tileDB] ?뚮쭏 "${theme}"??tileDB媛 議댁옱?섏? ?딆뒿?덈떎: ${paths.tileDBFile}`);
    globalTileDB = [];
  }

  // k-d tree 濡쒕뱶
  if (fs.existsSync(paths.kdTreeFile)) {
    try {
      globalKDTree = JSON.parse(fs.readFileSync(paths.kdTreeFile, 'utf-8'));
      console.log(`[tileDB] k-d tree ?몃뜳??濡쒕뱶 ?꾨즺`);
    } catch (e) {
      console.warn(`[tileDB] k-d tree ?뚯떛 ?ㅽ뙣:`, e.message);
      globalKDTree = null;
    }
  } else {
    console.warn(`[tileDB] k-d tree ?몃뜳?ㅺ? ?놁뒿?덈떎 ??釉뚮（?명룷???대갚`);
    globalKDTree = null;
  }

  currentLoadedTheme = theme;

  // ?뚯빱 ? 珥덇린???먮뒗 ?낅뜲?댄듃
  if (mosaicQueue.initialized) {
    mosaicQueue.broadcastTileDBUpdate(globalTileDB, globalKDTree);
  } else {
    mosaicQueue.initPool(globalTileDB, globalKDTree);
  }
}

// 理쒖큹 濡쒕뱶
loadTileDB();

// ?몃??먯꽌 DB 由щ줈??媛?ν븯寃??몄텧
router.reloadTileDB = loadTileDB;
router.getTileCount = () => globalTileDB.length;

// ===== ????대?吏 RAM 罹먯떆 =====
async function preloadTileCache(targetTileSize, theme) {
  if (!theme) {
    const config = configModule.getConfig();
    theme = config.currentTheme || 'default_nasa';
  }

  const paths = themeDataPaths(theme);

  // ?뚮쭏媛 諛붾뚯뿀嫄곕굹 ?ъ씠利덇? 諛붾뚮㈃ 罹먯떆 ?꾩껜 flush
  if (currentLoadedTheme !== theme || globalCachedTileSize !== targetTileSize) {
    globalTileCache.clear();
    globalCachedTileSize = targetTileSize;
    console.log(`[罹먯떆] ?뚮쭏 ?꾪솚?쇰줈 ???罹먯떆 ?꾩껜 flush (${theme}, ${targetTileSize}px)`);
  }

  // Lazy Loading?쇰줈 ?꾪솚?섏뿀?쇰?濡??꾩껜 ?ъ쟾 ?곸옱???앸왂?⑸땲??
}

// 理쒖큹 ?ㅼ젙媛?湲곗??쇰줈 利됱떆 ?μ쟾 ?쒖옉 (renderTileSize濡??곸옱)
const initialConfig = configModule.getConfig();
preloadTileCache(initialConfig.renderTileSize || 200, initialConfig.currentTheme || 'default_nasa');

// ?몃??먯꽌 ?ㅼ젙 蹂寃????ъ옣??媛?ν븯?꾨줉 ?몄텧
router.preloadTileCache = preloadTileCache;

// ===== ?낅줈??諛?紐⑥옄?댄겕 ?앹꽦 =====
router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '?ъ쭊 ?꾨씫' });
  if (globalTileDB.length === 0) return res.status(500).json({ error: '????곗씠??DB)媛 議댁옱?섏? ?딆뒿?덈떎.' });

  const config = configModule.getConfig();
  // 洹몃━??諛??(媛???⑥쐞). ?묒쓣?섎줉 紐⑥옄?댄겕 移몄닔(媛濡??몃줈 ?μ닔)媛 ??쬆??  const TILE_SIZE = config.tileSize || 20; 
  // ?ㅼ젣 ????뚮뜑留?臾쇰━???붿쭏 (?쎌?). (理쒖쥌 罹붾쾭???댁긽????쬆???먯씤)
  const RENDER_TILE_SIZE = config.renderTileSize || 200; 
  // 媛??洹몃━???댁긽??湲곗?. (?ㅼ젣 異쒕젰臾??ш린媛 ?꾨떂, 移몄닔瑜?怨꾩궛?섍린 ?꾪븳 媛???꾪솕吏)
  const MAX_RES = config.maxResolution || 1920;

  const sessionId = req.query.sessionId || req.body.sessionId || null;
  const io = socketManager.getIo();

  try {
    const startTime = Date.now();

    // 1. ?먮낯 鍮꾩쑉 ?뚯븙 諛?媛??洹몃━??MAX_RES) 湲곗??쇰줈 媛???쎌? ?ㅼ??쇰쭅
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

    // 2. 媛濡??몃줈 紐⑥옄?댄겕 移????μ닔) 怨꾩궛 (Density)
    // ?? targetWidth媛 1920?닿퀬 TILE_SIZE媛 20?대㈃ 媛濡쒕줈 96?μ쓽 ??쇱씠 ?ㅼ뼱媛?    const cols = Math.floor(targetWidth / TILE_SIZE);
    const rows = Math.floor(targetHeight / TILE_SIZE);
    
    // Safety Cap: 罹붾쾭??媛濡쒓? 15000px??珥덇낵?섎㈃ ?쒕쾭 硫붾え由ш? ?곗쭏 ???덉쑝誘濡?????ш린瑜?媛뺤젣濡???땄
    let safeRenderTileSize = RENDER_TILE_SIZE;
    if (cols * safeRenderTileSize > 15000) {
      safeRenderTileSize = Math.floor(15000 / cols);
      if (safeRenderTileSize < TILE_SIZE) safeRenderTileSize = TILE_SIZE; // 理쒖냼??留ㅼ묶 ?ъ씠利덈낫?ㅻ뒗 ?щ룄濡?蹂댁옣
      console.warn(`[OOM 蹂댄샇] 理쒖쥌 罹붾쾭?ㅺ? ?덈Т 嫄곕??⑸땲?? RENDER_TILE_SIZE 媛뺤젣 ?섑뼢 議곗젙: ${RENDER_TILE_SIZE}px -> ${safeRenderTileSize}px`);
    }

    const CANVAS_W = cols * TILE_SIZE;
    const CANVAS_H = rows * TILE_SIZE;
    const totalCells = cols * rows;

    const originalResized = await sharp(req.file.buffer)
      .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover' })
      .toBuffer();

    // 2. ?쎌? ?곗씠??異붿텧
    const { data: rawData, info } = await sharp(originalResized).raw().toBuffer({ resolveWithObject: true });

    // 3. Worker Thread Queue???묒뾽 ?깅줉
    const workerJobData = {
      rawData,
      info,
      cols,
      rows,
      tileSize: TILE_SIZE,
      globalTileDB,  // 怨좎젙 ? 紐⑤뱶?먯꽌??臾댁떆??(?뚯빱 ?대? 李몄“ ?ъ슜)
      kdTree: globalKDTree,
      config: {
        maxTileUsage: config.maxTileUsage,
        banRadius: config.banRadius,
        candidatePoolSize: config.candidatePoolSize,
      }
    };

    // 吏꾪뻾 ?곹솴 ?뚮┝
    if (sessionId) {
      io.to(sessionId).emit('mosaic_progress', {
        phase: 'matching',
        message: '??쇱쓣 留ㅼ묶?섎뒗 以?..',
        percent: 0
      });
    }

    const { matchedTiles } = await mosaicQueue.addJob(workerJobData);

    // 4. 紐⑥옄?댄겕 踰좎씠???⑹꽦 (怨좏솕吏?????ъ슜)
    const canvasWidth = cols * safeRenderTileSize;
    const canvasHeight = rows * safeRenderTileSize;
    const rawCanvas = Buffer.alloc(canvasWidth * canvasHeight * 3);

    // ????대?吏 罹먯떆 ?뺤씤 & ?꾨씫遺?濡쒕뱶
    const currentTheme = config.currentTheme || 'default_nasa';
    const tilesDir = path.join(FRONTEND_DIR, 'tiles', currentTheme);

    if (globalCachedTileSize !== safeRenderTileSize) {
      globalTileCache.clear();
      globalCachedTileSize = safeRenderTileSize;
    }

    const uniqueFilenames = [...new Set(matchedTiles.map(t => t.filename))];
    const missingFilenames = uniqueFilenames.filter(f => !globalTileCache.has(f));

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
          globalTileCache.set(filename, tileRaw);
        } catch (err) {
          // ?뚯씪 ?꾨씫 ???ㅽ궢
        }
      }));
    }

    // 吏꾪뻾 ?곹솴: ?⑹꽦 ?쒖옉
    if (sessionId) {
      io.to(sessionId).emit('mosaic_progress', {
        phase: 'compositing',
        message: '??쇱쓣 議고빀?섎뒗 以?..',
        percent: 10,
        placedCount: 0,
        totalCount: matchedTiles.length
      });
    }

    // 硫붾え由?罹먯떆瑜??댁슜??罹붾쾭?ㅼ뿉 ?쎌? ??뼱?곌린
    for (let i = 0; i < matchedTiles.length; i++) {
      const t = matchedTiles[i];
      const tileRaw = globalTileCache.get(t.filename);
      if (!tileRaw) continue; // 罹먯떆 ?꾨씫 ???ㅽ궢
      
      // 留ㅼ묶 醫뚰몴(tileSize 湲곗?)瑜?safeRenderTileSize 湲곗??쇰줈 ?ㅼ??쇰쭅
      const renderLeft = Math.floor(t.left / TILE_SIZE) * safeRenderTileSize;
      const renderTop = Math.floor(t.top / TILE_SIZE) * safeRenderTileSize;
      
      for (let y = 0; y < safeRenderTileSize; y++) {
        const destOffset = ((renderTop + y) * canvasWidth + renderLeft) * 3;
        const srcOffset = y * safeRenderTileSize * 3;
        tileRaw.copy(rawCanvas, destOffset, srcOffset, srcOffset + safeRenderTileSize * 3);
      }
    }

    // 5. 釉붾젋??    let finalImageBuffer;

    if (config.opacity > 0) {
      const baseOriginal = await sharp(req.file.buffer)
        .resize({ width: canvasWidth, height: canvasHeight, fit: 'cover' })
        .toBuffer();

      const tilesBuffer = await sharp(rawCanvas, {
        raw: { width: canvasWidth, height: canvasHeight, channels: 3 }
      }).png().toBuffer();

      let fullyBlendedBuffer;
      if (config.blendMode === 'over') {
        // 'over' 紐⑤뱶???⑥닚???먮낯 ?ъ쭊?쇰줈 ??뼱?곕뒗 紐⑤뱶?대?濡??먮낯 ?대?吏 洹몃?濡?諛섑솚
        fullyBlendedBuffer = baseOriginal;
      } else if (config.blendMode === 'multiply') {
        // multiply??援먰솚踰뺤튃???깅┰?섎?濡??먮낯 ?꾩뿉 ??쇱쓣 怨깊빀
        fullyBlendedBuffer = await sharp(baseOriginal)
          .composite([{ input: tilesBuffer, blend: 'multiply' }])
          .toBuffer();
        
        // ?댁쨷 ?섏씠釉뚮━??蹂듭썝
        if (config.secondOpacity > 0) {
          const secondAlphaVal = Math.max(0, Math.min(255, Math.round(255 * config.secondOpacity)));
          const secondTransparentOriginal = await sharp(baseOriginal)
            .ensureAlpha()
            .composite([{
              input: Buffer.from([255, 255, 255, secondAlphaVal]),
              raw: { width: 1, height: 1, channels: 4 },
              tile: true,
              blend: 'dest-in'
            }]).png().toBuffer();
          fullyBlendedBuffer = await sharp(fullyBlendedBuffer)
            .composite([{ input: secondTransparentOriginal, blend: 'over' }])
            .toBuffer();
        }
      } else {
        // Overlay, Soft-light ???덉씠???쒖꽌媛 以묒슂??紐⑤뱶: ?먮낯(諛곌꼍) ?꾩뿉 ???Foreground) ?⑹꽦
        fullyBlendedBuffer = await sharp(baseOriginal)
          .composite([{ input: tilesBuffer, blend: config.blendMode }])
          .toBuffer();
      }

      // 理쒖쥌?곸쑝濡??ъ슜?먭? ?ㅼ젙???щ챸??opacity)留뚰겮留?釉붾젋???④낵 ?곸슜
      // A(?쒖닔 ??? ?꾩뿉 B(?꾩쟾 ?⑹꽦蹂?瑜??щ챸?꾨? 以섏꽌 ??쓬
      const alphaVal = Math.max(0, Math.min(255, Math.round(255 * config.opacity)));
      const transparentBlended = await sharp(fullyBlendedBuffer)
        .ensureAlpha()
        .composite([{
          input: Buffer.from([255, 255, 255, alphaVal]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in'
        }]).png().toBuffer();

      finalImageBuffer = await sharp(tilesBuffer)
        .composite([{ input: transparentBlended, blend: 'over' }])
        .jpeg({ quality: 95 })
        .toBuffer();

    } else {
      finalImageBuffer = await sharp(rawCanvas, {
        raw: { width: canvasWidth, height: canvasHeight, channels: 3 }
      }).jpeg({ quality: 95 }).toBuffer();
    }

    const outputFilename = `mosaic_${Date.now()}.jpg`;
    
    if (!fs.existsSync(OUTPUTS_DIR)) {
      fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    }
    
    await sharp(finalImageBuffer).toFile(path.join(OUTPUTS_DIR, outputFilename));

    // --- ????ъ슜 ?듦퀎 諛?濡쒓렇 ---
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
    console.log(`??紐⑥옄?댄겕 ?꾨즺! ${outputFilename} [${canvasWidth}x${canvasHeight}] (${elapsed}s ?뚯슂, ?뚮쭏: ${currentTheme})`);
    console.log(`   ?뱤 珥?${totalCells.toLocaleString()}移?諛곗튂 / 怨좎쑀 ???${sortedUsage.length.toLocaleString()} / ${totalTilesInDB.toLocaleString()}醫??ъ슜 (?쒖슜瑜?${usageRate}%)`);

    // ?붽컙 ?듦퀎 濡쒓퉭
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dateString = `${yyyy}-${mm}`;

      const statsFile = path.join(__dirname, `../logs/stats_${dateString}.log`);

      const kstTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const logLine = `[${kstTime}] ?덈줈??紐⑥옄?댄겕 ?꾩꽦 (?뚯슂?쒓컙: ${elapsed}s, ?댁긽?? ${canvasWidth}x${canvasHeight}, 怨좎쑀 ??? ${sortedUsage.length}醫? ?뚮쭏: ${currentTheme})\n`;
      fs.appendFileSync(statsFile, logLine);
    } catch (e) {
      console.error('?붽컙 ?듦퀎 濡쒓퉭 ?ㅽ뙣:', e);
    }

    // ?낅줈???대씪?댁뼵?몄뿉 ?꾨즺 ?뚮┝
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

    // ?붿뒪?뚮젅?댁뿉 ?몄떆
    socketManager.getIo().emit('new_mosaic', {
      imageUrl: `/outputs/${outputFilename}`,
      tileSize: TILE_SIZE,
      width: CANVAS_W,
      height: CANVAS_H
    });

    res.json({ success: true, imageUrl: `/outputs/${outputFilename}`, timeElapsed: elapsed });

  } catch (err) {
    console.error('??泥섎━ ?먮윭:', err);
    try {
      const logPath = path.join(__dirname, '../logs/server.error.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR in /api/upload: ${err.stack || err.message}\n`);
    } catch (e) { }
    res.status(500).json({ error: '?쒕쾭 ?먮윭媛 諛쒖깮?덉뒿?덈떎.' });
  }
});

module.exports = router;
