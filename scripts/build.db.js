const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const convert = require('color-convert').default || require('color-convert');
const configModule = require('../src/config');
const KDTree = require('../src/kdtree');

const ROOT = path.join(__dirname, '..');

// ===== 경로 헬퍼 =====
function themePaths(themeName) {
  return {
    rawDir: path.join(ROOT, 'public/raw_tiles', themeName),
    tilesDir: path.join(ROOT, 'public/tiles', themeName),
    dataDir: path.join(ROOT, 'data/themes', themeName),
    tileDBFile: path.join(ROOT, 'data/themes', themeName, 'tileDB.json'),
    kdTreeFile: path.join(ROOT, 'data/themes', themeName, 'tileIndex.kdtree.json'),
  };
}

// ===== 메인 빌드 함수 =====
async function processTiles(themeName, options = {}) {
  const { indexOnly = false } = options;
  const config = configModule.getConfig();
  const TILE_SIZE = config.tileSize || 20;
  const MIN_REQUIRED = config.minRequiredTiles || 3000;
  const BATCH_SIZE = 30; // 동시 처리 배치 크기

  const paths = themePaths(themeName);

  console.log(`\n🚀 [빌드] 테마 "${themeName}" 빌드 시작...`);
  console.log(`   - 소스: ${paths.rawDir}`);
  console.log(`   - 출력: ${paths.tilesDir}`);
  console.log(`   - 데이터: ${paths.dataDir}`);

  // --index-only 모드: 기존 tileDB에서 k-d tree만 생성
  if (indexOnly) {
    return buildIndexOnly(paths, themeName);
  }

  // 소스 검증
  if (!fs.existsSync(paths.rawDir)) {
    throw new Error(`소스 폴더가 존재하지 않습니다: ${paths.rawDir}`);
  }

  const files = fs.readdirSync(paths.rawDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext);
  });

  if (files.length === 0) {
    throw new Error(`소스 폴더에 이미지가 없습니다: ${paths.rawDir}`);
  }

  console.log(`   - 총 파일 수: ${files.length.toLocaleString()}개`);
  console.log(`   - 타일 크기: ${TILE_SIZE}px`);
  console.log(`   - 배치 크기: ${BATCH_SIZE}개씩 병렬 처리\n`);

  // 출력 폴더 생성
  [paths.tilesDir, paths.dataDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const tileDB = [];
  const startTime = Date.now();
  let count = 0;
  let errors = 0;

  // Promise.all 배치 병렬화 (순차 for 루프 대체)
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(batch.map(async (file) => {
      const rawPath = path.join(paths.rawDir, file);
      const tileId = count + batch.indexOf(file);
      // 파일명 충돌 방지: 원본 파일명 기반 (확장자만 통일)
      const baseName = path.basename(file, path.extname(file));
      const tileName = `tile_${baseName}.jpg`;
      const tilePath = path.join(paths.tilesDir, tileName);

      const buffer = await sharp(rawPath)
        .resize({ width: TILE_SIZE, height: TILE_SIZE, fit: 'cover' })
        .toFormat('jpeg')
        .toBuffer();

      await sharp(buffer).toFile(tilePath);

      const stats = await sharp(buffer).stats();
      const r = stats.channels[0].mean;
      const g = stats.channels[1].mean;
      const b = stats.channels[2].mean;
      const lab = convert.rgb.lab(r, g, b);

      return {
        filename: tileName,
        lab: { l: lab[0], a: lab[1], b: lab[2] }
      };
    }));

    // 배치 결과 수집
    for (const result of results) {
      if (result.status === 'fulfilled') {
        tileDB.push({
          id: count,
          ...result.value,
        });
        count++;
      } else {
        errors++;
        if (errors <= 5) {
          console.error(`   ❌ 처리 실패: ${result.reason.message}`);
        }
      }
    }

    // 진행률 표시
    const processed = Math.min(i + BATCH_SIZE, files.length);
    const pct = ((processed / files.length) * 100).toFixed(0);
    process.stdout.write(`\r   ⏳ [${pct}%] ${count.toLocaleString()} / ${files.length.toLocaleString()} 완료`);
  }

  const buildElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n   ✅ 타일 처리 완료: ${count.toLocaleString()}개 (${buildElapsed}초, 실패 ${errors}개)\n`);

  // tileDB 저장
  fs.writeFileSync(paths.tileDBFile, JSON.stringify(tileDB, null, 2), 'utf-8');
  console.log(`   💾 tileDB 저장: ${paths.tileDBFile} (${(Buffer.byteLength(JSON.stringify(tileDB)) / 1024).toFixed(0)}KB)`);

  // k-d tree 빌드 & 저장
  console.log(`   🌳 k-d tree 인덱스 빌드 중...`);
  const kdTreeStart = Date.now();
  const kdTree = KDTree.build(tileDB);
  const kdTreeJson = JSON.stringify(kdTree);
  fs.writeFileSync(paths.kdTreeFile, kdTreeJson, 'utf-8');
  const kdElapsed = ((Date.now() - kdTreeStart) / 1000).toFixed(2);
  console.log(`   💾 k-d tree 저장: ${paths.kdTreeFile} (${(Buffer.byteLength(kdTreeJson) / 1024).toFixed(0)}KB, ${kdElapsed}초)`);

  // 품질 검사 결과 생성
  const buildResult = generateBuildResult(tileDB, count, errors, MIN_REQUIRED, themeName, buildElapsed);

  printBuildResult(buildResult);

  return buildResult;
}

// --index-only 모드: 이미지 재처리 없이 기존 tileDB에서 k-d tree만 생성
async function buildIndexOnly(paths, themeName) {
  console.log(`   🔧 --index-only 모드: 기존 tileDB에서 k-d tree만 생성\n`);

  if (!fs.existsSync(paths.tileDBFile)) {
    throw new Error(`tileDB가 존재하지 않습니다: ${paths.tileDBFile}. 먼저 전체 빌드를 실행하세요.`);
  }

  const tileDB = JSON.parse(fs.readFileSync(paths.tileDBFile, 'utf-8'));
  console.log(`   📊 기존 tileDB 로드: ${tileDB.length.toLocaleString()}개 엔트리`);

  // 데이터 디렉토리 확인
  if (!fs.existsSync(paths.dataDir)) {
    fs.mkdirSync(paths.dataDir, { recursive: true });
  }

  const kdTreeStart = Date.now();
  const kdTree = KDTree.build(tileDB);
  const kdTreeJson = JSON.stringify(kdTree);
  fs.writeFileSync(paths.kdTreeFile, kdTreeJson, 'utf-8');
  const kdElapsed = ((Date.now() - kdTreeStart) / 1000).toFixed(2);
  console.log(`   💾 k-d tree 저장: ${paths.kdTreeFile} (${(Buffer.byteLength(kdTreeJson) / 1024).toFixed(0)}KB, ${kdElapsed}초)`);

  return {
    theme: themeName,
    tileCount: tileDB.length,
    indexOnly: true,
    success: true,
  };
}

// 품질 검사 결과 생성
function generateBuildResult(tileDB, count, errors, minRequired, themeName, elapsed) {
  const result = {
    theme: themeName,
    tileCount: count,
    errors,
    elapsed: `${elapsed}s`,
    success: true,
    warning: false,
    lowDiversityWarning: false,
    warningMessages: [],
  };

  // 타일 수 부족 경고
  if (count < minRequired) {
    result.warning = true;
    result.warningMessages.push(
      `타일 수가 권장 최소치(${minRequired.toLocaleString()})에 미달합니다: ${count.toLocaleString()}개`
    );
  }

  // Lab 색상 분산 분석 (표준편차)
  if (tileDB.length > 0) {
    const labDims = ['l', 'a', 'b'];
    const stds = {};

    for (const dim of labDims) {
      const values = tileDB.map(t => t.lab[dim]);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
      stds[dim] = Math.sqrt(variance);
    }

    const avgStd = (stds.l + stds.a + stds.b) / 3;

    // 평균 표준편차가 10 미만이면 색상 편중 경고
    if (avgStd < 10) {
      result.lowDiversityWarning = true;
      result.warning = true;
      result.warningMessages.push(
        `색상 다양성이 낮습니다 (Lab 평균 표준편차: ${avgStd.toFixed(1)}). 모자이크 품질이 저하될 수 있습니다.`
      );
    }

    result.labStats = {
      stdL: stds.l.toFixed(1),
      stdA: stds.a.toFixed(1),
      stdB: stds.b.toFixed(1),
      avgStd: avgStd.toFixed(1),
    };
  }

  return result;
}

function printBuildResult(result) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 [${result.theme}] 빌드 완료!`);
  console.log(`   - 타일 수: ${result.tileCount.toLocaleString()}개`);
  console.log(`   - 소요 시간: ${result.elapsed}`);

  if (result.labStats) {
    console.log(`   - Lab 분산: L=${result.labStats.stdL} / a=${result.labStats.stdA} / b=${result.labStats.stdB} (평균: ${result.labStats.avgStd})`);
  }

  if (result.warning) {
    console.log(`\n   ⚠️  경고:`);
    result.warningMessages.forEach(msg => console.log(`      - ${msg}`));
  }

  console.log(`${'='.repeat(60)}\n`);
}

// ===== CLI 실행 =====
if (require.main === module) {
  const args = process.argv.slice(2);
  const indexOnly = args.includes('--index-only');
  const themeName = args.filter(a => !a.startsWith('--'))[0]
    || configModule.getConfig().currentTheme
    || 'default_nasa';

  console.log(`\n📌 테마: ${themeName}${indexOnly ? ' (index-only 모드)' : ''}`);

  processTiles(themeName, { indexOnly })
    .then(result => {
      if (result.success === false) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(`\n❌ 빌드 실패: ${err.message}`);
      process.exit(1);
    });
}

module.exports = processTiles;
