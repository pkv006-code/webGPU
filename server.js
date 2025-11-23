const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Статические файлы из папки public
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Простое хранение состояния игроков
const players = new Map();
let nextClientId = 1;

// Настройки "физики"
const INPUT_TICK_DT = 1 / 20; // секунды
const SPEED = 120; // пикселей в секунду

function wsSend(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

wss.on('connection', (ws, req) => {
  const clientId = String(nextClientId++);
  console.log(`Client connected: ${clientId} from ${req.socket.remoteAddress}`);

  const startX = 100 + Math.floor(Math.random() * 400);
  const startY = 100 + Math.floor(Math.random() * 300);
  players.set(clientId, { id: clientId, x: startX, y: startY, lastSeq: 0 });

  wsSend(ws, { type: 'welcome', clientId });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.warn('Invalid JSON from client', e);
      return;
    }

    if (msg.type === 'input') {
      const p = players.get(clientId);
      if (!p) return;

      const seq = Number(msg.seq) || 0;
      const dx = Number(msg.dx) || 0;
      const dy = Number(msg.dy) || 0;

      let len = Math.hypot(dx, dy);
      let ndx = 0, ndy = 0;
      if (len > 0) {
        ndx = dx / len;
        ndy = dy / len;
      }
      p.x += ndx * SPEED * INPUT_TICK_DT;
      p.y += ndy * SPEED * INPUT_TICK_DT;
      p.lastSeq = seq;
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    players.delete(clientId);
  });

  ws.on('error', (err) => {
    console.warn(`WS error for ${clientId}`, err);
    players.delete(clientId);
  });
});

const SNAPSHOT_RATE_HZ = 10;
setInterval(() => {
  const payload = {
    type: 'snapshot',
    timestamp: Date.now(),
    players: Array.from(players.values()).map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      lastSeq: p.lastSeq
    }))
  };

  const raw = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  });
}, 1000 / SNAPSHOT_RATE_HZ);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});