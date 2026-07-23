const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');

const CONFIG_FILE = path.join(__dirname, '../data/config.json');

// 기본 설정값 (v2: 멀티테마 + 동시접속 대응 필드 포함)
const defaultConfig = {
  opacity: 0.8,
  secondOpacity: 0.3,
  tileSize: 20,
  blendMode: 'multiply',
  maxResolution: 1440,
  currentTheme: 'default_nasa',
  maxTileUsage: 4,
  banRadius: 2,
  minRequiredTiles: 3000,
  workerPoolSize: 0,        // 0 = os.cpus().length 자동 설정
  gridDownscaleThreshold: 10,
  candidatePoolSize: 150,
};

let config = { ...defaultConfig };

function loadConfig() {
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
}

function saveConfig() {
  if (!fs.existsSync(path.join(__dirname, '../data'))) {
    fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
  }
  // Windows 호환 원자적 쓰기 (write-file-atomic)
  try {
    writeFileAtomic.sync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('[Config] 원자적 쓰기 실패, 일반 쓰기로 폴백:', err.message);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }
}

function getConfig() {
  return config;
}

function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  saveConfig();
  return config;
}

loadConfig();

module.exports = {
  getConfig,
  updateConfig
};
