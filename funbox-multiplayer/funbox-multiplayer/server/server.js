const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.get('/', (req, res) => {
  res.send('FunBox multiplayer server is running.');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// 12 distinct car colors, no purple.
const COLORS = [
  '#e6483c', '#3d8bfd', '#ffb703', '#ff7b25',
  '#29c7ac', '#7ee36b', '#ff6b9d', '#c7e63c',
  '#3ce6e0', '#c48a4a', '#9ac43c', '#6b8fba'
];

const rooms = {}; // code -> room state

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms[code]);
  return code;
}

function publicPlayers(room) {
  return Object.values(room.players).map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    num: p.num,
    ready: p.ready,
    isHost: p.id === room.hostId
  }));
}

function broadcastLobby(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit('lobby-update', {
    code,
    maxPlayers: room.maxPlayers,
    players: publicPlayers(room)
  });
}

io.on('connection', (socket) => {
  socket.on('create-room', ({ name, maxPlayers }) => {
    const code = genCode();
    const player = {
      id: socket.id,
      name: (name || 'Player').toString().slice(0, 16),
      color: COLORS[0],
      num: 1,
      ready: false
    };
    rooms[code] = {
      code,
      maxPlayers: Math.min(Math.max(parseInt(maxPlayers) || 12, 2), 12),
      hostId: socket.id,
      players: { [socket.id]: player },
      started: false,
      finishes: {}
    };
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-joined', { code, you: player });
    broadcastLobby(code);
  });

  socket.on('join-room', ({ name, code }) => {
    const roomCode = (code || '').toString().toUpperCase().trim();
    const room = rooms[roomCode];
    if (!room) return socket.emit('join-error', 'Room not found. Check the code and try again.');
    const count = Object.keys(room.players).length;
    if (count >= room.maxPlayers) return socket.emit('join-error', 'That room is full.');
    if (room.started) return socket.emit('join-error', 'That race has already started.');

    const player = {
      id: socket.id,
      name: (name || 'Player').toString().slice(0, 16),
      color: COLORS[count % COLORS.length],
      num: count + 1,
      ready: false
    };
    room.players[socket.id] = player;
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.emit('room-joined', { code: roomCode, you: player });
    broadcastLobby(roomCode);
  });

  socket.on('toggle-ready', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].ready = !room.players[socket.id].ready;
    broadcastLobby(code);
  });

  socket.on('start-race', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.started = true;
    room.finishes = {};
    // Shared future timestamp so every client's countdown lands together.
    const startAt = Date.now() + 3900;
    io.to(code).emit('race-start', { startAt });
  });

  // High-frequency position sync - relayed to everyone else in the room.
  socket.on('car-update', (state) => {
    const code = socket.data.roomCode;
    if (!code) return;
    socket.to(code).emit('car-update', { id: socket.id, ...state });
  });

  socket.on('finished', ({ time }) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.finishes[socket.id] !== undefined) return;
    room.finishes[socket.id] = time;
    io.to(code).emit('player-finished', { id: socket.id, time });
  });

  socket.on('back-to-lobby', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    room.started = false;
    room.finishes = {};
    Object.values(room.players).forEach(p => { p.ready = (p.id === room.hostId); });
    broadcastLobby(code);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    delete room.players[socket.id];
    io.to(code).emit('player-left', { id: socket.id });
    if (Object.keys(room.players).length === 0) {
      delete rooms[code];
      return;
    }
    if (room.hostId === socket.id) {
      room.hostId = Object.keys(room.players)[0];
    }
    broadcastLobby(code);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('FunBox server listening on ' + PORT));
