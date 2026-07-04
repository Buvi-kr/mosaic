const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/config.json');

// 기본 설정값
const defaultConfig = {
  opacity: 0.8,
  tileSize: 20,
  blendMode: 'multiply',
  maxResolution: 1440
};

let config = { ...defaultConfig };

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      config = { ...config, ...saved };
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
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
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
