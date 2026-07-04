const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const convert = require('color-convert').default || require('color-convert');
const configModule = require('../src/config');

const RAW_TILES_DIR = path.join(__dirname, '../public/raw_tiles');
const TILES_DIR = path.join(__dirname, '../public/tiles');
const DB_FILE = path.join(__dirname, '../data/tileDB.json');

async function processTiles() {
  console.log('🚀 [V3 Ultimate] 타일 DB 생성 및 CIE Lab 인덱싱 시작...');

  const config = configModule.getConfig();
  const TILE_SIZE = config.tileSize;

  if (!fs.existsSync(TILES_DIR)) fs.mkdirSync(TILES_DIR, { recursive: true });
  if (!fs.existsSync(path.join(__dirname, '../data'))) fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });

  const files = fs.existsSync(RAW_TILES_DIR) ? fs.readdirSync(RAW_TILES_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
  }) : [];

  if (files.length === 0) {
    console.error('❌ public/raw_tiles 폴더에 파일이 없습니다.');
    return;
  }

  const tileDB = [];
  let count = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const rawPath = path.join(RAW_TILES_DIR, file);
    const tileName = `tile_${count}.jpg`;
    const tilePath = path.join(TILES_DIR, tileName);

    try {
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

      tileDB.push({
        id: count,
        filename: tileName,
        lab: { l: lab[0], a: lab[1], b: lab[2] }
      });

      count++;
      if (count % 200 === 0) {
        console.log(`⏳ 처리 중... [${count}/${files.length}]`);
      }
    } catch (err) {
      console.error(`❌ 파일 처리 실패 (${file}):`, err.message);
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(tileDB, null, 2), 'utf-8');
  console.log(`\n🎉 타일 DB 생성 완료! 총 ${count}개의 타일이 ${DB_FILE}에 저장되었습니다.`);
}

if (require.main === module) {
  processTiles();
}

module.exports = processTiles;
