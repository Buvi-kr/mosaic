const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 프로젝트 루트 경로
const projectRoot = path.join(__dirname, '..');
const configModule = require(path.join(projectRoot, 'src', 'config'));

async function exportBlenderData(targetFile = null, customSceneName = null) {
  console.log('====================================================');
  console.log('🚀 [Blender Workspace] 모자이크 3D 데이터 씬 추출');
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

  // 1. 소스 이미지 찾기
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
  const rawSceneId = path.parse(baseImageName).name; // e.g. mosaic_1787208242539

  // 2. 씬 이름 결정 (사용자 지정 또는 1번사진, 2번사진 형태의 직관적 이름)
  let sceneName = customSceneName || process.argv[3];
  if (!sceneName) {
    // 기존 scenes 디렉토리에서 번호 매기기
    const existing = fs.readdirSync(scenesBaseDir).filter(d => fs.statSync(path.join(scenesBaseDir, d)).isDirectory());
    // 만약 이미 매핑된 폴더가 있다면 찾기
    let found = false;
    for (const d of existing) {
      const dReadme = path.join(scenesBaseDir, d, 'README.md');
      if (fs.existsSync(dReadme)) {
        const text = fs.readFileSync(dReadme, 'utf8');
        if (text.includes(baseImageName)) {
          sceneName = d;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      const nextNum = existing.length + 1;
      sceneName = `${nextNum}번사진`;
    }
  }

  const sceneDir = path.join(scenesBaseDir, sceneName);
  if (!fs.existsSync(sceneDir)) {
    fs.mkdirSync(sceneDir, { recursive: true });
  }

  console.log(`📸 대상 이미지: ${baseImageName}`);
  console.log(`📁 씬 디렉토리: blender_workspace/scenes/${sceneName}/`);

  // 3. master_mosaic.jpg 복사
  const sceneMasterPath = path.join(sceneDir, 'master_mosaic.jpg');
  const rootMasterPath = path.join(__dirname, 'master_mosaic.jpg');
  fs.copyFileSync(sourceImagePath, sceneMasterPath);
  fs.copyFileSync(sourceImagePath, rootMasterPath);
  console.log(`📋 사진 복사 완료 -> scenes/${sceneName}/master_mosaic.jpg`);

  // 4. 간결한 전용 씬 실행 파이썬 러너 생성 ({sceneName}.py)
  const runnerScriptPath = path.join(sceneDir, `${sceneName}.py`);
  const safeSceneDir = sceneDir.replace(/\\/g, '\\\\');
  const runnerCode = `"""
🎬 [${sceneName}] Blender 3D Scene Runner
- 마스터 빌더(generate_mosaic_scene.py)를 ${sceneName} 데이터로 실행합니다.
"""
import os, sys

SCENE_DIR = r"${sceneDir}"
MASTER_SCRIPT = os.path.abspath(os.path.join(SCENE_DIR, "..", "..", "generate_mosaic_scene.py"))

if os.path.exists(MASTER_SCRIPT):
    with open(MASTER_SCRIPT, 'r', encoding='utf-8') as f:
        code = f.read()
    exec(compile(code, MASTER_SCRIPT, 'exec'), {
        'SCENE_DIR': SCENE_DIR,
        '__file__': MASTER_SCRIPT,
        '__name__': '__main__'
    })
else:
    print(f"❌ 마스터 스크립트가 없습니다: {MASTER_SCRIPT}")
`;
  fs.writeFileSync(runnerScriptPath, runnerCode, 'utf8');
  console.log(`📜 간결한 실행 스크립트 생성 -> scenes/${sceneName}/${sceneName}.py`);

  // 5. 히스토리 로그 JSON 확인
  const logCandidateNames = [
    `log_${baseImageName}.json`,
    `log_${baseImageName}`,
    `log_${rawSceneId}.json`
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
      rawSceneId,
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

  // 6. JSON 데이터 저장 (씬 폴더 + 루트 동기화)
  const sceneOutputPath = path.join(sceneDir, 'mosaic_data.json');
  const rootOutputPath = path.join(__dirname, 'mosaic_data.json');

  fs.writeFileSync(sceneOutputPath, JSON.stringify(exportData, null, 2), 'utf8');
  fs.writeFileSync(rootOutputPath, JSON.stringify(exportData, null, 2), 'utf8');

  console.log(`💾 JSON 데이터 저장 완료 -> scenes/${sceneName}/mosaic_data.json`);
  console.log('====================================================');
  console.log(`✨ [성공] scenes/${sceneName}/ 폴더가 준비되었습니다!`);
  console.log(`👉 Blender에서 scenes/${sceneName}/${sceneName}.py 를 실행하세요.`);
  console.log('====================================================\n');

  return { sceneName, sceneDir };
}

module.exports = exportBlenderData;

if (require.main === module) {
  exportBlenderData().catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
  });
}
