const { Server } = require('socket.io');

let io;

let cachedTunnelUrl = null;

// 슬롯 대기열 참조 (mosaicQueue를 지연 로딩)
let mosaicQueue = null;

function init(server) {
  io = new Server(server, {
    cors: { origin: '*' }
  });

  // mosaicQueue 지연 로딩 (순환 참조 방지)
  mosaicQueue = require('./mosaic.queue');

  io.on('connection', (socket) => {
    console.log('🖥️ 클라이언트 접속:', socket.id);
    if (cachedTunnelUrl) {
      socket.emit('tunnel_url', cachedTunnelUrl);
    }
    
    // 업로드 세션 room 참가 (업로드 페이지에서 진행 상황을 받기 위함)
    socket.on('join_session', (sessionId) => {
      socket.join(sessionId);
    });

    // 슬롯 확인 요청 (업로드 페이지에서 "나 올려도 돼?" 물어볼 때)
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
