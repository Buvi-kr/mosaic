const fs = require('fs');
const path = require('path');
const sheetsSync = require('./sheets.sync');

/**
 * SessionLogger (V9.0 Streamlined Single-Shot Session Journey & Audit Engine)
 * 
 * 전시장 단일 촬영(1회차) 원칙에 맞춘 관람객 전체 여정 정밀 추적 및 영구 기록:
 * 1. 세션아이디 (sessionId) & 토큰
 * 2. 접근일시 (KST accessTime) & 클라이언트 환경 (IP, UserAgent)
 * 3. 촬영 성공 여부 (captureSuccess, 촬영 소요시간)
 * 4. 업로드 성공 여부 (uploadSuccess, 원본 파일 크기)
 * 5. 모자이크 완성 여부 (mosaicSuccess, 연산 시간, 해상도, 타일 수, 테마)
 * 6. 다운로드 여부 (downloaded, 다운로드 횟수, 파일명)
 * 7. 최종 상태 및 총 체류시간 (finalStatus, abortReason, totalStaySec)
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
    setInterval(() => this.cleanupOldJsonLogs(), 60 * 60 * 1000).unref();
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
      
      // 단일 촬영(Single-Shot) 이벤트 타임스탬프 & 정밀 지표
      shot: {
        captureStarted: false,
        captureStartedAt: null,       // 카메라 오픈 시작 시각 (ms)
        captureDurationSec: null,     // 촬영까지 고민한 시간 (초)
        captureSuccess: false,
        
        uploadAttempted: false,
        uploadedAt: null,             // 촬영 및 원본 업로드 완료 시각 (ms)
        uploadSuccess: false,
        fileSize: null,
        
        mosaicAttempted: false,
        mosaicSuccess: false,
        mosaicCompletedAt: null,      // 모자이크 렌더링 완료 시각 (ms)
        displayAt: null,              // 미디어월 전시 시작 시각 (ms)
        mosaicDurationSec: null,      // 순수 모자이크 합성 연산 속도 (초)
        resultUrl: null,
        resolution: null,
        tilesCount: null,
        theme: null,
        
        downloaded: false,
        downloadedAt: null,           // 모바일 사진 다운로드 클릭 시각 (ms)
        downloadFilename: null
      },

      // 구버전 및 sheetsSync 호환성을 위한 shot1 getter 연동
      get shot1() {
        return this.shot;
      },

      // 다운로드 종합
      downloads: {
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
    const targetShot = audit.shot || audit.shot1;
    targetShot.captureStarted = true;
    targetShot.captureStartedAt = now;

    const elapsedFromEntry = ((now - audit.createdAt) / 1000).toFixed(1);
    this.appendDailyStreamLog(`[${this.getKstString()}] [촬영시작] ID: ${sessionId} (진입 후 ${elapsedFromEntry}s 경과)`);
  }

  // ===== 3. 업로드 수신 기록 =====
  recordUploadReceived(sessionId, shotNumber = 1, fileInfo = {}) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const now = Date.now();
    const targetShot = audit.shot || audit.shot1;
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
    this.appendDailyStreamLog(`[${this.getKstString()}] [업로드성공] ID: ${sessionId} | 크기: ${sizeMb}MB | 촬영~업로드: ${targetShot.captureDurationSec || '-'}s`);
  }

  // ===== 4. 모자이크 렌더링 성공 기록 =====
  recordMosaicSuccess(sessionId, shotNumber = 1, stats = {}) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const now = Date.now();
    const targetShot = audit.shot || audit.shot1;
    targetShot.mosaicAttempted = true;
    targetShot.mosaicSuccess = true;
    targetShot.mosaicCompletedAt = now;
    targetShot.displayAt = now;
    targetShot.mosaicDurationSec = stats.elapsed ? parseFloat(stats.elapsed) : null;
    targetShot.resultUrl = stats.resultUrl || null;
    targetShot.resolution = stats.resolution || null;
    targetShot.tilesCount = stats.totalCells || null;
    targetShot.theme = stats.theme || null;

    this.appendDailyStreamLog(`[${this.getKstString()}] [모자이크성공] ID: ${sessionId} | 소요: ${targetShot.mosaicDurationSec}s | 테마: ${targetShot.theme} | 해상도: ${targetShot.resolution}`);
  }

  // ===== 5. 모자이크 렌더링 실패 기록 =====
  recordMosaicFailure(sessionId, shotNumber = 1, reason = '') {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    const targetShot = audit.shot || audit.shot1;
    targetShot.mosaicAttempted = true;
    targetShot.mosaicSuccess = false;
    audit.abortReason = reason;

    this.appendDailyStreamLog(`[${this.getKstString()}] [모자이크실패] ID: ${sessionId} | 사유: ${reason}`);
    this.writeOrUpdateCsvAudit(audit);
    this.writeJsonAudit(audit);
  }

  // ===== 6. (레거시 호환) 결정 기록 =====
  recordDecision(sessionId, choice, durationSec = null) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    if (audit.decision) {
      audit.decision.answeredAt = Date.now();
      audit.decision.choice = choice;
    }
  }

  // ===== 7. 다운로드 성공/클릭 기록 =====
  recordDownload(sessionId, shotNumber = 1, filename = '') {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return false;

    const now = Date.now();
    const targetShot = audit.shot || audit.shot1;
    targetShot.downloaded = true;
    targetShot.downloadedAt = now;
    targetShot.downloadFilename = filename;

    audit.downloads.totalCount = (audit.downloads.totalCount || 0) + 1;

    const kstNow = this.getKstString(new Date(now));
    this.appendDailyStreamLog(`[${kstNow}] [다운로드성공] ID: ${sessionId} | 파일: ${filename}`);

    // 월간 stats 로그에도 다운로드 즉시 기록
    try {
      const statsFile = path.join(this.logsDir, `stats_${this.getDateString(new Date(now))}.log`);
      const downloadLogLine = `[${kstNow}] [사진 다운로드 완료] ID: ${sessionId} | 모자이크 저장 (${filename || 'mosaic.jpg'})\n`;
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

  // ===== 8. 세션 종료 및 종합 여정 감사 로그 발행 (단일 촬영 파이프라인 정렬) =====
  recordSessionEnd(sessionId, finalStatus, reason = null) {
    const audit = this.auditMap.get(sessionId);
    if (!audit) return;

    if (audit.isFinishedLogged && (finalStatus === 'COMPLETED_SINGLE' || finalStatus === 'COMPLETED')) {
      return; // 중복 완료 로깅 방지
    }

    const now = Date.now();
    audit.completedAt = now;
    audit.finalStatus = finalStatus;
    audit.abortReason = reason;
    audit.totalStaySec = parseFloat(((now - audit.createdAt) / 1000).toFixed(1));
    audit.isFinishedLogged = true;

    // 단일 촬영 통계 지표 산출
    const shotObj = audit.shot || audit.shot1;
    const shotCap = shotObj.captureSuccess ? 'O' : (shotObj.captureStarted ? '시도(미완)' : 'X');
    const shotUp = shotObj.uploadSuccess ? 'O' : 'X';
    const shotMos = shotObj.mosaicSuccess ? `O(${shotObj.mosaicDurationSec}s)` : 'X';
    const downText = (audit.downloads.totalCount > 0 || shotObj.downloaded) ? `O(${audit.downloads.totalCount || 1}건)` : 'X';

    // 1) 월간 통계 파일(logs/stats_YYYY-MM.log)에 세션 여정 종합 감사 라인 기록 (깔끔한 1회 촬영 라인)
    const kstNow = this.getKstString(new Date(now));
    const isCompleted = finalStatus.startsWith('COMPLETED');
    const statsLogLine = `[${kstNow}] [세션 여정 ${isCompleted ? '완료' : '종료'}] ID: ${sessionId} | 체류: ${audit.totalStaySec}s | 촬영: ${shotCap} | 업로드: ${shotUp} | 모자이크: ${shotMos} | 다운로드: ${downText} | 최종상태: ${finalStatus}${reason ? ` (${reason})` : ''}\n`;

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

  // ===== CSV 헬퍼: 헤더 반환 (단일 촬영 체계 / 엑셀 한글 깨짐 방지 UTF-8 BOM 포함) =====
  getCsvHeader() {
    return '\uFEFF세션ID,접근일시(KST),접근모드,클라이언트IP,기기환경,촬영성공,촬영시간(초),업로드성공,파일크기(KB),모자이크성공,모자이크시간(초),타일수,해상도,테마,다운로드여부,다운로드수,최종상태,종료사유,총체류시간(초)\n';
  }

  // ===== CSV 헬퍼: 감사 객체를 CSV 1행으로 포맷 =====
  formatAuditCsvRow(audit) {
    const shotObj = audit.shot || audit.shot1;
    const shotCap = shotObj.captureSuccess ? '성공' : (shotObj.captureStarted ? '시도(미완)' : '미촬영');
    const shotUp = shotObj.uploadSuccess ? '성공' : (shotObj.uploadAttempted ? '실패' : '미업로드');
    const shotMos = shotObj.mosaicSuccess ? '성공' : (shotObj.mosaicAttempted ? '실패' : '미합성');

    const isDownloaded = (audit.downloads.totalCount > 0 || shotObj.downloaded) ? 'O' : 'X';

    return [
      this.escapeCsv(audit.sessionId),
      this.escapeCsv(audit.accessTime),
      this.escapeCsv(audit.accessMode),
      this.escapeCsv(audit.clientIp),
      this.escapeCsv(audit.userAgent),
      this.escapeCsv(shotCap),
      this.escapeCsv(shotObj.captureDurationSec ?? ''),
      this.escapeCsv(shotUp),
      this.escapeCsv(shotObj.fileSize ?? ''),
      this.escapeCsv(shotMos),
      this.escapeCsv(shotObj.mosaicDurationSec ?? ''),
      this.escapeCsv(shotObj.tilesCount ?? ''),
      this.escapeCsv(shotObj.resolution ?? ''),
      this.escapeCsv(shotObj.theme ?? ''),
      this.escapeCsv(isDownloaded),
      this.escapeCsv(audit.downloads.totalCount || 0),
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

      // Google Sheets 원격 관제 실시간 동기화 (fire-and-forget, 실패해도 로컬 저장에 영향 없음)
      if (sheetsSync.isEnabled()) {
        sheetsSync.syncSessionRow(audit).catch(() => {});
      }
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

  // ===== 감사 기록 단건 조회 =====
  getAuditRecord(sessionId) {
    return this.auditMap.get(sessionId) || null;
  }

  // ===== 현재 월간 CSV 감사 파일 경로 조회 =====
  getCsvFilePath(date = new Date()) {
    const monthStr = this.getDateString(date);
    return path.join(this.sessionLogsDir, `session_journey_${monthStr}.csv`);
  }

  // ===== 관리자 대시보드용 세션 전환율 & 집계 통계 =====
  getAggregatedStats() {
    const list = Array.from(this.auditMap.values());
    const totalSessions = list.length;

    let captureCount = 0;
    let uploadCount = 0;
    let mosaicCount = 0;
    let downloadCount = 0;
    let completedCount = 0;
    let totalStaySum = 0;
    let stayCount = 0;

    for (const a of list) {
      const s = a.shot || a.shot1;
      if (s.captureSuccess) captureCount++;
      if (s.uploadSuccess) uploadCount++;
      if (s.mosaicSuccess) mosaicCount++;
      if (a.downloads.totalCount > 0 || s.downloaded) downloadCount++;
      if (a.finalStatus && a.finalStatus.startsWith('COMPLETED')) completedCount++;
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
      captureRate: totalSessions > 0 ? ((captureCount / totalSessions) * 100).toFixed(1) : '0.0',
      uploadRate: totalSessions > 0 ? ((uploadCount / totalSessions) * 100).toFixed(1) : '0.0',
      mosaicRate: totalSessions > 0 ? ((mosaicCount / totalSessions) * 100).toFixed(1) : '0.0',
      downloadRate: completedCount > 0 ? ((downloadCount / completedCount) * 100).toFixed(1) : '0.0',
      avgStaySec,
      recentSessions: list
        .slice(-20)
        .reverse()
        .map(a => {
          const s = a.shot || a.shot1;
          return {
            sessionId: a.sessionId,
            accessTime: a.accessTime,
            staySec: a.totalStaySec || ((Date.now() - a.createdAt) / 1000).toFixed(1),
            shotCapture: s.captureSuccess,
            shotMosaic: s.mosaicSuccess,
            mosaicDuration: s.mosaicDurationSec,
            downloadCount: a.downloads.totalCount || (s.downloaded ? 1 : 0),
            finalStatus: a.finalStatus,
            abortReason: a.abortReason
          };
        })
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

  // ===== 9. 서버 에러 & 시스템 결함 영구 기록 (server.error.log) =====
  logServerError(moduleName, err, context = {}) {
    const kstNow = this.getKstString();
    const errMsg = err && err.stack ? err.stack : (err ? String(err) : 'Unknown Error');
    const ctxStr = Object.keys(context).length > 0 ? ` | Context: ${JSON.stringify(context)}` : '';
    const logLine = `[${kstNow}] [${moduleName}] ERROR: ${errMsg}${ctxStr}\n`;

    console.error(`[서버에러] [${moduleName}]`, err);
    try {
      const errorLogPath = path.join(this.logsDir, 'server.error.log');
      fs.appendFileSync(errorLogPath, logLine, 'utf8');
    } catch (e) {
      console.error('에러 파일 기록 실패:', e.message);
    }
  }

  // ===== 최근 서버 에러 로그 조회 (관리자 대시보드 모니터링용) =====
  getRecentServerErrors(maxLines = 100) {
    try {
      const errorLogPath = path.join(this.logsDir, 'server.error.log');
      if (!fs.existsSync(errorLogPath)) return [];
      const content = fs.readFileSync(errorLogPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      return lines.slice(-maxLines);
    } catch (e) {
      return [];
    }
  }

  // ===== 서버 에러 로그 초기화 =====
  clearServerErrors() {
    try {
      const errorLogPath = path.join(this.logsDir, 'server.error.log');
      fs.writeFileSync(errorLogPath, `[${this.getKstString()}] [SYSTEM] 로그가 관리자에 의해 초기화되었습니다.\n`, 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = new SessionLogger();

