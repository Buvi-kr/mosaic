const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 프로젝트 루트 경로
const projectRoot = path.join(__dirname, '..');
const configModule = require(path.join(projectRoot, 'src', 'config'));

async function exportBlenderData(targetFile = null) {
  console.log('====================================================');
  console.log('🚀 [Blender Workspace] 모자이크 3D 데이터 개별 씬 추출');
  console.log('====================================================');

  const config = configModule.getConfig();
  const theme = config.currentTheme || 'default_nasa';
  const tilesDir = path.join(projectRoot, 'public', 'tiles', theme);
  const outputsDir = path.join(projectRoot, 'public', 'outputs');
  const historyDir = path.join(projectRoot, 'logs', 'history');
  const scenesBaseDir = path.join(__dirname, 'scenes');

  if (!fs.existsSync(scenesBaseDir)) {
    fs.mkdirSync(scenesBaseDir, { recursive: true });
  }

  // 입력 소스 이미지 찾기
  let sourceImagePath = targetFile ? path.resolve(targetFile) : (process.argv[2] ? path.resolve(process.argv[2]) : null);

  if (!sourceImagePath || !fs.existsSync(sourceImagePath)) {
    if (fs.existsSync(outputsDir)) {
      const files = fs.readdirSync(outputsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
      if (files.length > 0) {
        files.sort((a, b) => fs.statSync(path.join(outputsDir, b)).mtimeMs - fs.statSync(path.join(outputsDir, a)).mtimeMs);
        sourceImagePath = path.join(outputsDir, files[0]);
      }
    }
  }

  if (!sourceImagePath || !fs.existsSync(sourceImagePath)) {
    console.error('❌ 대상 모자이크 이미지를 찾을 수 없습니다.');
    process.exit(1);
  }

  const baseImageName = path.basename(sourceImagePath);
  const sceneName = path.parse(baseImageName).name; // e.g. mosaic_1787128738607
  const sceneDir = path.join(scenesBaseDir, sceneName);

  if (!fs.existsSync(sceneDir)) {
    fs.mkdirSync(sceneDir, { recursive: true });
  }

  console.log(`📸 대상 모자이크: ${baseImageName}`);
  console.log(`📁 전용 씬 폴더: blender_workspace/scenes/${sceneName}/`);

  // 1. master_mosaic.jpg 복사 (전용 씬 폴더 + 루트 동기화)
  const sceneMasterPath = path.join(sceneDir, 'master_mosaic.jpg');
  const rootMasterPath = path.join(__dirname, 'master_mosaic.jpg');
  fs.copyFileSync(sourceImagePath, sceneMasterPath);
  fs.copyFileSync(sourceImagePath, rootMasterPath);
  console.log(`📋 사진 복사 완료 -> scenes/${sceneName}/master_mosaic.jpg`);

  // 2. 히스토리 로그 JSON 확인
  const logCandidateNames = [
    `log_${baseImageName}.json`,
    `log_${baseImageName}`,
    `log_${sceneName}.json`
  ];

  let logFilePath = null;
  for (const c of logCandidateNames) {
    const full = path.join(historyDir, c);
    if (fs.existsSync(full)) {
      logFilePath = full;
      break;
    }
  }

  let tilePlacements = [];
  let cols = 0;
  let rows = 0;
  let usedTheme = theme;

  if (logFilePath && fs.existsSync(logFilePath)) {
    console.log(`📑 매칭 로그 확인: ${path.basename(logFilePath)}`);
    const logData = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    usedTheme = logData.theme || theme;

    const placements = logData.placements || [];
    let maxCol = 0;
    let maxRow = 0;

    placements.forEach(p => {
      if (p.col > maxCol) maxCol = p.col;
      if (p.row > maxRow) maxRow = p.row;
    });

    cols = maxCol + 1;
    rows = maxRow + 1;

    console.log(`📐 그리드: ${cols} × ${rows} (${placements.length.toLocaleString()}개 타일)`);

    const totalWidth = 20.0;
    const totalHeight = 20.0 * (rows / cols);

    tilePlacements = placements.map((p, idx) => {
      const fullTilePath = path.join(tilesDir, p.filename).replace(/\\/g, '/');
      const gx = cols > 1 ? (p.col / (cols - 1) - 0.5) * totalWidth : 0.0;
      const gy = rows > 1 ? -(p.row / (rows - 1) - 0.5) * totalHeight : 0.0;

      return {
        index: idx,
        row: p.row,
        col: p.col,
        gridX: gx,
        gridY: gy,
        tileId: idx,
        filename: p.filename,
        imagePath: fullTilePath
      };
    });
  } else {
    console.log(`⚠️ 히스토리 로그가 없어 이미지 해상도로 자동 계산합니다.`);
    const tileSize = config.tileSize || 20;
    cols = Math.floor((config.maxResolution || 1080) / tileSize);
    rows = Math.floor((config.maxResolution || 1080) / tileSize);

    const totalWidth = 20.0;
    const totalHeight = 20.0 * (rows / cols);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tilePlacements.push({
          index: r * cols + c,
          row: r,
          col: c,
          gridX: cols > 1 ? (c / (cols - 1) - 0.5) * totalWidth : 0.0,
          gridY: rows > 1 ? -(r / (rows - 1) - 0.5) * totalHeight : 0.0,
          tileId: r * cols + c,
          filename: `tile_${r}_${c}.webp`,
          imagePath: ''
        });
      }
    }
  }

  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const heroIndex = centerRow * cols + centerCol;

  const exportData = {
    metadata: {
      sceneName,
      exportedAt: new Date().toISOString(),
      theme: usedTheme,
      cols,
      rows,
      totalTiles: tilePlacements.length,
      aspectRatio: cols / rows,
      heroTileIndex: heroIndex,
      sourceImage: "master_mosaic.jpg",
      blendMode: config.blendMode || 'multiply',
      secondOpacity: config.secondOpacity !== undefined ? config.secondOpacity : 0.2,
      opacity: config.opacity !== undefined ? config.opacity : 1.0
    },
    tiles: tilePlacements
  };

  // 전용 씬 폴더에 mosaic_data.json 저장 + 루트에도 최신 활성 씬 동기화 저장
  const sceneOutputPath = path.join(sceneDir, 'mosaic_data.json');
  const rootOutputPath = path.join(__dirname, 'mosaic_data.json');

  fs.writeFileSync(sceneOutputPath, JSON.stringify(exportData, null, 2), 'utf8');
  fs.writeFileSync(rootOutputPath, JSON.stringify(exportData, null, 2), 'utf8');

  // 씬 요약 README 생성
  const summaryText = `# 🎬 Scene: ${sceneName}\n\n- **원본 이미지**: \`${baseImageName}\`\n- **그리드**: ${cols} × ${rows}\n- **총 타일 수**: ${tilePlacements.length.toLocaleString()}개\n- **테마**: ${usedTheme}\n- **추출 일시**: ${new Date().toLocaleString('ko-KR')}\n`;
  fs.writeFileSync(path.join(sceneDir, 'README.md'), summaryText, 'utf8');

  console.log(`💾 JSON 데이터 저장 완료 -> scenes/${sceneName}/mosaic_data.json`);
  console.log('====================================================');
  console.log(`✨ [성공] scenes/${sceneName}/ 에 전용 폴더가 생성되었습니다!`);
  console.log('👉 Blender에서 generate_mosaic_scene.py를 실행하세요.');
  console.log('====================================================\n');
}

module.exports = exportBlenderData;

if (require.main === module) {
  exportBlenderData().catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
  });
}
