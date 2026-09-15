const crypto = require('crypto');
const configModule = require('./config');
const sessionLogger = require('./session.logger');

/**
 * SessionManager (V8.8)
 * 
 * - 중앙 세션 저장소: sessions (Map<sessionToken, session>)
 * - 역할 포인터 분리: activePhotozoneToken, nextReservedToken
 * - 게이트 독립 플래그: isGateOpen, currentGateToken
 * - 2.5초 물리적 인계 완충 (handoffDelay)
 * - 3종 독립 타이머 (sessionTimer, decisionTimer, showcaseTimer)
 */
class SessionManager {
  constructor() {
    this.sessions = new Map(); // token -> session
    this.activePhotozoneToken = null;
    this.nextReservedToken = null;
    this.isGateOpen = true;
    this.currentGateToken = crypto.randomUUID();
    this.io = null;

    // 주기적 세션 가비지 컬렉션 (5분 이상 유휴 세션 정리)
    setInterval(() => this.cleanupStaleSessions(), 60000).unref();
  }

  setIo(ioInstance) {
    this.io = ioInstance;
  }

  getIo() {
    return this.io;
  }

  // ===== 타이머 헬퍼 =====
  setSessionTimer(session, ms, callback) {
    if (session.sessionTimer) {
      clearTimeout(session.sessionTimer);
      session.sessionTimer = null;
    }
    if (ms > 0 && typeof callback === 'function') {
      session.sessionTimer = setTimeout(() => {
        session.sessionTimer = null;
        callback();
      }, ms);
    }
  }

  setDecisionTimer(session, ms, callback) {
    if (session.decisionTimer) {
      clearTimeout(session.decisionTimer);
      session.decisionTimer = null;
    }
    if (ms > 0 && typeof callback === 'function') {
      session.decisionTimer = setTimeout(() => {
        session.decisionTimer = null;
        callback();
      }, ms);
    }
  }

  clearAllTimers(session) {
    if (session.sessionTimer) {
      clearTimeout(session.sessionTimer);
      session.sessionTimer = null;
    }
    if (session.decisionTimer) {
      clearTimeout(session.decisionTimer);
      session.decisionTimer = null;
    }
    if (session.graceTimer) {
      clearTimeout(session.graceTimer);
      session.graceTimer = null;
    }
  }

  // ===== 게이트 관리 =====
  rotateGateToken() {
    this.currentGateToken = crypto.randomUUID();
    return this.currentGateToken;
  }

  broadcastGateState() {
    if (this.io) {
      this.io.emit('gate_state', this.getGateState());
    }
  }

  broadcastStandGuide(duration = 3.5) {
    if (this.io) {
      this.io.emit('photozone_stand_guide', { duration });
    }
  }

  getGateState() {
    return {
      isOpen: this.isGateOpen,
      gateToken: this.currentGateToken,
      hasActivePhotozone: !!this.activePhotozoneToken,
      hasNextReserved: !!this.nextReservedToken,
    };
  }

  // ===== 세션 조회 =====
  getSession(sessionToken) {
    if (!sessionToken) return null;
    return this.sessions.get(sessionToken) || null;
  }

  getSessionBySocketId(socketId) {
    if (!socketId) return null;
    for (const session of this.sessions.values()) {
      if (session.socketId === socketId) return session;
    }
    return null;
  }

  // ===== 1. 슬롯 점유 요청 (QR 스캔 시점) =====
  claimSlot(gateToken, socketId, reqMeta = {}) {
    // 게이트가 닫혀있거나 토큰 불일치 시 거절
    if (!this.isGateOpen || gateToken !== this.currentGateToken) {
      return {
        success: false,
        code: 'SLOT_BUSY',
        message: '현재 다른 관람객이 체험 중입니다. 키오스크의 새 QR을 확인해주세요.'
      };
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionToken = `st_${crypto.randomUUID()}`;

    const session = {
      sessionId,
      sessionToken,
      socketId,
      state: 'INIT',
      shotCount: 0,
      currentShot: 1,
      shotRecords: new Map(), // shotNumber -> record
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      sessionTimer: null,
      decisionTimer: null,
      graceTimer: null,
    };

    this.sessions.set(sessionToken, session);
    sessionLogger.recordAccess(session, reqMeta);

    // 포토존이 비어 있는 경우 -> 즉시 activePhotozone 진입
    if (!this.activePhotozoneToken) {
      this.activePhotozoneToken = sessionToken;
      session.state = 'RESERVED';
      this.isGateOpen = false; // 촬영 완료 전까지 게이트 닫음
      this.rotateGateToken();
      this.broadcastGateState();
      this.broadcastStandGuide(3.5);

      // 최초 진입 방치 30초 타이머 가동
      this.setSessionTimer(session, 30000, () => {
        console.log(`[세션] 진입 방치(30초) 초과: ${sessionId}`);
        this.handleTimeout(session, 'ENTRY_TIMEOUT');
      });

      return {
        success: true,
        sessionToken,
        sessionId,
        state: 'RESERVED',
        isImmediate: true
      };
    }

    // 포토존에 이미 A가 있는 경우 -> B는 nextReserved로 대기
    if (!this.nextReservedToken) {
      this.nextReservedToken = sessionToken;
      session.state = 'WAITING_IN_LINE';
      this.isGateOpen = false; // 예약자까지 찼으므로 게이트 닫음
      this.rotateGateToken();
      this.broadcastGateState();

      // ※ 대기 중에는 30초 타이머를 켜지 않음 (승격 시점에 시작)
      return {
        success: true,
        sessionToken,
        sessionId,
        state: 'WAITING_IN_LINE',
        isImmediate: false
      };
    }

    // 대기자까지 꽉 찬 경우
    this.sessions.delete(sessionToken);
    return {
      success: false,
      code: 'SLOT_BUSY',
      message: '체험 대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.'
    };
  }

  // ===== 2. 촬영 시작 (셔터 터치 / 카메라 모드 진입) =====
  startCapture(sessionToken) {
    const session = this.getSession(sessionToken);
    if (!session) return { success: false, code: 'INVALID_SESSION' };

    // 권한 검증: 현재 포토존 권한자만 가능
    if (this.activePhotozoneToken !== sessionToken) {
      return { success: false, code: 'NOT_ACTIVE_PHOTOZONE' };
    }

    // 원자적 상태 검증: RESERVED 또는 CAPTURING_2 상태에서만 진입 가능
    if (session.state !== 'RESERVED' && session.state !== 'CAPTURING_2') {
      return { success: false, code: 'INVALID_STATE', currentState: session.state };
    }

    session.state = 'CAPTURING';
    session.lastActiveAt = Date.now();
    sessionLogger.recordCaptureStart(session.sessionId, session.currentShot);

    // 30초 진입 타이머 취소 & 60초 촬영 타이머 설정
    this.setSessionTimer(session, 60000, () => {
      console.log(`[세션] 촬영 시간(60초) 초과: ${session.sessionId}`);
      this.handleTimeout(session, 'CAPTURE_TIMEOUT');
    });

    return { success: true, state: session.state };
  }

  // ===== 3. 업로드 수신 및 처리 시작 =====
  beginProcessing(sessionToken, requestId) {
    const session = this.getSession(sessionToken);
    if (!session) return { success: false, code: 'INVALID_SESSION' };

    session.state = 'PROCESSING';
    session.lastActiveAt = Date.now();

    // 멱등성 레코드 기록
    const shotNumber = session.currentShot;
    session.shotRecords.set(shotNumber, {
      shotNumber,
      status: 'PROCESSING',
      requestId: requestId || crypto.randomUUID(),
      startedAt: Date.now(),
      resultUrl: null,
    });

    // 45초 처리 타임아웃
    this.setSessionTimer(session, 45000, () => {
      console.log(`[세션] 서버 처리 타임아웃(45초): ${session.sessionId}`);
      this.recordUploadFailure(sessionToken, 'PROCESSING_TIMEOUT');
    });

    return { success: true };
  }

  // ===== 4. 모자이크 파일 디스크 저장 완료 & 성공 확정 =====
  recordUploadSuccess(sessionToken, resultUrl, mosaicStats = {}) {
    const session = this.getSession(sessionToken);
    if (!session) return null;

    this.clearAllTimers(session);

    const shotNumber = session.currentShot;
    const record = session.shotRecords.get(shotNumber) || { shotNumber };
    record.status = 'COMPLETED';
    record.resultUrl = resultUrl;
    record.completedAt = Date.now();
    session.shotRecords.set(shotNumber, record);

    // ★ 황금 원칙: 파일 디스크 저장 및 COMPLETED 확정 시점에만 shotCount 증가
    session.shotCount++;
    session.lastActiveAt = Date.now();
    session.state = (shotNumber === 1) ? 'COMPLETED_1' : 'COMPLETED_2';

    // 세션 감사 로거에 모자이크 성공 기록
    sessionLogger.recordMosaicSuccess(session.sessionId, shotNumber, {
      ...mosaicStats,
      resultUrl
    });

    const config = configModule.getConfig();
    const displayDuration = (shotNumber === 2)
      ? (config.displayRetryDuration || 8)
      : (config.displayShowcaseDuration || 20);

    // ★ 1회차 성공 즉시 게이트 OPEN (다음 사람 QR 스캔 허용)
    if (shotNumber === 1) {
      this.isGateOpen = true;
      this.rotateGateToken();
      this.broadcastGateState();

      // 모바일 즉시 DECISION_1 진입: 20초 컨티뉴 카운트다운 가동 (사진 로딩 및 어르신 관람객 2배 여유 시간 보장)
      session.state = 'DECISION_1';
      this.setDecisionTimer(session, 20000, () => {
        console.log(`[세션] 20초 컨티뉴 결정 미응답 -> 1회차 다운로드로 자동 전환: ${session.sessionId}`);
        sessionLogger.recordDecision(session.sessionId, 'TIMEOUT', 20);
        this.finishExperience(sessionToken, 'TIMEOUT');
      });
    } else {
      // 2회차 완료 -> A는 포토존 점유를 끝마침 -> 2.5초 후 B 승격 트리거
      session.state = 'DOWNLOAD_DUAL';
      sessionLogger.recordSessionEnd(session.sessionId, 'COMPLETED_DUAL');
      this.promoteNextReserved();
    }

    return {
      displayDuration,
      shotCount: session.shotCount,
      currentShot: session.currentShot,
      resultUrl,
      allRecords: this.getAllRecords(session)
    };
  }

  // ===== 5. 업로드 / 처리 실패 =====
  recordUploadFailure(sessionToken, reason) {
    const session = this.getSession(sessionToken);
    if (!session) return;

    this.clearAllTimers(session);

    const shotNumber = session.currentShot;
    const record = session.shotRecords.get(shotNumber);
    if (record) {
      record.status = 'FAILED';
      record.failedAt = Date.now();
      record.error = reason;
    }

    sessionLogger.recordMosaicFailure(session.sessionId, shotNumber, reason);

    // ★ 황금 원칙: 실패 시 shotCount 절대 차감/증가 안 함
    session.state = 'RETRY_AVAILABLE';
    session.lastActiveAt = Date.now();

    if (this.io && session.socketId) {
      this.io.to(session.socketId).emit('processing_failed', {
        message: '사진 처리 중 문제가 발생했습니다. 다시 촬영해주세요.',
        canRetry: true,
        hasFirstShot: session.shotRecords.has(1) && session.shotRecords.get(1).status === 'COMPLETED'
      });
    }
  }

  // ===== 6. 2회차 촬영 시작 (보너스 선택) =====
  startSecondShot(sessionToken) {
    const session = this.getSession(sessionToken);
    if (!session) return { success: false, code: 'INVALID_SESSION' };

    if (session.shotCount !== 1) {
      return { success: false, code: 'CANNOT_RETRY', message: '2회차 촬영 자격이 없습니다.' };
    }

    // 결정 타이머 취소
    this.setDecisionTimer(session, 0);

    session.currentShot = 2;
    session.state = 'CAPTURING_2';
    session.lastActiveAt = Date.now();

    sessionLogger.recordDecision(session.sessionId, 'RETRY');
    sessionLogger.recordCaptureStart(session.sessionId, 2);
    this.broadcastStandGuide(3.5);

    // 2회차 촬영 시간 60초 타이머
    this.setSessionTimer(session, 60000, () => {
      console.log(`[세션] 2회차 촬영 시간(60초) 초과: ${session.sessionId}`);
      this.finishExperience(sessionToken, 'TIMEOUT');
    });

    return { success: true, state: session.state };
  }

  // ===== 7. 체험 완료 및 퇴장 (다운로드 화면 전환 & 포토존 인계) =====
  finishExperience(sessionToken, choice = 'FINISH') {
    const session = this.getSession(sessionToken);
    if (!session) return { success: false };

    this.setDecisionTimer(session, 0);

    session.state = (session.shotCount >= 2) ? 'DOWNLOAD_DUAL' : 'DOWNLOAD_1';
    session.lastActiveAt = Date.now();

    sessionLogger.recordDecision(session.sessionId, choice);
    sessionLogger.recordSessionEnd(
      session.sessionId,
      session.shotCount >= 2 ? 'COMPLETED_DUAL' : 'COMPLETED_SINGLE'
    );

    // A가 포토존을 점유하고 있었다면, B에게 2.5초 후 인계
    if (this.activePhotozoneToken === sessionToken) {
      this.promoteNextReserved();
    }

    return {
      success: true,
      state: session.state,
      allRecords: this.getAllRecords(session)
    };
  }

  // ===== 8. 다음 대기자 승격 (2.5초 완충 딜레이) =====
  promoteNextReserved() {
    this.activePhotozoneToken = null;

    if (!this.nextReservedToken) {
      // 대기자가 없으면 게이트 오픈 유지
      this.isGateOpen = true;
      this.broadcastGateState();
      return;
    }

    const nextToken = this.nextReservedToken;
    this.nextReservedToken = null;

    console.log('[세션] 2.5초 물리적 인계 완충 딜레이 시작...');

    // 2.5초 완충 후 B 승격
    setTimeout(() => {
      const nextSession = this.sessions.get(nextToken);
      if (!nextSession) {
        this.isGateOpen = true;
        this.broadcastGateState();
        return;
      }

      this.activePhotozoneToken = nextToken;
      nextSession.state = 'RESERVED';
      nextSession.lastActiveAt = Date.now();

      // ★ B가 진짜 승격된 이 순간부터 30초 진입 타이머 시작!
      this.setSessionTimer(nextSession, 30000, () => {
        console.log(`[세션] 승격 후 진입 방치(30초) 초과: ${nextSession.sessionId}`);
        this.handleTimeout(nextSession, 'ENTRY_TIMEOUT');
      });

      // B에게 촬영 준비 완료 신호 전송
      if (this.io && nextSession.socketId) {
        this.io.to(nextSession.socketId).emit('photozone_ready', {
          message: '포토존이 준비되었습니다! 촬영을 시작해주세요.',
          state: 'RESERVED'
        });
      }

      this.broadcastGateState();
      this.broadcastStandGuide(3.5);
      console.log(`[세션] 관람객 승격 완료: ${nextSession.sessionId}`);
    }, 2500);
  }

  // ===== 9. 소켓 연결 단절 처리 (20초 Grace Period) =====
  handleDisconnect(socketId) {
    const session = this.getSessionBySocketId(socketId);
    if (!session) return;

    // 이미 완료/다운로드 상태인 경우 슬롯 회수 불필요
    if (session.state === 'DOWNLOAD_1' || session.state === 'DOWNLOAD_DUAL') {
      return;
    }

    session.previousState = session.state;
    session.state = 'DISCONNECTED_GRACE';

    // 20초 유예 타이머 시작
    if (session.graceTimer) clearTimeout(session.graceTimer);
    session.graceTimer = setTimeout(() => {
      console.log(`[세션] 재연결 유예(20초) 초과 - 슬롯 자동 회수: ${session.sessionId}`);
      this.handleTimeout(session, 'DISCONNECT_TIMEOUT');
    }, 20000);
  }

  // ===== 10. 소켓 재연결 처리 =====
  handleReconnect(socketId, sessionToken) {
    const session = this.getSession(sessionToken);
    if (!session) return { success: false, code: 'NOT_FOUND' };

    session.socketId = socketId;
    session.lastActiveAt = Date.now();

    if (session.graceTimer) {
      clearTimeout(session.graceTimer);
      session.graceTimer = null;
    }

    // 소켓 단절 중 완료된 모자이크 결과가 있는지 확인
    const currentShot = session.currentShot;
    const record = session.shotRecords.get(currentShot);
    const hasCompletedResult = record && record.status === 'COMPLETED';

    if (session.state === 'DISCONNECTED_GRACE') {
      session.state = hasCompletedResult
        ? (currentShot === 1 ? 'COMPLETED_1' : 'COMPLETED_2')
        : (session.previousState || 'RESERVED');
    }

    return {
      success: true,
      state: session.state,
      shotCount: session.shotCount,
      currentShot: session.currentShot,
      completedResult: hasCompletedResult ? record.resultUrl : null,
      allRecords: this.getAllRecords(session)
    };
  }

  // ===== 11. 타임아웃 공통 처리 =====
  handleTimeout(session, reason) {
    this.clearAllTimers(session);
    session.state = 'ABORTED';
    session.abortReason = reason;

    sessionLogger.recordSessionEnd(session.sessionId, 'ABORTED', reason);

    if (this.activePhotozoneToken === session.sessionToken) {
      this.promoteNextReserved();
    } else if (this.nextReservedToken === session.sessionToken) {
      this.nextReservedToken = null;
      this.isGateOpen = true;
      this.broadcastGateState();
    }

    if (this.io && session.socketId) {
      this.io.to(session.socketId).emit('session_aborted', {
        reason,
        message: '대기 시간이 초과되어 세션이 종료되었습니다.'
      });
    }
  }

  // ===== 헬퍼: 세션의 모든 결과 레코드 배열 변환 =====
  getAllRecords(session) {
    const records = [];
    for (const [shotNumber, rec] of session.shotRecords.entries()) {
      if (rec.status === 'COMPLETED') {
        records.push({
          shotNumber,
          resultUrl: rec.resultUrl,
          completedAt: rec.completedAt
        });
      }
    }
    return records;
  }

  // ===== 가비지 컬렉션: 5분 이상 무응답 세션 제거 =====
  cleanupStaleSessions() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5분

    for (const [token, session] of this.sessions.entries()) {
      // 현재 포토존 권한자이거나 예약자는 삭제하지 않음
      if (token === this.activePhotozoneToken || token === this.nextReservedToken) {
        continue;
      }
      if (now - session.lastActiveAt > staleThreshold) {
        this.clearAllTimers(session);
        if (session.shotCount > 0) {
          sessionLogger.recordSessionEnd(session.sessionId, session.shotCount >= 2 ? 'COMPLETED_DUAL' : 'COMPLETED_SINGLE');
        } else {
          sessionLogger.recordSessionEnd(session.sessionId, 'ABORTED', 'INACTIVITY_GC');
        }
        this.sessions.delete(token);
        console.log(`[세션 GC] 유휴 세션 메모리 정리: ${session.sessionId}`);
      }
    }
  }
}

module.exports = new SessionManager();
