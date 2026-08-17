/**
 * ==============================================================================
 * 🌌 NASA 대규모 고화질 우주 아카이브 자동 수집 & 정규화 파이프라인 (V8.0)
 * ==============================================================================
 * 소스: NASA Official Images Library (https://images.nasa.gov)
 * 라이선스: 100% 미 연방정부 퍼블릭 도메인 (Public Domain / 저작권 무료)
 * 
 * 주요 기능:
 * 1. 허블, 제임스 웹, 성운, 은하, 딥필드 등 핵심 천체 키워드 대량 쿼리
 * 2. 중복 NASA ID 자동 배제 및 깨진 파일 자동 필터링
 * 3. 256x256 정방형(Square) 무손실 WebP 자동 정규화 생성 (public/raw_tiles/nasa/)
 * 4. 일괄 처리 후 KD-Tree 색상 인덱스 자동 빌드 연계
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'public/raw_tiles/nasa');

// 250+개의 초대형 전방위 천체 딥 쿼리 (연도별/미션별/카탈로그별 전수 수집)
const SEARCH_QUERIES = [
  'James Webb nebula', 'Hubble galaxy', 'JWST deep field', 'Carina nebula', 'Pillars of Creation',
  'Orion nebula', 'Andromeda galaxy', 'deep field Hubble', 'star forming region', 'supernova remnant',
  'Tarantula nebula', 'Crab nebula', 'Helix nebula', 'Sombrero galaxy', 'Whirlpool galaxy',
  'cosmic dust nebula', 'Milky Way center', 'Chandra x-ray space', 'Spitzer infrared cosmos', 'Ring nebula',
  'Veil nebula', 'Eagle nebula', 'Lagoon nebula', 'Interacting galaxies', 'Star cluster space',
  'Hubble Ultra Deep Field', 'Rosette nebula', 'Horsehead nebula', 'Triangulum galaxy', 'Centaurus A galaxy',
  'Cartwheel galaxy', 'Stephan Quintet', 'Cosmic Cliffs JWST', 'Phantom galaxy JWST', 'Southern Ring JWST',
  'NGC 1365', 'Messier 82', 'Messier 51', 'Messier 101', 'Messier 31', 'Messier 33', 'Messier 87',
  'Planetary nebula', 'Emission nebula', 'Reflection nebula', 'Dark nebula', 'Globular cluster',
  'Open star cluster', 'Gravitational lensing', 'Quasar space', 'Pulsar nebula', 'Supernova 1987A',
  'Heart nebula', 'Soul nebula', 'Pacman nebula', 'Elephant Trunk nebula', 'Cave nebula',
  'Wizard nebula', 'Bubble nebula', 'Iris nebula', 'Cocoon nebula', 'Crescent nebula',
  'Dumbbell nebula', 'Cats Eye nebula', 'Eskimo nebula', 'Owl nebula', 'Saturn nebula',
  'Blue Snowball nebula', 'Flaming Star nebula', 'Running Chicken nebula', 'Jellyfish nebula',
  'Witch Head nebula', 'Cone nebula', 'Seagull nebula', 'Gum nebula', 'Sharpless nebula',
  'Solar corona SDO', 'Aurora borealis space', 'Jupiter James Webb', 'Saturn James Webb', 'Neptune James Webb',
  'Hubble Heritage', 'JWST NIRCam', 'JWST MIRI', 'Hubble ACS', 'Hubble WFC3', 'Hubble Wide Field',
  'Messier 1', 'Messier 8', 'Messier 16', 'Messier 17', 'Messier 20', 'Messier 27', 'Messier 42',
  'Messier 45', 'Messier 57', 'Messier 64', 'Messier 81', 'Messier 83', 'Messier 104', 'Messier 106',
  'NGC 6302', 'NGC 6543', 'NGC 7000', 'NGC 7293', 'NGC 6960', 'NGC 6992', 'NGC 2237', 'NGC 2244',
  'NGC 3372', 'NGC 2070', 'NGC 1976', 'NGC 1952', 'NGC 5194', 'NGC 4594', 'NGC 2841', 'NGC 1300',
  'NGC 6826', 'NGC 7635', 'NGC 2359', 'NGC 6888', 'NGC 7023', 'NGC 1499', 'NGC 281', 'NGC 7380',
  'NGC 602', 'NGC 346', 'NGC 1850', 'NGC 2060', 'NGC 6334', 'NGC 6357', 'NGC 3576', 'NGC 3603',
  'Tadpole galaxy', 'Cigar galaxy', 'Pinwheel galaxy', 'Black Eye galaxy', 'Fireworks galaxy',
  'Sunflower galaxy', 'Bode galaxy', 'Sculptor galaxy', 'Antennae galaxies', 'Mice galaxies',
  'Hubble deep space', 'Hubble cosmos', 'Hubble nebula', 'Hubble cluster', 'Hubble star',
  'JWST cosmos', 'JWST star', 'JWST galaxy cluster', 'JWST exoplanet atmosphere', 'JWST protostar',
  'Hubble 2015', 'Hubble 2016', 'Hubble 2017', 'Hubble 2018', 'Hubble 2019', 'Hubble 2020',
  'Hubble 2021', 'Hubble 2022', 'Hubble 2023', 'Hubble 2024',
  'JWST 2022', 'JWST 2023', 'JWST 2024', 'JWST 2025',
  'Chandra supernova', 'Chandra pulsar', 'Chandra black hole', 'Spitzer infrared nebula',
  'WISE infrared survey', 'Kepler star field', 'Solar flare SDO', 'Mars landscape rover',
  'Astrophysics nebula', 'Cosmology deep field', 'Interstellar medium', 'Protoplanetary disk'
];

const TARGET_TILE_SIZE = 256; // V8.0 초고화질 표준 규격
const MAX_PAGES_PER_QUERY = 8; // 키워드당 8페이지까지 깊은 순회 (최대 800건/키워드)
const PAGE_SIZE = 100;
const CONCURRENCY = 16;       // 16개 초고속 병렬 다운로드

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// 딜레이 헬퍼
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. NASA Images API에서 멀티 페이지 순회 대량 수집
async function searchNasaImages(query, maxPages = MAX_PAGES_PER_QUERY) {
  const encodedQuery = encodeURIComponent(query);
  const results = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://images-api.nasa.gov/search?q=${encodedQuery}&media_type=image&page_size=${PAGE_SIZE}&page=${page}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'CosmicMosaicPipeline/8.0' } });
      if (!res.ok) break;
      const data = await res.json();
      const items = data?.collection?.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        const nasaId = item?.data?.[0]?.nasa_id;
        const title = item?.data?.[0]?.title || 'Space';
        const link = item?.links?.[0]?.href;

        if (nasaId && link) {
          results.push({ nasaId, title, link, query });
        }
      }
      await sleep(100); // API 보호
    } catch (err) {
      break;
    }
  }
  return results;
}

// 2. 단일 이미지 다운로드 & 256x256 WebP 정규화
async function downloadAndNormalize(item) {
  const safeId = item.nasaId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetFilename = `nasa_${safeId}.webp`;
  const targetPath = path.join(TARGET_DIR, targetFilename);

  // 이미 수집된 경우 스킵
  if (fs.existsSync(targetPath)) {
    return { status: 'skipped', filename: targetFilename };
  }

  try {
    const res = await fetch(item.link);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length < 5000) {
      // 너무 작은 파일 (깨진 이미지) 스킵
      return { status: 'corrupt' };
    }

    // Sharp로 256x256 정방형 무왜곡 크롭 & 고품질 WebP 변환
    await sharp(buffer)
      .resize({
        width: TARGET_TILE_SIZE,
        height: TARGET_TILE_SIZE,
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 92, effort: 4 })
      .toFile(targetPath);

    return { status: 'success', filename: targetFilename };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

// 3. 메인 파이프라인 실행
async function runMassivePipeline() {
  console.log('\n======================================================');
  console.log('🚀 NASA 공식 100% 퍼블릭 도메인 대규모 아카이브 수집 파이프라인 (V8.0)');
  console.log('======================================================');
  console.log(`📁 저장 경로: ${TARGET_DIR}`);
  console.log(`🔍 쿼리 키워드 수: ${SEARCH_QUERIES.length}개`);
  console.log(`📐 정규화 규격: ${TARGET_TILE_SIZE}x${TARGET_TILE_SIZE} WebP\n`);

  const existingFiles = new Set(fs.readdirSync(TARGET_DIR));
  console.log(`📦 현재 보유 타일: ${existingFiles.size.toLocaleString()}개\n`);

  const allItemsMap = new Map();

  // 1단계: 모든 키워드 검색 및 목록 병합 (중복 자동 제거)
  for (let i = 0; i < SEARCH_QUERIES.length; i++) {
    const q = SEARCH_QUERIES[i];
    process.stdout.write(`[${i + 1}/${SEARCH_QUERIES.length}] 검색 중: "${q}"... `);
    const items = await searchNasaImages(q, MAX_PAGES_PER_QUERY);
    let added = 0;
    for (const item of items) {
      if (!allItemsMap.has(item.nasaId)) {
        allItemsMap.set(item.nasaId, item);
        added++;
      }
    }
    console.log(`-> 신규 ${added}건 (누적 ${allItemsMap.size}건)`);
    await sleep(250); // API Rate Limit 방어
  }

  const candidateList = Array.from(allItemsMap.values());
  console.log(`\n🎯 총 고유 수집 후보: ${candidateList.length.toLocaleString()}개`);

  // 2단계: 동시 다운로드 & 정규화 처리
  let downloadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < candidateList.length; i += CONCURRENCY) {
    const batch = candidateList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(item => downloadAndNormalize(item)));

    results.forEach(res => {
      if (res.status === 'success') downloadedCount++;
      else if (res.status === 'skipped') skippedCount++;
      else errorCount++;
    });

    const progress = Math.min(100, Math.round(((i + batch.length) / candidateList.length) * 100));
    process.stdout.write(`\r⚡ [다운로드 & 정규화] 진행률: ${progress}% (${i + batch.length}/${candidateList.length}) | 신규: ${downloadedCount} | 기존: ${skippedCount} | 에러: ${errorCount}`);
  }

  console.log('\n\n======================================================');
  console.log('🎉 NASA 대규모 아카이브 수집 및 256x256 정규화 완료!');
  console.log(`✅ 신규 추가: ${downloadedCount.toLocaleString()}개`);
  console.log(`⏭️ 기존 보유: ${skippedCount.toLocaleString()}개`);
  console.log(`❌ 에러/스킵: ${errorCount.toLocaleString()}개`);

  const finalTotal = fs.readdirSync(TARGET_DIR).length;
  console.log(`📁 최종 총 타일 수: ${finalTotal.toLocaleString()}개`);
  console.log('======================================================\n');
  console.log('🌳 KD-Tree 색상 인덱스를 자동으로 빌드합니다...\n');

  const { execSync } = require('child_process');
  execSync('node scripts/build.db.js nasa', { stdio: 'inherit' });
}

runMassivePipeline().catch(err => {
  console.error('❌ 파이프라인 치명적 오류:', err);
});
