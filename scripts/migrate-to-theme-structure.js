/**
 * 마이그레이션 스크립트: 플랫 구조 → 테마별 하위 폴더 구조
 * 
 * 기존:
 *   public/raw_tiles/*.webp (플랫)
 *   public/tiles/*.jpg (플랫)
 *   data/tileDB.json (단일)
 * 
 * 변경 후:
 *   public/raw_tiles/default_nasa/*.webp
 *   public/tiles/default_nasa/*.jpg
 *   data/themes/default_nasa/tileDB.json
 * 
 * 안전 원칙: 복사 → 검증(파일 수 일치) → 원본 삭제
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const STEPS = [
  {
    name: 'raw_tiles',
    src: path.join(ROOT, 'public/raw_tiles'),
    dest: path.join(ROOT, 'public/raw_tiles/default_nasa'),
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'],
  },
  {
    name: 'tiles',
    src: path.join(ROOT, 'public/tiles'),
    dest: path.join(ROOT, 'public/tiles/default_nasa'),
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
  },
];

const TILEDB_SRC = path.join(ROOT, 'data/tileDB.json');
const TILEDB_DEST_DIR = path.join(ROOT, 'data/themes/default_nasa');
const TILEDB_DEST = path.join(TILEDB_DEST_DIR, 'tileDB.json');

function getImageFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => {
    // 디렉토리는 제외 (이미 마이그레이션된 하위 폴더 등)
    const fullPath = path.join(dir, f);
    if (fs.statSync(fullPath).isDirectory()) return false;
    return extensions.includes(path.extname(f).toLowerCase());
  });
}

function isAlreadyMigrated(step) {
  // src 디렉토리에 이미지 파일이 없고, dest에 파일이 있으면 마이그레이션 완료 상태
  const srcFiles = getImageFiles(step.src, step.extensions);
  const destFiles = fs.existsSync(step.dest) ? getImageFiles(step.dest, step.extensions) : [];
  return srcFiles.length === 0 && destFiles.length > 0;
}

async function migrateStep(step) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📁 [${step.name}] 마이그레이션 시작`);
  console.log(`   소스: ${step.src}`);
  console.log(`   대상: ${step.dest}`);

  // 이미 마이그레이션 된 경우 스킵
  if (isAlreadyMigrated(step)) {
    console.log(`   ✅ 이미 마이그레이션 완료 상태 — 스킵`);
    return { skipped: true };
  }

  const files = getImageFiles(step.src, step.extensions);

  if (files.length === 0) {
    console.log(`   ⚠️  소스에 이미지 파일이 없습니다 — 스킵`);
    return { skipped: true };
  }

  console.log(`   📊 대상 파일 수: ${files.length.toLocaleString()}개`);

  // 1. 대상 폴더 생성
  if (!fs.existsSync(step.dest)) {
    fs.mkdirSync(step.dest, { recursive: true });
    console.log(`   📂 대상 폴더 생성 완료`);
  }

  // 2. 파일 복사 (이동이 아닌 복사 우선)
  let copied = 0;
  let errors = [];

  for (const file of files) {
    try {
      const srcPath = path.join(step.src, file);
      const destPath = path.join(step.dest, file);
      fs.copyFileSync(srcPath, destPath);
      copied++;
      if (copied % 500 === 0) {
        process.stdout.write(`\r   ⏳ 복사 중... ${copied.toLocaleString()} / ${files.length.toLocaleString()}`);
      }
    } catch (err) {
      errors.push({ file, error: err.message });
    }
  }
  console.log(`\r   ✅ 복사 완료: ${copied.toLocaleString()} / ${files.length.toLocaleString()}`);

  if (errors.length > 0) {
    console.error(`   ❌ 복사 실패 ${errors.length}건:`);
    errors.slice(0, 5).forEach(e => console.error(`      - ${e.file}: ${e.error}`));
    if (errors.length > 5) console.error(`      ... 외 ${errors.length - 5}건`);
    throw new Error(`[${step.name}] 복사 실패로 마이그레이션 중단. 원본은 보존됩니다.`);
  }

  // 3. 검증: 대상 폴더 파일 수가 소스와 일치하는지 확인
  const destFiles = getImageFiles(step.dest, step.extensions);
  if (destFiles.length !== files.length) {
    throw new Error(`[${step.name}] 검증 실패! 소스 ${files.length}개 vs 대상 ${destFiles.length}개. 원본은 보존됩니다.`);
  }
  console.log(`   ✅ 검증 통과: 소스 ${files.length}개 = 대상 ${destFiles.length}개`);

  // 4. 원본 삭제 (검증 통과 후에만)
  let deleted = 0;
  for (const file of files) {
    try {
      fs.unlinkSync(path.join(step.src, file));
      deleted++;
    } catch (err) {
      // 삭제 실패는 치명적이지 않음 (복사본은 이미 검증됨)
      console.warn(`   ⚠️  원본 삭제 실패: ${file} — ${err.message}`);
    }
  }
  console.log(`   🗑️  원본 삭제 완료: ${deleted.toLocaleString()}개`);

  return { copied, deleted, errors: errors.length };
}

async function migrateTileDB() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📁 [tileDB] 마이그레이션 시작`);

  // 이미 마이그레이션 된 경우 스킵
  if (fs.existsSync(TILEDB_DEST) && !fs.existsSync(TILEDB_SRC)) {
    console.log(`   ✅ 이미 마이그레이션 완료 상태 — 스킵`);
    return;
  }

  if (!fs.existsSync(TILEDB_SRC)) {
    console.log(`   ⚠️  data/tileDB.json이 존재하지 않습니다 — 스킵`);
    return;
  }

  // 대상 폴더 생성
  if (!fs.existsSync(TILEDB_DEST_DIR)) {
    fs.mkdirSync(TILEDB_DEST_DIR, { recursive: true });
  }

  // 복사 → 검증 → 삭제
  fs.copyFileSync(TILEDB_SRC, TILEDB_DEST);

  // 검증: 파일 크기 비교
  const srcStat = fs.statSync(TILEDB_SRC);
  const destStat = fs.statSync(TILEDB_DEST);
  if (srcStat.size !== destStat.size) {
    throw new Error(`[tileDB] 검증 실패! 소스 ${srcStat.size}B vs 대상 ${destStat.size}B`);
  }

  fs.unlinkSync(TILEDB_SRC);
  console.log(`   ✅ data/tileDB.json → data/themes/default_nasa/tileDB.json 이동 완료 (${(srcStat.size / 1024).toFixed(0)}KB)`);
}

async function main() {
  console.log('\n🚀 멀티테마 구조 마이그레이션 시작');
  console.log('   안전 원칙: 복사 → 검증 → 원본 삭제\n');

  const startTime = Date.now();

  try {
    // Step 1 & 2: raw_tiles, tiles 이동
    for (const step of STEPS) {
      await migrateStep(step);
    }

    // Step 3: tileDB.json 이동
    await migrateTileDB();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 마이그레이션 완료! (${elapsed}초 소요)`);
    console.log(`\n   다음 단계: build.db.js 실행하여 k-d tree 인덱스 생성`);
    console.log(`   $ node scripts/build.db.js default_nasa`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (err) {
    console.error(`\n❌ 마이그레이션 실패: ${err.message}`);
    console.error('   원본 파일은 보존되어 있으므로 안전합니다.');
    process.exit(1);
  }
}

main();
