const { Server } = require('socket.io');

let io;
let cachedTunnelUrl = null;
let mosaicQueue = null;
let sessionManager = null;

function init(server) {
  io = new Server(server, {
    cors: { origin: '*' }
  });

  mosaicQueue = require('./mosaic.queue');
  sessionManager = require('./session.manager');
  sessionManager.setIo(io);

  io.on('connection', (socket) => {
    // 터널 URL 전송
    if (cachedTunnelUrl) {
      socket.emit('tunnel_url', cachedTunnelUrl);
    }

    // 게이트 상태 초기 전송
    socket.emit('gate_state', sessionManager.getGateState());

    // 디스플레이 새로고침 복구 요청
    socket.on('request_gate_state', () => {
      socket.emit('gate_state', sessionManager.getGateState());
    });

    // 업로드 세션 room 참가
    socket.on('join_session', (sessionId) => {
      if (sessionId) {
        socket.join(sessionId);
      }
    });

    // 슬롯 claim 요청 (모바일 소켓 직통)
    socket.on('claim_slot', (data, callback) => {
      const gateToken = typeof data === 'string' ? data : data?.gateToken;
      const result = sessionManager.claimSlot(gateToken, socket.id);
      if (result.success && result.sessionId) {
        socket.join(result.sessionId);
      }
      if (typeof callback === 'function') {
        callback(result);
      } else {
        socket.emit('slot_claimed', result);
      }
    });

    // 촬영 시작 신호 (진입 30초 타이머 정지)
    socket.on('start_capture', (data, callback) => {
      const sessionToken = data?.sessionToken || data;
      const result = sessionManager.startCapture(sessionToken);
      if (typeof callback === 'function') callback(result);
    });

    // 1회차 완료 후 결정: [네, 한 번 더] vs [아니요, 완료할게요]
    socket.on('decision_choice', (data, callback) => {
      const sessionToken = data?.sessionToken;
      const choice = data?.choice; // 'retry' | 'finish'

      let result;
      if (choice === 'retry') {
        result = sessionManager.startSecondShot(sessionToken);
      } else {
        result = sessionManager.finishExperience(sessionToken);
      }
      if (typeof callback === 'function') callback(result);
    });

    // 체험 종료 신호 (포토존 반환)
    socket.on('finish_experience', (data, callback) => {
      const sessionToken = data?.sessionToken || data;
      const result = sessionManager.finishExperience(sessionToken);
      if (typeof callback === 'function') callback(result);
    });

    // 재연결 및 세션 복구 요청
    socket.on('reconnect_session', (data, callback) => {
      const sessionToken = data?.sessionToken || data;
      const result = sessionManager.handleReconnect(socket.id, sessionToken);
      const session = sessionManager.getSession(sessionToken);
      if (session && session.sessionId) {
        socket.join(session.sessionId);
      }
      if (typeof callback === 'function') callback(result);
    });

    // 슬롯 확인 요청 (하위 호환)
    socket.on('check_slot', () => {
      if (mosaicQueue) {
        const slotInfo = mosaicQueue.canAcceptUpload();
        socket.emit('slot_status', slotInfo);
      }
    });

    // 디스플레이 접속 시 현재 상태 즉시 전송
    socket.on('request_display_state', () => {
      if (mosaicQueue) {
        const state = mosaicQueue.getSystemState();
        const stats = mosaicQueue.getStats();
        socket.emit('display_state', {
          state,
          queueLength: stats.queueLength,
          activeWorkers: stats.activeWorkers,
          maxWorkers: stats.maxWorkers,
        });
      }
    });

    // 소켓 단절 처리 (20초 유예)
    socket.on('disconnect', () => {
      sessionManager.handleDisconnect(socket.id);
    });
  });
}

function setTunnelUrl(url) {
  cachedTunnelUrl = url;
  if (io) io.emit('tunnel_url', url);
}

function getIo() {
  if (!io) {
    throw new Error('Socket.io가 초기화되지 않았습니다!');
  }
  return io;
}

module.exports = {
  init,
  getIo,
  setTunnelUrl
};
