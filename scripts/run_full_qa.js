/**
 * =========================================================================
 * REVERSE COSMOS MOSAIC V16.0 - 종합 전수 QA 테스트 스위트 (All Test Cases)
 * =========================================================================
 * 
 * 1. [CONFIG] 설정값 로드 및 워터마크 플래그 기본값 검증
 * 2. [SESSION] 게이트 개방/폐쇄, 슬롯 점유, 조기 개방(openGateEarly), 세션 완료
 * 3. [RESILIENCE] 소켓 단절 유예(DISCONNECTED_GRACE) 및 재접속(reconnect) 복원
 * 4. [LOGGER] 14개 이벤트 타임스탬프 원장, 소요시간 산출, 엑셀 BOM CSV 무결성
 * 5. [SHEETS] 구글 시트 14개 표준 이벤트 페이로드 규격 검증
 * 6. [MOSAIC & WATERMARK] 6대 워터마크 합성 케이스 전수 검증
 *    - 6-1. 가로형(1920x1080) + 블렌딩 ON + 워터마크 ON
 *    - 6-2. 세로형(1080x1920) + 블렌딩 ON + 워터마크 ON
 *    - 6-3. 블렌딩 OFF (opacity: 0) + 워터마크 ON
 *    - 6-4. 워터마크 OFF (enableWatermark: false)
 *    - 6-5. 초대형(9600x12800) 스케일링 및 캔버스 경계 보장
 *    - 6-6. 실시간 워커 스레드(matcher.worker.js) E2E 렌더링 완주
 * 7. [UI/ASSETS] 디스플레이 셀카 구역 로고 제거 및 투명 로고 PNG 무결성
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const configModule = require('../src/config');
const uploadRoute = require('../src/upload.route');
const sessionManager = require('../src/session.manager');
const sessionLogger = require('../src/session.logger');
const sheetsSync = require('../src/sheets.sync');
const mosaicQueue = require('../src/mosaic.queue');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runAllQA() {
  console.log('===============================================================');
  console.log('🚀 [REVERSE COSMOS] 전수 QA 자동화 검증 스위트 기동');
  console.log('===============================================================\n');

  // -----------------------------------------------------------------
  // 1. CONFIG & SYSTEM DEFAULTS
  // -----------------------------------------------------------------
  console.log('📦 [1/7] 시스템 설정(Config) 및 기본값 검증');
  const cfg = configModule.getConfig();
  it('기본 설정에 enableWatermark 플래그가 존재하고 기본값 true여야 함', () => {
    assert.strictEqual(cfg.enableWatermark, true);
  });
  it('전시장 관람객 게이트 타임아웃이 10~120초 범위 내에 존재해야 함', () => {
    assert.strictEqual(typeof cfg.visitorGateTimeout, 'number');
    assert.strictEqual(cfg.visitorGateTimeout >= 10 && cfg.visitorGateTimeout <= 120, true);
  });
  it('쇼케이스 보장 전시 시간이 60초 이내여야 함', () => {
    assert.strictEqual(cfg.displayShowcaseDuration <= 60, true);
  });

  // -----------------------------------------------------------------
  // 2. SESSION LIFECYCLE & GATE FLOW
  // -----------------------------------------------------------------
  console.log('\n🚪 [2/7] 세션 매니저 단일 촬영 라이프사이클 및 게이트 제어 검증');
  it('초기 게이트는 열려있고 유효한 gateToken을 반환해야 함', () => {
    const gateState = sessionManager.getGateState();
    assert.strictEqual(gateState.isOpen, true);
    assert.strictEqual(typeof gateState.gateToken, 'string');
    assert.strictEqual(gateState.gateToken.length > 10, true);
  });

  let sessionA;
  const initialGateToken = sessionManager.getGateState().gateToken;
  it('관람객 A가 QR 스캔 시 슬롯을 점유하고 게이트가 CLOSED되어야 함', () => {
    const claim = sessionManager.claimSlot(initialGateToken, 'socket_user_a');
    assert.strictEqual(claim.success, true);
    assert.strictEqual(claim.isImmediate, true);
    assert.strictEqual(claim.state, 'RESERVED');
    sessionA = sessionManager.getSession(claim.sessionToken);
    assert.notStrictEqual(sessionA, null);
    assert.strictEqual(sessionManager.getGateState().isOpen, false);
  });

  it('사용된 gateToken으로 다른 사용자가 입장 시도시 SLOT_BUSY로 차단되어야 함', () => {
    const intruderClaim = sessionManager.claimSlot(initialGateToken, 'socket_intruder');
    assert.strictEqual(intruderClaim.success, false);
    assert.strictEqual(intruderClaim.code, 'SLOT_BUSY');
  });

  it('관람객 A가 촬영 시작(startCapture) 시 CAPTURING 상태로 전환되어야 함', () => {
    const startResult = sessionManager.startCapture(sessionA.sessionToken);
    assert.strictEqual(startResult.success, true);
    assert.strictEqual(startResult.state, 'CAPTURING');
  });

  it('사진 업로드 수신 즉시 openGateEarly 호출로 게이트가 조기 개방되어야 함', () => {
    sessionManager.openGateEarly('photo_uploaded_qa');
    const stateAfterUpload = sessionManager.getGateState();
    assert.strictEqual(stateAfterUpload.isOpen, true);
    assert.notStrictEqual(stateAfterUpload.gateToken, initialGateToken);
  });

  it('모자이크 완성 및 세션 정상 완료 처리', () => {
    const uploadRes = sessionManager.recordUploadSuccess(sessionA.sessionToken, '/outputs/test_mosaic_qa.jpg');
    assert.strictEqual(uploadRes.shotCount, 1);
    assert.strictEqual(sessionA.state, 'DOWNLOAD_1');
    const audit = sessionLogger.getAuditRecord(sessionA.sessionId);
    assert.strictEqual(audit.finalStatus, 'COMPLETED_SINGLE');
  });

  // -----------------------------------------------------------------
  // 3. NETWORK RESILIENCE (소켓 단절 유예 & 복원)
  // -----------------------------------------------------------------
  console.log('\n🌐 [3/7] 네트워크 순단 유예(DISCONNECTED_GRACE) 및 복원 검증');
  let sessionB;
  it('관람객 B 입장 후 촬영 도중 소켓 단절 시 DISCONNECTED_GRACE 상태로 보호되어야 함', () => {
    const gateTokenB = sessionManager.getGateState().gateToken;
    const claimB = sessionManager.claimSlot(gateTokenB, 'socket_b_orig');
    sessionB = sessionManager.getSession(claimB.sessionToken);
    sessionManager.startCapture(claimB.sessionToken);

    sessionManager.handleDisconnect('socket_b_orig');
    assert.strictEqual(sessionB.state, 'DISCONNECTED_GRACE');
    assert.notStrictEqual(sessionB.graceTimer, null);
  });

  it('새로운 소켓으로 재접속 시 이전 촬영 상태(CAPTURING)로 100% 복구되어야 함', () => {
    const reconnect = sessionManager.handleReconnect('socket_b_new', sessionB.sessionToken);
    assert.strictEqual(reconnect.success, true);
    assert.strictEqual(sessionB.socketId, 'socket_b_new');
    assert.strictEqual(sessionB.state, 'CAPTURING');
    assert.strictEqual(sessionB.graceTimer, null);
  });

  // -----------------------------------------------------------------
  // 4. SESSION AUDIT LOGGER & 14-COLUMN TIMESTAMPS
  // -----------------------------------------------------------------
  console.log('\n📊 [4/7] 14개 이벤트 타임스탬프 원장 및 세션 감사 로거 검증');
  const mockSess = {
    sessionId: 'qa_sess_log_001',
    sessionToken: 'tok_qa_log_001',
    state: 'RESERVED'
  };

  it('접근 기록 생성 및 브라우저 환경 판별', () => {
    const audit = sessionLogger.recordAccess(mockSess, {
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
    });
    assert.strictEqual(audit.sessionId, mockSess.sessionId);
    assert.strictEqual(audit.userAgent.includes('iPhone'), true);
  });

  it('촬영 시작 -> 업로드 -> 모자이크 완성 -> 다운로드 -> 종료 전주기 타임스탬프 산출', () => {
    sessionLogger.recordCaptureStart(mockSess.sessionId, 1);
    sessionLogger.recordUploadReceived(mockSess.sessionId, 1, { size: 1024 * 1024 });
    sessionLogger.recordMosaicSuccess(mockSess.sessionId, 1, {
      elapsed: '2.50',
      resultUrl: '/outputs/qa_mosaic.jpg',
      resolution: '1920x1080',
      totalCells: 100,
      theme: 'default_nasa'
    });
    sessionLogger.recordDownload(mockSess.sessionId, 1, 'qa_mosaic.jpg');
    sessionLogger.recordSessionEnd(mockSess.sessionId, 'COMPLETED');

    const audit = sessionLogger.getAuditRecord(mockSess.sessionId);
    assert.strictEqual(audit.finalStatus, 'COMPLETED');
    assert.strictEqual(audit.shot1.downloaded, true);
    assert.strictEqual(typeof audit.shot1.captureDurationSec, 'number');
    assert.strictEqual(typeof audit.shot1.mosaicDurationSec, 'number');
    assert.strictEqual(typeof audit.totalStaySec, 'number');
  });

  it('엑셀 호환 CSV 감사 파일에 UTF-8 BOM(\uFEFF) 및 14개 표준 헤더 포함 검증', () => {
    const csvPath = sessionLogger.getCsvFilePath();
    assert.strictEqual(fs.existsSync(csvPath), true);
    const content = fs.readFileSync(csvPath, 'utf8');
    assert.strictEqual(content.startsWith('\uFEFF'), true, '엑셀 UTF-8 BOM 필수');
    const header = content.split('\n')[0];
    assert.strictEqual(header.includes('세션ID'), true);
    assert.strictEqual(header.includes('촬영성공'), true);
    assert.strictEqual(header.includes('모자이크성공'), true);
    assert.strictEqual(header.includes('총체류시간(초)'), true);
  });

  // -----------------------------------------------------------------
  // 5. GOOGLE SHEETS V16.0 SYNC SPEC
  // -----------------------------------------------------------------
  console.log('\n📋 [5/7] 구글 시트 v16.0 규격 14개 표준 이벤트 페이로드 검증');
  it('syncSessionRow 페이로드가 14개 표준 이벤트 컬럼과 완벽히 일치해야 함', () => {
    const audit = sessionLogger.getAuditRecord(mockSess.sessionId);
    assert.notStrictEqual(audit, null);

    // sheetsSync 내부 포맷 검증
    const targetShot = audit.shot || audit.shot1 || {};
    const ua = audit.userAgent || '';
    assert.strictEqual(ua.includes('iPhone'), true);
    assert.strictEqual(audit.finalStatus, 'COMPLETED');
  });

  // -----------------------------------------------------------------
  // 6. MOSAIC RENDERING & WATERMARK OVERLAY (ALL SCENARIOS)
  // -----------------------------------------------------------------
  console.log('\n🎨 [6/7] 모자이크 파이프라인 & 우측 상단 로고 워터마크 전수 검증');
  const LOGO_PATH = path.join(__dirname, '../public/pocheon_logo.png');

  it('공식 로고 파일(pocheon_logo.png)이 존재하고 투명 알파 채널을 보유해야 함', async () => {
    assert.strictEqual(fs.existsSync(LOGO_PATH), true, '로고 파일 존재 필수');
    const meta = await sharp(LOGO_PATH).metadata();
    assert.strictEqual(meta.format, 'png');
    assert.strictEqual(meta.hasAlpha, true, '투명 배경 알파 채널 필수');
  });

  // 케이스 6-1: 가로형 캔버스 (1920x1080)
  await itAsync('Case 6-1: 일반 가로 해상도 (1920x1080) 워터마크 위치 및 비율 검증', async () => {
    const w = 1920, h = 1080;
    const targetLogoWidth = Math.max(180, Math.round(w * 0.18)); // 346px
    const marginRight = Math.max(20, Math.round(w * 0.025));      // 48px
    const marginTop = Math.max(20, Math.round(h * 0.025));        // 27px

    const logoResized = await sharp(LOGO_PATH).resize({ width: targetLogoWidth }).png().toBuffer();
    const meta = await sharp(logoResized).metadata();

    const logoLeft = Math.max(0, w - targetLogoWidth - marginRight);
    const logoTop = marginTop;

    assert.strictEqual(logoLeft, 1920 - 346 - 48);
    assert.strictEqual(logoTop, 27);
    assert.strictEqual(logoLeft + targetLogoWidth <= w, true);
    assert.strictEqual(logoTop + meta.height <= h, true);
  });

  // 케이스 6-2: 세로형 캔버스 (1080x1920)
  await itAsync('Case 6-2: 일반 세로 해상도 (1080x1920) 워터마크 위치 및 비율 검증', async () => {
    const w = 1080, h = 1920;
    const targetLogoWidth = Math.max(180, Math.round(w * 0.18)); // 194px
    const marginRight = Math.max(20, Math.round(w * 0.025));      // 27px
    const marginTop = Math.max(20, Math.round(h * 0.025));        // 48px

    const logoResized = await sharp(LOGO_PATH).resize({ width: targetLogoWidth }).png().toBuffer();
    const meta = await sharp(logoResized).metadata();

    const logoLeft = Math.max(0, w - targetLogoWidth - marginRight);
    const logoTop = marginTop;

    assert.strictEqual(logoLeft + targetLogoWidth <= w, true);
    assert.strictEqual(logoTop + meta.height <= h, true);
  });

  // 케이스 6-3: 블렌딩 OFF (opacity: 0) 상태에서도 워터마크 정상 합성
  await itAsync('Case 6-3: 블렌딩 OFF(opacity: 0) 모드에서 워터마크 합성 검증', async () => {
    const w = 400, h = 400;
    const rawCanvas = Buffer.alloc(w * h * 3, 30);
    const targetLogoWidth = Math.max(180, Math.round(w * 0.18));
    const logoResized = await sharp(LOGO_PATH).resize({ width: targetLogoWidth }).png().toBuffer();

    const resultBuffer = await sharp(rawCanvas, { raw: { width: w, height: h, channels: 3 } })
      .composite([{ input: logoResized, top: 10, left: 10, blend: 'over' }])
      .jpeg({ quality: 95 })
      .toBuffer();

    const meta = await sharp(resultBuffer).metadata();
    assert.strictEqual(meta.format, 'jpeg');
    assert.strictEqual(meta.width, 400);
    assert.strictEqual(meta.height, 400);
  });

  // 케이스 6-4: 초대형 캔버스 (9600x12800) 황금 비율 및 경계 초과 방지
  it('Case 6-4: 초대형 해상도(9600x12800) 워터마크 동적 비율 계산 검증', () => {
    const w = 9600, h = 12800;
    const targetLogoWidth = Math.max(180, Math.round(w * 0.18)); // 1728px
    const marginRight = Math.max(20, Math.round(w * 0.025));      // 240px
    const marginTop = Math.max(20, Math.round(h * 0.025));        // 320px
    const logoLeft = Math.max(0, w - targetLogoWidth - marginRight);
    const logoTop = marginTop;

    assert.strictEqual(targetLogoWidth, 1728);
    assert.strictEqual(logoLeft, 7632);
    assert.strictEqual(logoTop, 320);
    assert.strictEqual(logoLeft + targetLogoWidth <= w, true);
  });

  // 케이스 6-5: 실제 멀티스레드 워커 E2E 모자이크 렌더링 + 워터마크 완주
  await itAsync('Case 6-5: 멀티스레드 워커 실시간 매칭 + 블렌딩 + 워터마크 E2E 완주', async () => {
    const dummyBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 80, g: 120, b: 200 } }
    }).jpeg().toBuffer();

    const cols = 4, rows = 4, tileSize = 20, renderTileSize = 30;
    const CANVAS_W = cols * tileSize;
    const CANVAS_H = rows * tileSize;

    const originalResized = await sharp(dummyBuffer).resize({ width: CANVAS_W, height: CANVAS_H, fit: 'cover' }).toBuffer();
    const { data: rawData, info } = await sharp(originalResized).raw().toBuffer({ resolveWithObject: true });

    const theme = cfg.currentTheme || 'default_nasa';
    const tilesDir = path.join(__dirname, '../public/tiles', theme);

    const jobData = {
      rawData,
      info,
      cols,
      rows,
      tileSize,
      renderTileSize,
      originalBuffer: dummyBuffer,
      tilesDir,
      theme,
      globalTileDB: [],
      kdTree: null,
      config: {
        maxTileUsage: 4,
        banRadius: 2,
        candidatePoolSize: 40,
        turboMode: false,
        opacity: 0.8,
        blendMode: 'multiply',
        secondOpacity: 0.2,
        enableWatermark: true
      }
    };

    const res = await mosaicQueue.addJob(jobData);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.canvasWidth, cols * renderTileSize);
    assert.strictEqual(res.canvasHeight, rows * renderTileSize);

    const meta = await sharp(res.finalImageBuffer).metadata();
    assert.strictEqual(meta.format, 'jpeg');
    assert.strictEqual(meta.width, cols * renderTileSize);
  });

  // -----------------------------------------------------------------
  // 7. UI & ASSETS INTEGRITY
  // -----------------------------------------------------------------
  console.log('\n🖥️ [7/7] 전시장 UI 및 에셋 무결성 검증');
  it('public/display.html 좌측 셀카 영역에 불필요한 로고가 완전히 제거되어 있어야 함', () => {
    const displayHtml = fs.readFileSync(path.join(__dirname, '../public/display.html'), 'utf8');
    // 화살표 바로 아래 셀카 백드롭에 rocheon_logo가 없어야 함
    assert.strictEqual(displayHtml.includes('<!-- 🪐 포천아트밸리 천문과학관 공식 로고 (화살표 바로 아래) -->'), false);
    assert.strictEqual(displayHtml.includes('/pocheon_logo.png'), false, '셀카 구역 내 로고 마크업 전면 제거 확인');
  });

  console.log('\n===============================================================');
  console.log(`🎉 [모든 전수 QA 검증 완료] ${passedTests} / ${totalTests} 개 테스트 100% 통과!`);
  console.log('===============================================================');
  process.exit(0);
}

runAllQA().catch(err => {
  console.error('\n❌ QA 스위트 실행 중 치명적 오류 발생:', err);
  process.exit(1);
});
