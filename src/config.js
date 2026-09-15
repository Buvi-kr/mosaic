const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');

const CONFIG_FILE = path.join(__dirname, '../data/config.json');

// 기본 설정값 (v2: 멀티테마 + 동시접속 대응 필드 포함)
const defaultConfig = {
  opacity: 0.8,
  secondOpacity: 0.3,
  tileSize: 20,              // 그리드 밀도 (가상 단위). 작을수록 모자이크 칸수(Density)가 기하급수적으로 폭증함.
  blendMode: 'multiply',
  maxResolution: 1440,       // 가상 그리드 해상도 기준. (실제 렌더링 결과물의 픽셀 크기가 아님)
  currentTheme: 'default_nasa',
  maxTileUsage: 4,
  banRadius: 2,
  minRequiredTiles: 3000,
  workerPoolSize: 0,         // 0 = os.cpus().length 자동 설정
  gridDownscaleThreshold: 10,
  candidatePoolSize: 150,
  renderTileSize: 200,       // 실제 타일 렌더링 물리적 화질 (px). 이 크기와 가로/세로 칸수가 곱해져 최종 캔버스 크기가 폭증함.
  lowMemoryMode: false,      // 저사양 안전 모드 (기본 false: 100% 풀 퀄리티 원본 해상도 보장, true: 8GB 이하 저사양 OOM 방지 다운스케일)
  displayShowcaseDuration: 20, // 1회차 모자이크 결과물 전시 보장 시간 (초)
  displayRetryDuration: 8,     // 2회차 보너스 모자이크 전시 시간 (초)
  displayGuideInterval: 5,     // 촬영 예시 슬라이드 주기 (초)
  displayPhotozoneTheme: 'nebula', // 포토존 테마 ('nebula', 'galaxy', 'aurora', 'minimal')
  displayShowTimer: true,      // 결과물 잔여 전시 시간 타이머 표시 여부
  googleSheets: {
    enabled: false,
    webAppUrl: ''
  }
};

let config = { ...defaultConfig };

const LOCAL_CONFIG_FILE = path.join(__dirname, '../data/config.local.json');
const ENV_FILE = path.join(__dirname, '../.env');

function loadEnvFile() {
  if (fs.existsSync(ENV_FILE)) {
    try {
      const lines = fs.readFileSync(ENV_FILE, 'utf-8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim();
          if (!process.env[k]) process.env[k] = v;
        }
      }
    } catch (e) {}
  }
}

function loadConfig() {
  loadEnvFile();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      config = { ...defaultConfig, ...saved };
    } catch(e) {
      console.error('Config parsing error:', e);
    }
  } else {
    saveConfig();
  }

  // 1. config.local.json 우선 병합 (gitignore 대상, 로컬 비밀키 보관)
  if (fs.existsSync(LOCAL_CONFIG_FILE)) {
    try {
      const localSaved = JSON.parse(fs.readFileSync(LOCAL_CONFIG_FILE, 'utf-8'));
      config = {
        ...config,
        ...localSaved,
        googleSheets: { ...(config.googleSheets || {}), ...(localSaved.googleSheets || {}) }
      };
    } catch (e) {}
  }

  // 2. .env 환경변수 우선 반영 (gitignore 대상)
  if (process.env.GOOGLE_SHEETS_WEBAPP_URL) {
    config.googleSheets = config.googleSheets || {};
    config.googleSheets.webAppUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;
    config.googleSheets.enabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
  }

  // 전시 시간 범위 안전 클램핑
  config.displayShowcaseDuration = Math.max(10, Math.min(60, config.displayShowcaseDuration || 20));
  config.displayRetryDuration = Math.max(5, Math.min(20, config.displayRetryDuration || 8));
}

function saveConfig() {
  if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
  }

  // 깃허브 추적 파일(CONFIG_FILE)에는 비밀키 URL이 노출되지 않도록 마스킹하여 저장
  const publicConfig = { ...config };
  if (fs.existsSync(LOCAL_CONFIG_FILE) || process.env.GOOGLE_SHEETS_WEBAPP_URL) {
    publicConfig.googleSheets = {
      enabled: false,
      webAppUrl: ''
    };
  }

  // Windows 호환 원자적 쓰기 (write-file-atomic)
  try {
    writeFileAtomic.sync(CONFIG_FILE, JSON.stringify(publicConfig, null, 2));
  } catch (err) {
    console.error('[Config] 원자적 쓰기 실패, 일반 쓰기로 폴백:', err.message);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(publicConfig, null, 2));
  }
}

function getConfig() {
  return config;
}

function updateConfig(newConfig) {
  const sanitized = { ...newConfig };
  if (sanitized.displayShowcaseDuration !== undefined) {
    sanitized.displayShowcaseDuration = Math.max(10, Math.min(60, Number(sanitized.displayShowcaseDuration) || 20));
  }
  if (sanitized.displayRetryDuration !== undefined) {
    sanitized.displayRetryDuration = Math.max(5, Math.min(20, Number(sanitized.displayRetryDuration) || 8));
  }
  config = { ...config, ...sanitized };
  saveConfig();
  return config;
}

loadConfig();

module.exports = {
  getConfig,
  updateConfig
};
