const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const convert = require('color-convert').default || require('color-convert');

// 프로젝트 루트 경로
const projectRoot = path.join(__dirname, '..');
const KDTree = require(path.join(projectRoot, 'src', 'kdtree'));
const configModule = require(path.join(projectRoot, 'src', 'config'));

async function exportBlenderData() {
  console.log('====================================================');
  console.log('🚀 [Blender Workspace] 모자이크 3D 데이터 추출 시작');
  console.log('====================================================');

  const config = configModule.getConfig();
  const theme = config.currentTheme || 'default_nasa';
  const themeDir = path.join(projectRoot, 'data', 'themes', theme);
  const tilesDir = path.join(projectRoot, 'public', 'tiles', theme);
  const tileDBPath = path.join(themeDir, 'tileDB.json');

  if (!fs.existsSync(tileDBPath)) {
    console.error(`❌ tileDB를 찾을 수 없습니다: ${tileDBPath}`);
    process.exit(1);
  }

  const tileDB = JSON.parse(fs.readFileSync(tileDBPath, 'utf8'));
  console.log(`✅ 테마: [${theme}] | DB 타일 수: ${tileDB.length.toLocaleString()}개`);

  // 입력 소스 이미지 찾기 (CLI 인자 우선, 없으면 가장 최근 output)
  let sourceImagePath = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const outputsDir = path.join(projectRoot, 'public', 'outputs');

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
    console.warn('⚠️ 생성된 모자이크 결과물이 없어 기본 설정으로 추출합니다.');
  } else {
    console.log(`📸 원본 소스 이미지: ${path.basename(sourceImagePath)}`);
    // 완성본 이미지를 blender_workspace 안으로 master_mosaic.jpg로 자동 복사
    const destMasterPath = path.join(__dirname, 'master_mosaic.jpg');
    fs.copyFileSync(sourceImagePath, destMasterPath);
    console.log(`📋 완성본 사진 복사 완료 -> blender_workspace/master_mosaic.jpg`);
  }

  // 그리드 스펙 계산 (기본 1080x1080 해상도에 tileSize 20 = 54x54 = 2,916 타일)
  const targetRes = config.maxResolution || 1080;
  const tileSize = config.tileSize || 20;
  const cols = Math.floor(targetRes / tileSize);
  const rows = Math.floor(targetRes / tileSize);
  const totalCells = cols * rows;

  console.log(`📐 그리드: ${cols} × ${rows} (${totalCells.toLocaleString()}개 타일 슬롯)`);

  // KDTree 로드
  const treePath = path.join(themeDir, 'tileIndex.kdtree.json');
  let kdTree = null;
  if (fs.existsSync(treePath)) {
    kdTree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
  }

  const tilePlacements = [];
  const MAX_USAGE = config.maxTileUsage || 6;
  const usageMap = new Map();

  let rawPixels = null;
  if (sourceImagePath && fs.existsSync(sourceImagePath)) {
    const resized = await sharp(sourceImagePath)
      .resize(cols, rows, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
    rawPixels = resized;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let bestTile = null;

      if (rawPixels && kdTree) {
        const idx = (r * cols + c) * 3;
        const rgb = [rawPixels[idx], rawPixels[idx + 1], rawPixels[idx + 2]];
        const lab = convert.rgb.lab(rgb);

        const candidates = KDTree.kNearest(kdTree, [lab[0], lab[1], lab[2]], 20);
        for (const cand of candidates) {
          const tileItem = tileDB[cand.idx];
          if (!tileItem) continue;
          const count = usageMap.get(tileItem.id) || 0;
          if (count < MAX_USAGE) {
            bestTile = tileItem;
            usageMap.set(tileItem.id, count + 1);
            break;
          }
        }
        if (!bestTile && candidates.length > 0) {
          bestTile = tileDB[candidates[0].idx];
        }
      }

      if (!bestTile) {
        const randomIdx = (r * cols + c) % tileDB.length;
        bestTile = tileDB[randomIdx];
      }

      const fullTilePath = path.join(tilesDir, bestTile.filename).replace(/\\/g, '/');

      tilePlacements.push({
        index: r * cols + c,
        row: r,
        col: c,
        gridX: (c / (cols - 1) - 0.5) * 20.0,
        gridY: -(r / (rows - 1) - 0.5) * 20.0,
        tileId: bestTile.id,
        filename: bestTile.filename,
        imagePath: fullTilePath,
        colorLab: bestTile.lab
      });
    }
  }

  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const heroIndex = centerRow * cols + centerCol;

  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      theme,
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

  const outputWorkspacePath = path.join(__dirname, 'mosaic_data.json');
  fs.writeFileSync(outputWorkspacePath, JSON.stringify(exportData, null, 2), 'utf8');

  console.log(`\n🎉 [완료] blender_workspace 안에 모든 3D 데이터가 추출되었습니다:`);
  console.log(`📁 ${outputWorkspacePath}`);
  console.log(`✨ 총 타일 수: ${tilePlacements.length.toLocaleString()}개 | 주인공 타일: #${heroIndex}`);
  console.log('====================================================\n');
}

exportBlenderData().catch(err => {
  console.error('❌ 에러 발생:', err);
  process.exit(1);
});
