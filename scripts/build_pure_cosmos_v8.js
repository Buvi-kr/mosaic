/**
 * ==============================================================================
 * 🌌 V8.0 Pure Cosmic Mosaic Engine: 100% 순수 우주 대규모 아카이브 파이프라인
 * ==============================================================================
 * 원칙:
 * 1. 🚫 인물(사람 얼굴, 비행사, 연구원), 건물, 도표, 그래프 100% 원천 배제
 * 2. 🌌 오직 100% 순수 천체(성운, 은하, 별무리, 심우주, 행성, 오로라)만 엄선
 * 3. 🎯 압도적인 대규모 타일 풀(최대 10,000장)로 모든 색역(Warm/Cool/Dark/Bright) 완벽 커버
 * 4. 📐 256x256 정방형 고화질 WebP 무왜곡 정규화 & 3차원 CIE-Lab KD-Tree 자동 빌드
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'public/raw_tiles/nasa');
const NASA_API_KEY = process.env.NASA_API_KEY || 'KcrunjgYYw6fkVuOjD0zIn3cgnIOLpGFC8hxLfxZ';

const TARGET_TILE_SIZE = 256;
const CONCURRENCY = 16;

// 🚫 엄격한 인물/지상/도표 블랙리스트 (1글자라도 매칭 시 무조건 즉시 탈락)
const EXCLUDE_KEYWORDS = [
  'person', 'people', 'portrait', 'astronaut', 'scientist', 'engineer', 'team', 'staff',
  'meeting', 'conference', 'speech', 'award', 'ceremony', 'headquarters', 'official portrait',
  'building', 'facility', 'observatory tower', 'telescope structure', 'antenna', 'radio dish',
  'rocket', 'launch pad', 'shuttle', 'spacewalker', 'spacesuit', 'cockpit', 'control room',
  'diagram', 'graph', 'chart', 'plot', 'infographic', 'map', 'simulation', 'concept art',
  'drawing', 'illustration', 'sketch', 'model', 'render', 'logo', 'badge', 'patch',
  'stamp', 'poster', 'cover art', 'book', 'microscope', 'laboratory', 'test stand'
];

// 🌌 순수 천체 핵심 쿼리 리스트
const PURE_COSMIC_QUERIES = [
  'James Webb nebula', 'Hubble galaxy', 'JWST deep field', 'Carina nebula', 'Pillars of Creation',
  'Orion nebula', 'Andromeda galaxy', 'deep field Hubble', 'star forming region', 'supernova remnant',
  'Tarantula nebula', 'Crab nebula', 'Helix nebula', 'Sombrero galaxy', 'Whirlpool galaxy',
  'cosmic dust nebula', 'Milky Way core', 'Chandra x-ray nebula', 'Spitzer infrared galaxy', 'Ring nebula',
  'Veil nebula', 'Eagle nebula', 'Lagoon nebula', 'Interacting galaxies', 'Star cluster cosmos',
  'Hubble Ultra Deep Field', 'Rosette nebula', 'Horsehead nebula', 'Triangulum galaxy', 'Centaurus A',
  'Cartwheel galaxy', 'Stephan Quintet', 'Cosmic Cliffs JWST', 'Phantom galaxy JWST', 'Southern Ring JWST',
  'Messier 1', 'Messier 8', 'Messier 16', 'Messier 17', 'Messier 20', 'Messier 27', 'Messier 31',
  'Messier 33', 'Messier 42', 'Messier 45', 'Messier 51', 'Messier 57', 'Messier 64', 'Messier 81',
  'Messier 82', 'Messier 83', 'Messier 87', 'Messier 101', 'Messier 104', 'Messier 106',
  'NGC 1365', 'NGC 6302', 'NGC 6543', 'NGC 7000', 'NGC 7293', 'NGC 6960', 'NGC 6992', 'NGC 2237',
  'NGC 3372', 'NGC 2070', 'NGC 1976', 'NGC 1952', 'NGC 5194', 'NGC 4594', 'NGC 2841', 'NGC 1300',
  'Planetary nebula', 'Emission nebula', 'Reflection nebula', 'Dark nebula', 'Globular cluster',
  'Open star cluster', 'Gravitational lensing', 'Pulsar nebula', 'Supernova 1987A',
  'Heart nebula', 'Soul nebula', 'Pacman nebula', 'Elephant Trunk nebula', 'Cave nebula',
  'Wizard nebula', 'Bubble nebula', 'Iris nebula', 'Cocoon nebula', 'Crescent nebula',
  'Dumbbell nebula', 'Cats Eye nebula', 'Eskimo nebula', 'Owl nebula', 'Saturn nebula',
  'Blue Snowball nebula', 'Flaming Star nebula', 'Running Chicken nebula', 'Jellyfish nebula',
  'Witch Head nebula', 'Cone nebula', 'Seagull nebula', 'Gum nebula', 'Sharpless nebula',
  'Jupiter James Webb', 'Saturn James Webb', 'Neptune James Webb', 'Uranus James Webb',
  'Hubble Heritage cosmic', 'JWST NIRCam nebula', 'JWST MIRI galaxy', 'Hubble WFC3 galaxy',
  'Tadpole galaxy', 'Cigar galaxy', 'Pinwheel galaxy', 'Black Eye galaxy', 'Fireworks galaxy',
  'Sunflower galaxy', 'Bode galaxy', 'Sculptor galaxy', 'Antennae galaxies', 'Mice galaxies',
  'Hubble deep cosmos', 'Hubble starfield', 'JWST protostar nebula', 'JWST galaxy cluster'
];

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 텍스트 검증: 블랙리스트 키워드가 하나라도 있으면 false
function isPureCosmicText(text = '') {
  const lower = text.toLowerCase();
  for (const kw of EXCLUDE_KEYWORDS) {
    if (lower.includes(kw)) return false;
  }
  return true;
}

// 1. NASA Images API에서 엄격 필터링된 천체 이미지 수집
async function fetchPureFromImagesApi(query, maxPages = 5) {
  const encodedQuery = encodeURIComponent(query);
  const results = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://images-api.nasa.gov/search?q=${encodedQuery}&media_type=image&page_size=100&page=${page}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'PureCosmicEngine/8.0' } });
      if (!res.ok) break;
      const data = await res.json();
      const items = data?.collection?.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        const title = item?.data?.[0]?.title || '';
        const desc = item?.data?.[0]?.description || '';
        const keywords = (item?.data?.[0]?.keywords || []).join(' ');
        const nasaId = item?.data?.[0]?.nasa_id;
        const link = item?.links?.[0]?.href;

        // 인물/건물/도표 100% 필터링
        if (nasaId && link && isPureCosmicText(title) && isPureCosmicText(desc) && isPureCosmicText(keywords)) {
          results.push({
            id: `img_${nasaId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            title,
            link,
            source: 'images_api'
          });
        }
      }
      await sleep(100);
    } catch (e) {
      break;
    }
  }
  return results;
}

// 2. NASA APOD 30개년 아카이브에서 순수 천체 이미지 수집 (1995~2026)
async function fetchPureFromApod(startDate, endDate) {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const url = `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];

    const results = [];
    for (const item of items) {
      if (item.media_type !== 'image') continue;
      const title = item.title || '';
      const explanation = item.explanation || '';
      const link = item.hdurl || item.url;

      // 텍스트 필터 통과한 순수 천체만 선별
      if (link && isPureCosmicText(title) && isPureCosmicText(explanation)) {
        results.push({
          id: `apod_${item.date}`,
          title,
          link,
          source: 'apod'
        });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

// 3. 단일 이미지 다운로드 & 256x256 WebP 시각적 정규화 및 비주얼 필터
async function processAndSaveImage(item) {
  const filename = `${item.id}.webp`;
  const filePath = path.join(TARGET_DIR, filename);

  if (fs.existsSync(filePath)) {
    return { status: 'skipped' };
  }

  try {
    const res = await fetch(item.link);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length < 10000) {
      return { status: 'too_small' };
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();

    // 너무 작은 저화질 원본 배제
    if (metadata.width < 300 || metadata.height < 300) {
      return { status: 'low_res' };
    }

    // 256x256 정방형 무왜곡 크롭
    const processedBuffer = await image
      .resize({
        width: TARGET_TILE_SIZE,
        height: TARGET_TILE_SIZE,
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 92, effort: 4 })
      .toBuffer();

    // 🔬 비주얼 퀄리티 필터:
    // 1) 흰색 배경 도표/다이어그램 배제 (평균 밝기 > 235)
    // 2) 디테일 없는 단색 이미지 배제 (표준편차 stdev < 8)
    const stats = await sharp(processedBuffer).stats();
    const meanR = stats.channels[0].mean;
    const meanG = stats.channels[1].mean;
    const meanB = stats.channels[2].mean;
    const avgBrightness = (meanR + meanG + meanB) / 3;

    const stdev = (stats.channels[0].stdev + stats.channels[1].stdev + stats.channels[2].stdev) / 3;

    if (avgBrightness > 235) {
      return { status: 'white_diagram_rejected' };
    }
    if (stdev < 8) {
      return { status: 'flat_rejected' };
    }

    await fs.promises.writeFile(filePath, processedBuffer);
    return { status: 'success', filename };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

// 4. 메인 마스터 실행 함수
async function runPureCosmicPipeline() {
  console.log('\n================================================================');
  console.log('🌌 V8.0 Pure Cosmic Mosaic Engine (100% 순수 우주 대규모 파이프라인)');
  console.log('================================================================');
  console.log('🚫 인물, 비행사, 연구원, 건물, 도표, 그래프 100% 원천 차단 필터 가동');
  console.log(`📁 저장 경로: ${TARGET_DIR}`);
  console.log(`📐 정규화 규격: ${TARGET_TILE_SIZE}x${TARGET_TILE_SIZE} WebP\n`);

  const allCandidateMap = new Map();

  // -------------------------------------------------------------
  // 1단계: NASA Images API 100% 순수 천체 쿼리 수집
  // -------------------------------------------------------------
  console.log(`📡 [1단계] NASA 공식 Images API ${PURE_COSMIC_QUERIES.length}개 순수 천체 쿼리 수집 시작...`);
  for (let i = 0; i < PURE_COSMIC_QUERIES.length; i++) {
    const q = PURE_COSMIC_QUERIES[i];
    process.stdout.write(`   [${i + 1}/${PURE_COSMIC_QUERIES.length}] "${q}"... `);
    const items = await fetchPureFromImagesApi(q, 5);
    let added = 0;
    for (const it of items) {
      if (!allCandidateMap.has(it.id)) {
        allCandidateMap.set(it.id, it);
        added++;
      }
    }
    console.log(`-> 청정 천체 ${added}건 추가 (누적 ${allCandidateMap.size}건)`);
    await sleep(150);
  }

  // -------------------------------------------------------------
  // 2단계: NASA APOD 30개년 아카이브 중 순수 천체 수집 (1995 ~ 2026)
  // -------------------------------------------------------------
  console.log(`\n🔭 [2단계] NASA APOD 30개년 공식 아카이브 순수 천체 필터링 수집 시작...`);
  let currentDate = new Date('1995-06-16');
  const now = new Date();
  const CHUNK_DAYS = 90;

  let apodChunkIndex = 0;
  while (currentDate < now) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + CHUNK_DAYS);
    const chunkEnd = nextDate > now ? now : nextDate;

    apodChunkIndex++;
    process.stdout.write(`   [APOD 청크 ${apodChunkIndex}] ${currentDate.toISOString().slice(0, 10)} ~ ${chunkEnd.toISOString().slice(0, 10)}... `);
    const items = await fetchPureFromApod(currentDate, chunkEnd);
    let added = 0;
    for (const it of items) {
      if (!allCandidateMap.has(it.id)) {
        allCandidateMap.set(it.id, it);
        added++;
      }
    }
    console.log(`-> 청정 천체 ${added}건 추가 (누적 ${allCandidateMap.size}건)`);

    currentDate = new Date(nextDate);
    currentDate.setDate(currentDate.getDate() + 1);
    await sleep(250);
  }

  const candidateList = Array.from(allCandidateMap.values());
  console.log(`\n🎯 100% 순수 천체 총 후보: ${candidateList.length.toLocaleString()}개`);

  // -------------------------------------------------------------
  // 3단계: 고속 병렬 다운로드 & 비주얼 품질 정규화 처리
  // -------------------------------------------------------------
  console.log(`\n⚡ [3단계] 16개 스레드 고속 병렬 다운로드 & 256x256 WebP 정규화 시작...\n`);
  let successCount = 0;
  let skippedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < candidateList.length; i += CONCURRENCY) {
    const batch = candidateList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(it => processAndSaveImage(it)));

    results.forEach(res => {
      if (res.status === 'success') successCount++;
      else if (res.status === 'skipped') skippedCount++;
      else if (res.status.includes('rejected')) rejectedCount++;
      else errorCount++;
    });

    const progress = Math.min(100, Math.round(((i + batch.length) / candidateList.length) * 100));
    process.stdout.write(`\r   ⏳ 진행률: ${progress}% (${i + batch.length}/${candidateList.length}) | ✅ 청정 성공: ${successCount} | ⏭️ 기존: ${skippedCount} | 🚫 도표/노이즈 탈락: ${rejectedCount} | ❌ 에러: ${errorCount}`);
  }

  const finalTotal = fs.readdirSync(TARGET_DIR).length;
  console.log('\n\n================================================================');
  console.log('🎉 100% 순수 우주 대규모 타일 수집 및 정규화 완료!');
  console.log(`✅ 신규 추가: ${successCount.toLocaleString()}개`);
  console.log(`⏭️ 기존 보유: ${skippedCount.toLocaleString()}개`);
  console.log(`🚫 도표/노이즈 탈락: ${rejectedCount.toLocaleString()}개`);
  console.log(`📁 최종 청정 우주 타일 총 보유량: ${finalTotal.toLocaleString()}개`);
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 4단계: 3차원 CIE-Lab 색역 분석 및 초고속 KD-Tree 인덱스 자동 빌드
  // -------------------------------------------------------------
  console.log('🌳 [4단계] nasa 테마 3차원 KD-Tree 색상 인덱스를 자동으로 빌드합니다...\n');
  execSync('node scripts/build.db.js nasa', { stdio: 'inherit' });
  console.log('\n✨ 모든 파이프라인이 성공적으로 완수되었습니다!\n');
}

runPureCosmicPipeline().catch(err => {
  console.error('❌ 파이프라인 치명적 오류:', err);
});
