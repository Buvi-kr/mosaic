const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const configModule = require('../src/config');

// 테마 인자 지원: node scripts/true.dedup.js <theme_name>
const args = process.argv.slice(2);
const themeName = args[0] || configModule.getConfig().currentTheme || 'default_nasa';

const RAW_TILES_DIR = path.join(__dirname, '../public/raw_tiles', themeName);
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'dedup.log.json');

async function trueDeduplicate() {
  console.log(`🚀 [V4 Multi-Theme] 테마 "${themeName}" 원본 파일 시각적 중복 제거(True Deduplication) 시작...`);
  console.log('주의: 이 작업은 시간이 다소 소요될 수 있으며, 실제 원본 파일을 영구 삭제합니다.\n');

  if (!fs.existsSync(RAW_TILES_DIR)) {
    console.error(`❌ 원본 타일 폴더를 찾을 수 없습니다: ${RAW_TILES_DIR}`);
    return;
  }
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const files = fs.readdirSync(RAW_TILES_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  });

  if (files.length === 0) {
    console.log('❌ 처리할 원본 파일이 없습니다.');
    return;
  }

  console.log(`총 ${files.length}개의 파일을 스캔합니다...`);

  const uniqueImages = []; // { filename, buffer }
  const removedLogs = [];
  let processedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(RAW_TILES_DIR, filename);

    try {
      // Windows EBUSY 에러 해결: sharp가 파일을 물고 있지 않게 먼저 메모리로 읽어옵니다.
      const fileBuffer = fs.readFileSync(filePath);
      
      // 8x8 픽셀로 강제 축소하여 RGB 채널 추출 (64픽셀 * 3채널 = 192바이트 배열)
      const buffer = await sharp(fileBuffer)
        .resize({ width: 8, height: 8, fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer();

      let isDuplicate = false;
      let duplicateOf = null;

      // 기존에 고유하다고 판별된 이미지들과 픽셀(배열) 단위로 대조
      for (let j = 0; j < uniqueImages.length; j++) {
        const u = uniqueImages[j];
        let diffSum = 0;

        for (let k = 0; k < buffer.length; k++) {
          diffSum += Math.abs(buffer[k] - u.buffer[k]);
        }

        // 채널(R,G,B)당 평균 오차가 5 이하면(거의 똑같은 사진이면) 복제본으로 간주
        const avgDiff = diffSum / buffer.length;
        if (avgDiff < 5.0) {
          isDuplicate = true;
          duplicateOf = u.filename;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueImages.push({ filename, buffer });
      } else {
        // 복제본 발견 시 파일 시스템에서 즉시 영구 삭제!
        fs.unlinkSync(filePath);
        removedLogs.push({
          removedFile: filename,
          originalFile: duplicateOf
        });
      }

      processedCount++;
      if (processedCount % 200 === 0) {
        console.log(`⏳ 처리 중... [${processedCount}/${files.length}] (현재 삭제됨: ${removedLogs.length}개)`);
      }
    } catch (err) {
      console.error(`❌ 파일 처리 실패 (${filename}):`, err.message);
    }
  }

  // 삭제 내역 상세 로그 저장
  fs.writeFileSync(LOG_FILE, JSON.stringify({
    timestamp: new Date().toISOString(),
    originalCount: files.length,
    removedCount: removedLogs.length,
    finalCount: uniqueImages.length,
    removedDetails: removedLogs
  }, null, 2), 'utf-8');

  console.log(`\n🎉 원본 폴더(raw_tiles) 물리적 최적화 완료!`);
  console.log(`- 원본 타일 개수: ${files.length}개`);
  console.log(`- 완전히 삭제된 복제본 파일: ${removedLogs.length}개`);
  console.log(`- 최종 남은 고유 원본 개수: ${uniqueImages.length}개`);
  console.log(`- 상세 삭제 내역이 저장되었습니다: ${LOG_FILE}`);
  console.log(`이제 'node pipeline/buildTileDB.js'를 실행하여 DB를 새로 갱신해 주십시오!`);
}

trueDeduplicate();
