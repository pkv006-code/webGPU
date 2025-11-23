// server.js — простой HTTP + WebSocket сервер
// - Раздаёт статические файлы из ./public
// - Назначает уникальный clientId при подключении
// - Получает input {seq, dx, dy} от клиентов и применяет в простом authoritative state
// - Рассылает snapshot с состоянием игроков 10 раз в секунду

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Статические файлы из папки public
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Простое хранение состояния игроков: id -> { id, x, y, lastSeq }
const players = new Map();
let nextClientId = 1;

// Настройки "физики"
const INPUT_TICK_DT = 1 / 20; // секунды — предполагаем, что входы приходят 20Hz
const SPEED = 120; // пикселей в секунду

// Помощник: безопасная отправка JSON
function wsSend(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

// При подключении нового клиента
wss.on('connection', (ws, req) => {
  const clientId = String(nextClientId++);
  console.log(`Client connected: ${clientId} from ${req.socket.remoteAddress}`);

  // Инициализируем игрока в случайном месте
  const startX = 100 + Math.floor(Math.random() * 400);
  const startY = 100 + Math.floor(Math.random() * 300);
  players.set(clientId, { id: clientId, x: startX, y: startY, lastSeq: 0 });

  // Отправляем приветственное сообщение с назначенным id
  wsSend(ws, { type: 'welcome', clientId });

  // Приём сообщений от клиента
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.warn('Invalid JSON from client', e);
      return;
    }

    // Типы сообщений: input
    if (msg.type === 'input') {
      // Сообщение ожидается как { type: 'input', seq: N, dx: number, dy: number }
      const p = players.get(clientId);
      if (!p) return;

      const seq = Number(msg.seq) || 0;
      const dx = Number(msg.dx) || 0;
      const dy = Number(msg.dy) || 0;

      // Нормализуем вектор движения
      let len = Math.hypot(dx, dy);
      let ndx = 0, ndy = 0;
      if (len > 0) {
        ndx = dx / len;
        ndy = dy / len;
      }
      // Применяем движение как фиксированный тик
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

// Бродкаст snapshot 10 раз в секунду
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