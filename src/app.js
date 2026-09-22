const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');
const configModule = require('./config');

const socketManager = require('./socket.manager');
const uploadRouter = require('./upload.route');
const adminRouter = require('./admin.route');
const sheetsSync = require('./sheets.sync');
const sessionLogger = require('./session.logger');

// 글로벌 에러 로깅 처리 (알 수 없는 크래시 방지 및 추적)
const fs = require('fs');

function logGlobalError(err, type = 'Unhandled Error') {
  sessionLogger.logServerError(type, err);
}

process.on('uncaughtException', (err) => logGlobalError(err, 'UncaughtException'));
process.on('unhandledRejection', (reason) => logGlobalError(reason, 'UnhandledRejection'));

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io 초기화
socketManager.init(server);

// 의존성 연결
adminRouter.setUploadRouter(uploadRouter);

// 정적 파일 및 파싱 미들웨어
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// 라우터 마운트
app.use('/api/upload', uploadRouter);
app.use('/api/admin', adminRouter);

// 심플 디스플레이 & 심플 업로드 라우트 별칭
app.get(['/simple-display', '/simple_display'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/simple_display.html'));
});
app.get(['/simple-upload', '/simple_upload'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/simple_upload.html'));
});

// 최근 완성된 모자이크 결과물 목록 (디스플레이 유휴 갤러리용)
app.get('/api/outputs/recent', (req, res) => {
  const outputsDir = path.join(__dirname, '../public/outputs');
  if (!fs.existsSync(outputsDir)) return res.json({ outputs: [] });
  try {
    const files = fs.readdirSync(outputsDir)
      .filter(f => f.startsWith('mosaic_') && (f.endsWith('.jpg') || f.endsWith('.png')))
      .map(f => {
        const filePath = path.join(outputsDir, f);
        const stat = fs.statSync(filePath);
        return {
          imageUrl: `/outputs/${f}`,
          filename: f,
          timestamp: stat.mtimeMs
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    res.json({ outputs: files });
  } catch (e) {
    res.json({ outputs: [] });
  }
});

// 안전한 데모 모자이크 목록 (유휴 시 순환용 - 개인정보/초상권 보호)
app.get('/api/outputs/guides', (req, res) => {
  const demoDir = path.join(__dirname, '../public/output_guides');
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
    return res.json({ guides: [] });
  }
  try {
    const files = fs.readdirSync(demoDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(f => `/output_guides/${f}`);
    res.json({ guides: files });
  } catch (e) {
    res.json({ guides: [] });
  }
});

// 촬영 가이드 예시 사진 목록 (public/guides/ 폴더 순환용)
app.get('/api/guides', (req, res) => {
  const guidesDir = path.join(__dirname, '../public/guides');
  if (!fs.existsSync(guidesDir)) {
    fs.mkdirSync(guidesDir, { recursive: true });
    return res.json({ guides: [] });
  }
  try {
    const files = fs.readdirSync(guidesDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(f => `/guides/${f}`);
    res.json({ guides: files });
  } catch (e) {
    res.json({ guides: [] });
  }
});

// Express 전역 에러 핸들러
app.use((err, req, res, next) => {
  logGlobalError(err, 'Express Global Error');
  if (!res.headersSent) {
    res.status(500).json({ error: '서버 에러가 발생했습니다.', details: err.message });
  }
});

// 시작 시 각종 찌꺼기 파일 및 오래된 로그 정리 (개인정보 보호 및 용량 확보)
function performStartupCleanup() {
  // 1. 개인정보 보호: 이전 결과물(이미지) 삭제
  const outputsDir = path.join(__dirname, '../public/outputs');
  if (fs.existsSync(outputsDir)) {
    try {
      let deletedOutputs = 0;
      const files = fs.readdirSync(outputsDir);
      for (const file of files) {
        if (file.endsWith('.jpg') || file.endsWith('.png')) {
          fs.unlinkSync(path.join(outputsDir, file));
          deletedOutputs++;
        }
      }
      if (deletedOutputs > 0) {
        console.log(`[시스템] 이전 모자이크 결과물 ${deletedOutputs}개 삭제 완료 (개인정보 보호)`);
      }
    } catch(e) { console.error('[시스템] 출력물 정리 에러:', e); }
  }

  // 2. 히스토리 로그 폴더 정리 (무거운 JSON 파일 찌꺼기 중 3일이 지난 것만 청소 - 유지보수용 보존)
  const historyDir = path.join(__dirname, '../logs/history');
  if (fs.existsSync(historyDir)) {
    try {
      let deletedHistory = 0;
      const files = fs.readdirSync(historyDir);
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(historyDir, file);
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < threeDaysAgo) {
            fs.unlinkSync(filePath);
            deletedHistory++;
          }
        }
      }
      if (deletedHistory > 0) {
        console.log(`[시스템] 3일 경과 이전 JSON 상세 로그 ${deletedHistory}개 삭제 완료 (용량 최적화)`);
      }
    } catch(e) { console.error('[시스템] 히스토리 정리 에러:', e); }
  }

  // (3번 오래된 통계 로그 삭제 로직은 월간/연간 통계를 위해 사용자 요청으로 제거되었습니다. 텍스트 로그는 용량이 극히 작아 영구 보존합니다.)
}

performStartupCleanup();

let cloudflareProcess = null;

// 포트 충돌 시 좀비 프로세스로 남지 않도록 명시적 에러 처리
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[치명적 에러] 포트 ${PORT}이 이미 사용 중입니다!`);
    console.error(`[치명적 에러] 다른 프로세스가 포트를 점유하고 있습니다.`);
    console.error(`[치명적 에러] start.bat을 다시 실행해주세요.\n`);
    process.exit(1);
  }
  logGlobalError(err, 'Server Error');
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const currentConfig = configModule.getConfig();
  const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(1);
  const freeMemGB = (os.freemem() / (1024 ** 3)).toFixed(1);
  const isLowMemory = (os.totalmem() / (1024 ** 3)) <= 8.5;
  const renderModeText = currentConfig.lowMemoryMode
    ? '🛡️ SAFE-MODE (8GB 이하 다운스케일 활성화)'
    : '💎 FULL-QUALITY (100% 원본 해상도 보장, 강제 하향 없음)';

  console.log(`\n======================================================`);
  console.log(`🚀 Reverse Cosmos Mosaic (V7.0 Ultimate) Server Started`);
  console.log(`======================================================`);
  console.log(`🖥️  [하드웨어 환경 감지]`);
  console.log(`   - CPU 코어: ${os.cpus().length} 스레드`);
  console.log(`   - 시스템 RAM: ${totalMemGB} GB (가용: ${freeMemGB} GB) ${isLowMemory ? '⚠️ [저사양 감지]' : '✅ [충분함]'}`);
  console.log(`   - 모자이크 렌더 모드: ${renderModeText}`);
  console.log(`- 3분할 디스플레이: http://localhost:${PORT}/display.html`);
  console.log(`- ✨ 심플 대형 디스플레이: http://localhost:${PORT}/simple_display.html`);
  console.log(`- 셀카 모바일 업로드: http://localhost:${PORT}/upload.html`);
  console.log(`- 🚀 심플 모바일 업로드: http://localhost:${PORT}/simple_upload.html`);
  console.log(`- 관리자 패널: http://localhost:${PORT}/admin.html\n`);

  // Google Sheets 원격 관제 요약 통계 동기화 (부팅 5초 후 최초 1회 + 10분 주기 스냅샷)
  if (sheetsSync.isEnabled()) {
    console.log('📊 [Google Sheets] 원격 관제 대시보드 동기화 활성화됨 (10분 주기 자동 스냅샷)');
    setTimeout(() => {
      sheetsSync.syncSummary(sessionLogger.getAggregatedStats()).catch(() => {});
    }, 5000);

    setInterval(() => {
      sheetsSync.syncSummary(sessionLogger.getAggregatedStats()).catch(() => {});
    }, 10 * 60 * 1000);
  }

  // 전시장 대형 디스플레이 자동 실행: Microsoft Edge 1순위 감지 + 전체화면(F11) 새 창 분리
  // 1번 탭: display.html 전면 메인 전시, 2번 탭: admin.html 백그라운드 관리자 제어
  function launchExhibitionBrowser(port) {
    if (process.argv.includes('--no-browser') || process.env.NO_BROWSER === 'true') {
      console.log('[시스템] --no-browser 옵션으로 브라우저 자동 실행을 건너뜁니다.');
      return;
    }

    const displayUrl = `http://localhost:${port}/simple_display2.html`;
    const adminUrl = `http://localhost:${port}/admin.html`;

    // 1순위: Microsoft Edge (윈도우 10/11 전시장 권장 표준)
    const edgeCandidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(process.env.ProgramFiles || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    ];

    // 2순위: Google Chrome (대체 브라우저)
    const chromeCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.ProgramFiles || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ];

    let browserPath = null;
    let browserName = '';

    for (const p of edgeCandidates) {
      if (p && fs.existsSync(p)) {
        browserPath = p;
        browserName = 'Microsoft Edge';
        break;
      }
    }

    if (!browserPath) {
      for (const p of chromeCandidates) {
        if (p && fs.existsSync(p)) {
          browserPath = p;
          browserName = 'Google Chrome';
          break;
        }
      }
    }

    if (browserPath) {
      console.log(`[시스템] 전시장 ${browserName} 전체화면 브라우저 자동 기동: ${browserPath}`);
      try {
        const fsDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'mosaic_fullscreen_profile');
        if (!fs.existsSync(fsDir)) fs.mkdirSync(fsDir, { recursive: true });

        // 1. 기존 실행 중인 일반 창과 세션을 완전히 분리하기 위해 독립 profile 지정
        // 2. --start-fullscreen: 윈도우 OS 레벨에서 전체화면으로 실행하되, 언제든 F11로 켜고 끌 수 있음
        // 3. Tab 1: simple_display2.html (fullscreen exhibition), Tab 2: admin.html (background control)
        const browserArgs = [
          `--user-data-dir="${fsDir}"`,
          '--start-fullscreen',
          `"${displayUrl}"`,
          `"${adminUrl}"`,
          '--no-first-run',
          '--no-default-browser-check'
        ];

        const winCmd = `start "" "${browserPath}" ${browserArgs.join(' ')}`;
        exec(winCmd, (err) => {
          if (err) {
            const child = spawn(browserPath, [
              `--user-data-dir=${fsDir}`,
              '--start-fullscreen',
              displayUrl,
              adminUrl,
              '--no-first-run',
              '--no-default-browser-check'
            ], {
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
          }
        });
      } catch (err) {
        console.error('[시스템] 브라우저 프로세스 실행 에러:', err.message);
      }
    } else {
      console.log('[시스템] 전용 브라우저 미발견, 기본 브라우저 순차 탭 실행...');
      exec(`start "" "${adminUrl}"`, () => {
        setTimeout(() => {
          exec(`start "" "${displayUrl}"`);
        }, 600);
      });
    }
  }

  launchExhibitionBrowser(PORT);

  // Cloudflare 터널을 Node.js의 자식 프로세스로 실행하여 생명주기를 동기화
  const exePath = path.join(__dirname, '../cloudflared.exe');
  if (fs.existsSync(exePath)) {
    console.log('🌐 Starting Cloudflare Tunnel...\n');
    cloudflareProcess = spawn(exePath, ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    let tunnelUrlFound = false;

    cloudflareProcess.stderr.on('data', (data) => {
      const output = data.toString();

      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !tunnelUrlFound) {
        tunnelUrlFound = true;
        const tunnelUrl = match[0];
        console.log(`\n======================================================`);
        console.log(`🌍 Cloudflare Public URLs Ready!`);
        console.log(`======================================================`);
        console.log(`- ✨ Simple Display v2 (Exhibition): ${tunnelUrl}/simple_display2.html`);
        console.log(`- 3-Split Display: ${tunnelUrl}/display.html`);
        console.log(`- Mobile Upload: ${tunnelUrl}/upload.html`);
        console.log(`- Simple Mobile Upload: ${tunnelUrl}/simple_upload.html`);
        console.log(`- Admin Panel: ${tunnelUrl}/admin.html\n`);
        
        socketManager.setTunnelUrl(tunnelUrl);
      }
    });
  }
});

// Ctrl+C 또는 프로세스 종료 시 자식 프로세스(클라우드플레어) 일괄 강제 종료
function gracefulShutdown() {
  console.log('\n🛑 서버를 종료합니다... (터널 프로세스 정리 중)');
  if (cloudflareProcess) {
    try {
      cloudflareProcess.kill('SIGINT');
    } catch(e) {}
  }
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
