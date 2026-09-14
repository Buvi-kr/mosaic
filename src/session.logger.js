const fs = require('fs');
const path = require('path');

/**
 * SessionLogger (V8.8 Advanced Session Journey & Audit Logging Engine)
 * 
 * 전시장 관람객의 전체 여정을 7대 핵심 지표로 정밀 추적하여 영구 기록:
 * 1. 세션아이디 (sessionId)
 * 2. 접근일시 (KST accessTime) & 클라이언트 정보
 * 3. 촬영 성공 여부 (captureSuccess, 촬영 소요시간)
 * 4. 업로드 성공 여부 (uploadSuccess, 파일 크기)
 * 5. 모자이크 성공 여부 (mosaicSuccess, 연산 시간, 해상도, 타일 수)
 * 6. 추가 촬영 여부 (retryChoice: YES/NO/TIMEOUT, 2차 촬영/모자이크 성공 여부)
 * 7. 다운로드 성공 여부 (downloadSuccess: 1회차, 2회차, 총 다운로드 수)
 */
class SessionLogger {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
    this.sessionLogsDir = path.join(this.logsDir, 'sessions');
    this.jsonLogsDir = path.join(this.sessionLogsDir, 'json');

    this.ensureDirectories();

    // 인메모리 감사 저장소 (sessionId -> auditRecord)
    this.auditMap = new Map();

    // 7일 지난 JSON 감사 파일 자동 정리 (매 시간)
    setInterval(() => this.cleanupOldJsonLogs(), 60 * 60 * 1000);
  }

  ensureDirectories() {
    if (!fs.existsSync(this.logsDir)) fs.mkdirSync(this.logsDir, { recursive: true });
    if (!fs.existsSync(this.sessionLogsDir)) fs.mkdirSync(this.sessionLogsDir, { recursive: true });
    if (!fs.existsSync(this.jsonLogsDir)) fs.mkdirSync(this.jsonLogsDir, { recursive: true });
  }

  getKstString(date = new Date()) {
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  getDateString(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }

  getDayString(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ===== 1. 세션 접근/생성 기록 =====
  recordAccess(session, reqMeta = {}) {
    const now = new Date();
    const sessionId = session.sessionId;

    const audit = {
      sessionId,
      sessionToken: session.sessionToken,
      clientIp: reqMeta.ip || '127.0.0.1',
      userAgent: reqMeta.userAgent || 'Unknown',
      createdAt: now.getTime(),
      accessTime: this.getKstString(now),
      accessMode: session.state === 'RESERVED' ? 'IMMEDIATE' : 'WAITING_LINE',
      
      // 1회차 지표
      shot1: {
        captureStarted: false,
        captureStartedAt: null,
        captureDurationSec: null,
        captureSuccess: false,
        
        uploadAttempted: false,
        uploadedAt: null,
        uploadSuccess: false,
        fileSize: null,
        
        mosaicAttempted: false,
        mosaicSuccess: false,
        mosaicDurationSec: null,
        resultUrl: null,
        resolution: null,
        tilesCount: null,
        theme: null,
        
        downloaded: false,
        downloadedAt: null,
        downloadFilename: null
      },

      // 추가 촬영 결정 지표
      decision: {
        promptedAt: null,
        answeredAt: null,
        choice: null, // 'RETRY' | 'FINISH' | 'TIMEOUT'
        durationSec: null,
        hasSecondShot: false
      },

      // 2회차 지표
      shot2: {
        captureStarted: false,
        captureStartedAt: null,
        captureDurationSec: null,
        captureSuccess: false,
        
        uploadAttempted: false,
        uploadedAt: null,
        uploadSuccess: false,
        fileSize: null,
        
        mosaicAttempted: false,
        mosaicSuccess: false,
        mosaicDurationSec: null,
        resultUrl: null,
        resolution: null,
        tilesCount: null,
        theme: null,
        
        downloaded: false,
        downloadedAt: null,
        downloadFilename: null
      },

      // 다운로드 종합
      downloads: {
        shot1: false,
        shot2: false,
        totalCount: 0
      },

      // 최종 상태 및 체류 시간
      finalStatus: 'IN_PROGRESS',
      abortReason: null,
      completedAt: null,
      totalStaySec: null,
      isFinishedLogged: false
    };

    this.auditMap.set(sessionId, audit);

    this.appendDailyStreamLog(`[${audit.accessTime}] [입장] ID: ${sessionId} | 모드: ${audit.accessMode} | IP: ${audit.clientIp}`);
    this.writeOrUpdateCsvAudit(audit);
    return audit;
  }

  // ===== 2. 촬영 시작 기록 =====
  recordCaptureStart(sessionId, shotNumber = 1) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const now = Date.now();
    const targetShot = shotNumber === 2 ? audit.shot2 : audit.shot1;
    targetShot.captureStarted = true;
    targetShot.captureStartedAt = now;

    const elapsedFromEntry = ((now - audit.createdAt) / 1000).toFixed(1);
    this.appendDailyStreamLog(`[${this.getKstString()}] [촬영시작 #${shotNumber}] ID: ${sessionId} (진입 후 ${elapsedFromEntry}s 경과)`);
  }

  // ===== 3. 업로드 수신 기록 =====
  recordUploadReceived(sessionId, shotNumber = 1, fileInfo = {}) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const now = Date.now();
    const targetShot = shotNumber === 2 ? audit.shot2 : audit.shot1;
    targetShot.uploadAttempted = true;
    targetShot.uploadedAt = now;
    targetShot.uploadSuccess = true;
    targetShot.fileSize = fileInfo.size || 0;

    // 촬영~업로드 소요 시간
    if (targetShot.captureStartedAt) {
      targetShot.captureDurationSec = parseFloat(((now - targetShot.captureStartedAt) / 1000).toFixed(1));
    }
    targetShot.captureSuccess = true; // 업로드 성공은 곧 촬영 완료를 입증

    const sizeMb = (targetShot.fileSize / (1024 * 1024)).toFixed(2);
    this.appendDailyStreamLog(`[${this.getKstString()}] [업로드성공 #${shotNumber}] ID: ${sessionId} | 크기: ${sizeMb}MB | 촬영~업로드: ${targetShot.captureDurationSec || '-'}s`);
  }

  // ===== 4. 모자이크 렌더링 성공 기록 =====
  recordMosaicSuccess(sessionId, shotNumber = 1, stats = {}) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const targetShot = shotNumber === 2 ? audit.shot2 : audit.shot1;
    targetShot.mosaicAttempted = true;
    targetShot.mosaicSuccess = true;
    targetShot.mosaicDurationSec = stats.elapsed ? parseFloat(stats.elapsed) : null;
    targetShot.resultUrl = stats.resultUrl || null;
    targetShot.resolution = stats.resolution || null;
    targetShot.tilesCount = stats.totalCells || null;
    targetShot.theme = stats.theme || null;

    if (shotNumber === 1) {
      audit.decision.promptedAt = Date.now();
    }

    this.appendDailyStreamLog(`[${this.getKstString()}] [모자이크성공 #${shotNumber}] ID: ${sessionId} | 소요: ${targetShot.mosaicDurationSec}s | 테마: ${targetShot.theme} | 해상도: ${targetShot.resolution}`);
  }

  // ===== 5. 모자이크 렌더링 실패 기록 =====
  recordMosaicFailure(sessionId, shotNumber = 1, reason = '') {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const targetShot = shotNumber === 2 ? audit.shot2 : audit.shot1;
    targetShot.mosaicAttempted = true;
    targetShot.mosaicSuccess = false;

    this.appendDailyStreamLog(`[${this.getKstString()}] [모자이크실패 #${shotNumber}] ID: ${sessionId} | 사유: ${reason}`);
  }

  // ===== 6. 추가 촬영 결정 기록 =====
  recordDecision(sessionId, choice, durationSec = null) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const now = Date.now();
    audit.decision.answeredAt = now;
    audit.decision.choice = choice; // 'RETRY' | 'FINISH' | 'TIMEOUT'
    audit.decision.hasSecondShot = (choice === 'RETRY');

    if (audit.decision.promptedAt) {
      audit.decision.durationSec = parseFloat(((now - audit.decision.promptedAt) / 1000).toFixed(1));
    } else if (durationSec !== null) {
      audit.decision.durationSec = parseFloat(durationSec);
    }

    const choiceLabel = (choice === 'RETRY') ? '재도전(YES)' : (choice === 'FINISH' ? '마칠래요(NO)' : '타임아웃(10초만료)');
    this.appendDailyStreamLog(`[${this.getKstString()}] [추가촬영결정] ID: ${sessionId} | 선택: ${choiceLabel} (결정소요: ${audit.decision.durationSec || '-'}s)`);
  }

  // ===== 7. 다운로드 성공/클릭 기록 =====
  recordDownload(sessionId, shotNumber = 1, filename = '') {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return false;

    const now = Date.now();
    const targetShot = (shotNumber === 2) ? audit.shot2 : audit.shot1;
    targetShot.downloaded = true;
    targetShot.downloadedAt = now;
    targetShot.downloadFilename = filename;

    if (shotNumber === 2) {
      audit.downloads.shot2 = true;
    } else {
      audit.downloads.shot1 = true;
    }
    audit.downloads.totalCount++;

    const kstNow = this.getKstString(new Date(now));
    this.appendDailyStreamLog(`[${kstNow}] [다운로드성공 #${shotNumber}] ID: ${sessionId} | 파일: ${filename}`);

    // 월간 stats 로그에도 다운로드 즉시 기록
    try {
      const statsFile = path.join(this.logsDir, `stats_${this.getDateString(new Date(now))}.log`);
      const downloadLogLine = `[${kstNow}] [사진 다운로드 완료] ID: ${sessionId} | ${shotNumber}회차 모자이크 저장 (${filename || 'mosaic.jpg'})\n`;
      fs.appendFileSync(statsFile, downloadLogLine, 'utf8');
    } catch (e) {
      console.error('[세션 로거] 다운로드 stats 로그 기록 실패:', e.message);
    }

    // CSV 업데이트
    this.writeOrUpdateCsvAudit(audit);

    // 구조화 JSON 백업 갱신
    this.writeJsonAudit(audit);

    return true;
  }

  // ===== 8. 세션 종료 및 종합 여정 감사 로그 발행 (핵심!) =====
  recordSessionEnd(sessionId, finalStatus, reason = null) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    if (audit.isFinishedLogged && (finalStatus === 'COMPLETED_SINGLE' || finalStatus === 'COMPLETED_DUAL')) {
      return; // 중복 완료 로깅 방지
    }

    const now = Date.now();
    audit.completedAt = now;
    audit.finalStatus = finalStatus;
    audit.abortReason = reason;
    audit.totalStaySec = parseFloat(((now - audit.createdAt) / 1000).toFixed(1));
    audit.isFinishedLogged = true;

    // 통계 지표 산출
    const shot1Cap = audit.shot1.captureSuccess ? 'O' : (audit.shot1.captureStarted ? '시도(미완)' : 'X');
    const shot1Up = audit.shot1.uploadSuccess ? 'O' : 'X';
    const shot1Mos = audit.shot1.mosaicSuccess ? `O(${audit.shot1.mosaicDurationSec}s)` : 'X';

    let retryText = '-';
    if (audit.decision.choice === 'RETRY') {
      retryText = 'O(재도전)';
    } else if (audit.decision.choice === 'FINISH') {
      retryText = 'X(마칠래요)';
    } else if (audit.decision.choice === 'TIMEOUT') {
      retryText = 'X(10s타임아웃)';
    }

    let shot2Mos = '-';
    if (audit.decision.hasSecondShot) {
      shot2Mos = audit.shot2.mosaicSuccess ? `O(${audit.shot2.mosaicDurationSec}s)` : 'X(실패)';
    }

    let downText = 'X';
    if (audit.downloads.shot1 && audit.downloads.shot2) {
      downText = 'O(1차+2차)';
    } else if (audit.downloads.shot1) {
      downText = 'O(1차)';
    } else if (audit.downloads.shot2) {
      downText = 'O(2차)';
    }

    // 1) 월간 통계 파일(logs/stats_YYYY-MM.log)에 세션 여정 종합 감사 라인 기록
    const kstNow = this.getKstString(new Date(now));
    const statsLogLine = `[${kstNow}] [세션 여정 ${finalStatus.startsWith('COMPLETED') ? '완료' : '종료'}] ID: ${sessionId} | 체류: ${audit.totalStaySec}s | 촬영1: ${shot1Cap} | 업로드1: ${shot1Up} | 모자이크1: ${shot1Mos} | 추가촬영: ${retryText} | 모자이크2: ${shot2Mos} | 다운로드: ${downText} | 최종상태: ${finalStatus}${reason ? ` (${reason})` : ''}\n`;

    try {
      const statsFile = path.join(this.logsDir, `stats_${this.getDateString(new Date(now))}.log`);
      fs.appendFileSync(statsFile, statsLogLine, 'utf8');
    } catch (err) {
      console.error('[세션 로거] 월간 stats 로그 기록 실패:', err.message);
    }

    // 2) 일자별 스트림 로그에 완료 기록
    this.appendDailyStreamLog(`[${kstNow}] [세션종합요약] ID: ${sessionId} ➔ ${finalStatus} (체류: ${audit.totalStaySec}s, 다운로드: ${downText})`);

    // 3) CSV 감사 파일 업데이트
    this.writeOrUpdateCsvAudit(audit);

    // 4) 구조화 JSON 파일 저장
    this.writeJsonAudit(audit);
  }

  // ===== CSV 헬퍼: 특수문자 이스케이프 =====
  escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // ===== CSV 헬퍼: 헤더 반환 (엑셀 한글 깨짐 방지 UTF-8 BOM 포함) =====
  getCsvHeader() {
    return '\uFEFF세션ID,접근일시(KST),접근모드,클라이언트IP,기기환경,1차촬영성공,1차촬영시간(초),1차업로드성공,1차파일크기(KB),1차모자이크성공,1차모자이크시간(초),1차타일수,1차해상도,테마,추가촬영선택,2차촬영성공,2차모자이크성공,2차모자이크시간(초),다운로드_1차,다운로드_2차,총다운로드수,최종상태,종료사유,총체류시간(초)\n';
  }

  // ===== CSV 헬퍼: 감사 객체를 CSV 1행으로 포맷 =====
  formatAuditCsvRow(audit) {
    const shot1Cap = audit.shot1.captureSuccess ? '성공' : (audit.shot1.captureStarted ? '시도(미완)' : '미촬영');
    const shot1Up = audit.shot1.uploadSuccess ? '성공' : (audit.shot1.uploadAttempted ? '실패' : '미업로드');
    const shot1Mos = audit.shot1.mosaicSuccess ? '성공' : (audit.shot1.mosaicAttempted ? '실패' : '미합성');

    let retryChoice = audit.decision.choice || '미선택';
    let shot2Cap = '미진행';
    let shot2Mos = '미진행';
    if (audit.decision.hasSecondShot) {
      shot2Cap = audit.shot2.captureSuccess ? '성공' : (audit.shot2.captureStarted ? '시도' : '미촬영');
      shot2Mos = audit.shot2.mosaicSuccess ? '성공' : (audit.shot2.mosaicAttempted ? '실패' : '미합성');
    }

    const down1 = audit.downloads.shot1 ? 'O' : 'X';
    const down2 = audit.downloads.shot2 ? 'O' : 'X';

    return [
      this.escapeCsv(audit.sessionId),
      this.escapeCsv(audit.accessTime),
      this.escapeCsv(audit.accessMode),
      this.escapeCsv(audit.clientIp),
      this.escapeCsv(audit.userAgent),
      this.escapeCsv(shot1Cap),
      this.escapeCsv(audit.shot1.captureDurationSec ?? ''),
      this.escapeCsv(shot1Up),
      this.escapeCsv(audit.shot1.fileSize ?? ''),
      this.escapeCsv(shot1Mos),
      this.escapeCsv(audit.shot1.mosaicDurationSec ?? ''),
      this.escapeCsv(audit.shot1.tilesCount ?? ''),
      this.escapeCsv(audit.shot1.resolution ?? ''),
      this.escapeCsv(audit.shot1.theme ?? ''),
      this.escapeCsv(retryChoice),
      this.escapeCsv(shot2Cap),
      this.escapeCsv(shot2Mos),
      this.escapeCsv(audit.shot2.mosaicDurationSec ?? ''),
      this.escapeCsv(down1),
      this.escapeCsv(down2),
      this.escapeCsv(audit.downloads.totalCount),
      this.escapeCsv(audit.finalStatus || 'IN_PROGRESS'),
      this.escapeCsv(audit.abortReason || ''),
      this.escapeCsv(audit.totalStaySec ?? '')
    ].join(',');
  }

  // ===== CSV 헬퍼: 실시간 감사 행 기록 또는 갱신 (1 관람객 = 1 행 보장) =====
  writeOrUpdateCsvAudit(audit) {
    if (!audit || !audit.sessionId) return;
    try {
      const monthStr = this.getDateString(new Date(audit.createdAt || Date.now()));
      const csvPath = path.join(this.sessionLogsDir, `session_journey_${monthStr}.csv`);
      const row = this.formatAuditCsvRow(audit);

      let content = '';
      if (fs.existsSync(csvPath)) {
        content = fs.readFileSync(csvPath, 'utf8');
      }

      if (!content || !content.startsWith('\uFEFF')) {
        content = this.getCsvHeader();
      }

      const targetPrefix = audit.sessionId + ',';
      const lines = content.split(/\r?\n/);
      let foundIndex = -1;

      for (let i = 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith(targetPrefix)) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        lines[foundIndex] = row;
        content = lines.filter(l => l.length > 0).join('\n') + '\n';
      } else {
        content = content.trimEnd() + '\n' + row + '\n';
      }

      fs.writeFileSync(csvPath, content, 'utf8');
    } catch (err) {
      console.error('[세션 로거] CSV 감사 기록 실패:', err.message);
    }
  }

  // ===== CSV 파일 경로 조회 (관리자 내보내기용) =====
  getCsvFilePath(month = null) {
    const monthStr = month || this.getDateString();
    const csvPath = path.join(this.sessionLogsDir, `session_journey_${monthStr}.csv`);
    if (fs.existsSync(csvPath)) return csvPath;

    // 파일이 없으면 현재 메모리 기준 생성
    const header = this.getCsvHeader();
    const rows = [];
    for (const audit of this.auditMap.values()) {
      rows.push(this.formatAuditCsvRow(audit));
    }
    fs.writeFileSync(csvPath, header + rows.join('\n') + (rows.length ? '\n' : ''), 'utf8');
    return csvPath;
  }

  // ===== 헬퍼: 일자별 스트림 로그 파일 쓰기 =====
  appendDailyStreamLog(line) {
    try {
      const dayStr = this.getDayString();
      const dailyLogPath = path.join(this.sessionLogsDir, `session_journey_${dayStr}.log`);
      fs.appendFileSync(dailyLogPath, line + '\n', 'utf8');
    } catch (err) {
      console.error('[세션 로거] 일자별 스트림 로그 쓰기 실패:', err.message);
    }
  }

  // ===== 헬퍼: 구조화 JSON 파일 쓰기 =====
  writeJsonAudit(audit) {
    try {
      const jsonPath = path.join(this.jsonLogsDir, `${audit.sessionId}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(audit, null, 2), 'utf8');
    } catch (err) {
      console.error('[세션 로거] JSON 감사 파일 쓰기 실패:', err.message);
    }
  }

  // ===== 관리자 대시보드용 세션 전환율 & 집계 통계 =====
  getAggregatedStats() {
    const list = Array.from(this.auditMap.values());
    const totalSessions = list.length;

    let capture1Count = 0;
    let upload1Count = 0;
    let mosaic1Count = 0;
    let retryAttemptCount = 0;
    let mosaic2Count = 0;
    let downloadCount = 0;
    let completedCount = 0;
    let totalStaySum = 0;
    let stayCount = 0;

    for (const a of list) {
      if (a.shot1.captureSuccess) capture1Count++;
      if (a.shot1.uploadSuccess) upload1Count++;
      if (a.shot1.mosaicSuccess) mosaic1Count++;
      if (a.decision.hasSecondShot) retryAttemptCount++;
      if (a.shot2.mosaicSuccess) mosaic2Count++;
      if (a.downloads.totalCount > 0) downloadCount++;
      if (a.finalStatus.startsWith('COMPLETED')) completedCount++;
      if (a.totalStaySec) {
        totalStaySum += a.totalStaySec;
        stayCount++;
      }
    }

    const avgStaySec = stayCount > 0 ? (totalStaySum / stayCount).toFixed(1) : '0.0';

    return {
      totalSessions,
      completedCount,
      completionRate: totalSessions > 0 ? ((completedCount / totalSessions) * 100).toFixed(1) : '0.0',
      captureRate: totalSessions > 0 ? ((capture1Count / totalSessions) * 100).toFixed(1) : '0.0',
      uploadRate: totalSessions > 0 ? ((upload1Count / totalSessions) * 100).toFixed(1) : '0.0',
      mosaicRate: totalSessions > 0 ? ((mosaic1Count / totalSessions) * 100).toFixed(1) : '0.0',
      retryRate: mosaic1Count > 0 ? ((retryAttemptCount / mosaic1Count) * 100).toFixed(1) : '0.0',
      downloadRate: completedCount > 0 ? ((downloadCount / completedCount) * 100).toFixed(1) : '0.0',
      avgStaySec,
      recentSessions: list
        .slice(-20)
        .reverse()
        .map(a => ({
          sessionId: a.sessionId,
          accessTime: a.accessTime,
          staySec: a.totalStaySec || ((Date.now() - a.createdAt) / 1000).toFixed(1),
          shot1Capture: a.shot1.captureSuccess,
          shot1Mosaic: a.shot1.mosaicSuccess,
          mosaic1Duration: a.shot1.mosaicDurationSec,
          retryChoice: a.decision.choice || 'NONE',
          shot2Mosaic: a.shot2.mosaicSuccess,
          downloadCount: a.downloads.totalCount,
          finalStatus: a.finalStatus,
          abortReason: a.abortReason
        }))
    };
  }

  // ===== 오래된 JSON 로그 자동 정리 (7일 경과 파일 삭제) =====
  cleanupOldJsonLogs() {
    try {
      if (!fs.existsSync(this.jsonLogsDir)) return;
      const files = fs.readdirSync(this.jsonLogsDir);
      const now = Date.now();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(this.jsonLogsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

module.exports = new SessionLogger();
