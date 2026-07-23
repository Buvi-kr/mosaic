const express = require('express');
const http = require('http');
const path = require('path');

const socketManager = require('./socket.manager');
const uploadRouter = require('./upload.route');
const adminRouter = require('./admin.route');

// 글로벌 에러 로깅 처리 (알 수 없는 크래시 방지 및 추적)
const fs = require('fs');

function logGlobalError(err, type = 'Unhandled Error') {
  console.error(`[${type}]`, err);
  try {
    const logPath = path.join(__dirname, '../logs/server.error.log');
    fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] ${type}: ${err.stack || err}\n`);
  } catch(e) {}
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

// Express 전역 에러 핸들러
app.use((err, req, res, next) => {
  logGlobalError(err, 'Express Global Error');
  if (!res.headersSent) {
    res.status(500).json({ error: '서버 에러가 발생했습니다.', details: err.message });
  }
});

const { spawn, exec } = require('child_process');

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

let tunnelProcessRef = null;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Reverse Cosmos Mosaic (V5 Ultimate) Server Started`);
  console.log(`======================================================`);
  console.log(`- 대형 디스플레이: http://localhost:${PORT}/display.html`);
  console.log(`- 모바일 업로드: http://localhost:${PORT}/upload.html`);
  console.log(`- 관리자 패널: http://localhost:${PORT}/admin.html\n`);

  // 백그라운드 무인 실행 모드 대응: 브라우저 자동 오픈
  exec(`start http://localhost:${PORT}/admin.html`, (err) => {
    if (err) console.error('[시스템] 브라우저 자동 열기 실패:', err.message);
  });

  // === Smart Tunnel System ===
  // 1차: Cloudflare (http2 프로토콜로 기존 포토부스 QUIC과 충돌 회피)
  // 2차: DNS 30초 내 미해석 시 → serveo.net (SSH 기반 대체 터널) 자동 전환
  const dns = require('dns');
  let tunnelProcess = null;
  let tunnelUrlFound = false;

  function verifyDnsAndAnnounce(tunnelUrl, provider) {
    const hostname = tunnelUrl.replace('https://', '');
    let attempts = 0;
    const maxAttempts = 15; // 30초 (2초 간격)

    console.log(`\n[DNS] Verifying ${hostname} ...`);

    const checkDns = () => {
      attempts++;
      dns.resolve4(hostname, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
          console.log(`[DNS] RESOLVED! (${addresses[0]}, ${attempts * 2}s)`);
          console.log(`\n======================================================`);
          console.log(`🌍 Public URLs Ready! (${provider})`);
          console.log(`======================================================`);
          console.log(`- 대형 디스플레이: ${tunnelUrl}/display.html`);
          console.log(`- 모바일 업로드: ${tunnelUrl}/upload.html (<- QR 코드 주소)`);
          console.log(`- 관리자 패널: ${tunnelUrl}/admin.html\n`);
          socketManager.setTunnelUrl(tunnelUrl);
        } else if (attempts < maxAttempts) {
          process.stdout.write(`[DNS] Attempt ${attempts}/${maxAttempts} - waiting...\r`);
          setTimeout(checkDns, 2000);
        } else {
          // DNS 30초 내 실패 → Cloudflare 포기, 대체 터널로 전환
          console.log(`\n[DNS] FAILED after ${maxAttempts * 2}s. Switching to backup tunnel...`);
          if (tunnelProcess) {
            try { tunnelProcess.kill('SIGINT'); } catch(e) {}
          }
          startFallbackTunnel();
        }
      });
    };
    // 첫 시도는 5초 대기 후 (DNS 전파 최소 시간 확보)
    setTimeout(checkDns, 5000);
  }

  function startFallbackTunnel() {
    console.log('🌐 Starting Backup Tunnel (serveo.net)...\n');
    tunnelProcess = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=30',
      '-R', `80:127.0.0.1:${PORT}`,
      'nokey@localhost.run'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });
    tunnelProcessRef = tunnelProcess;

    let fallbackFound = false;
    const handleFallback = (data) => {
      const output = data.toString();
      process.stdout.write(`[Tunnel] ${output}`);
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
      if (match && !fallbackFound) {
        fallbackFound = true;
        const fallbackUrl = match[0];
        console.log(`\n======================================================`);
        console.log(`🌍 Public URLs Ready! (localhost.run Backup)`);
        console.log(`======================================================`);
        console.log(`- 대형 디스플레이: ${fallbackUrl}/display.html`);
        console.log(`- 모바일 업로드: ${fallbackUrl}/upload.html (<- QR 코드 주소)`);
        console.log(`- 관리자 패널: ${fallbackUrl}/admin.html\n`);
        socketManager.setTunnelUrl(fallbackUrl);
      }
    };
    tunnelProcess.stdout.on('data', handleFallback);
    tunnelProcess.stderr.on('data', handleFallback);
  }

  // === 1차 시도: Cloudflare Tunnel (http2 프로토콜) ===
  const exePath = path.join(__dirname, '../cloudflared.exe');
  if (fs.existsSync(exePath)) {
    console.log('🌐 Starting Cloudflare Tunnel (http2 mode)...\n');
    tunnelProcess = spawn(exePath, [
      'tunnel', '--url', `http://127.0.0.1:${PORT}`, '--protocol', 'http2'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });
    tunnelProcessRef = tunnelProcess;

    tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(`[Cloudflare] ${output}`);

      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !tunnelUrlFound) {
        tunnelUrlFound = true;
        const tunnelUrl = match[0];
        // DNS가 실제로 해석되는지 검증 후 표시 (실패 시 자동 폴백)
        verifyDnsAndAnnounce(tunnelUrl, 'Cloudflare');
      }
    });
  } else {
    // cloudflared.exe 없으면 바로 대체 터널 사용
    console.log('[INFO] cloudflared.exe not found. Using backup tunnel...');
    startFallbackTunnel();
  }
});

// Ctrl+C 또는 프로세스 종료 시 자식 프로세스(터널) 일괄 강제 종료
function gracefulShutdown() {
  console.log('\n🛑 서버를 종료합니다... (터널 프로세스 정리 중)');
  if (tunnelProcessRef) {
    try {
      tunnelProcessRef.kill('SIGINT');
    } catch(e) {}
  }
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
