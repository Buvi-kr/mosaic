const { Server } = require('socket.io');

let io;

let cachedTunnelUrl = null;

function init(server) {
  io = new Server(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('🖥️ 디스플레이 클라이언트 접속:', socket.id);
    if (cachedTunnelUrl) {
      socket.emit('tunnel_url', cachedTunnelUrl);
    }
    
    // 업로드 세션 room 참가 (업로드 페이지에서 진행 상황을 받기 위함)
    socket.on('join_session', (sessionId) => {
      socket.join(sessionId);
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
