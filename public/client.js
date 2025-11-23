// client.js — лёгкий клиент для локального FPS-прототипа
// - Подключается по WebSocket к тому же хосту
// - Отправляет input {seq, dx, dy} на сервер 20Hz
// - Выполняет client-side prediction и reconciliation
// - Рендер на 2D canvas

(function () {
  // Настройки
  const INPUT_HZ = 20; // как часто отправляем input
  const INPUT_DT = 1 / INPUT_HZ;
  const SPEED = 120; // пикселей в секунду (должно совпадать с сервером)
  const SERVER_URL = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;

  // DOM
  const connEl = document.getElementById('conn');
  const clientIdEl = document.getElementById('clientId');
  const pendingEl = document.getElementById('pending');
  const serverSeqEl = document.getElementById('serverSeq');
  const fpsEl = document.getElementById('fps');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Состояния
  let socket;
  let clientId = null;

  // Позиция игрока (локально предсказанная)
  const local = { x: 150 + Math.random() * 200, y: 150 + Math.random() * 200 };

  // Pending inputs: массив входов, которые мы отправили, но ещё не "подтверждены" сервером
  // Каждый input = { seq, dx, dy }
  let pendingInputs = [];
  let seq = 0;
  let lastServerAckSeq = 0;

  // Состояние мира от сервера (для других игроков и для авторитетной позиции нашего игрока)
  const playersById = {};

  // Счётчик FPS
  let lastFrameTs = performance.now();
  let fps = 0;
  let frames = 0;
  let fpsAccum = 0;

  // Клавиши
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  // Подключаемся к серверу
  function connect() {
    socket = new WebSocket(SERVER_URL);

    socket.addEventListener('open', () => {
      connEl.textContent = 'connected';
    });

    socket.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }

      if (msg.type === 'welcome') {
        clientId = String(msg.clientId);
        clientIdEl.textContent = clientId;
      } else if (msg.type === 'snapshot') {
        handleSnapshot(msg);
      }
    });

    socket.addEventListener('close', () => {
      connEl.textContent = 'disconnected';
      // пробуем переподключиться через секунду
      setTimeout(connect, 1000);
    });

    socket.addEventListener('error', (e) => {
      console.warn('ws error', e);
      connEl.textContent = 'error';
    });
  }

  // Обработка snapshot от сервера
  function handleSnapshot(snapshot) {
    // Обновляем данные игроков
    snapshot.players.forEach(sp => {
      playersById[sp.id] = { id: sp.id, x: sp.x, y: sp.y, lastSeq: sp.lastSeq };
    });

    // Если есть авторитетная позиция для нас — делаем reconciliation
    if (clientId && playersById[clientId]) {
      const serverPlayer = playersById[clientId];
      const serverSeq = serverPlayer.lastSeq || 0;
      serverSeqEl.textContent = serverSeq;

      // Запомнили последний подтверждённый seq
      lastServerAckSeq = serverSeq;

      // Устанавливаем локальную позицию к серверной, затем повторно применяем pending inputs
      local.x = serverPlayer.x;
      local.y = serverPlayer.y;

      // Фильтруем и повторно применяем оставшиеся входы
      const remaining = [];
      for (const input of pendingInputs) {
        if (input.seq > lastServerAckSeq) {
          applyInputLocally(input);
          remaining.push(input);
        }
      }
      pendingInputs = remaining;
    }
  }

  // Применение входа локально (prediction)
  function applyInputLocally(input) {
    const dx = input.dx || 0;
    const dy = input.dy || 0;
    const len = Math.hypot(dx, dy);
    let ndx = 0, ndy = 0;
    if (len > 0) { ndx = dx / len; ndy = dy / len; }
    local.x += ndx * SPEED * INPUT_DT;
    local.y += ndy * SPEED * INPUT_DT;
  }

  // Текущий вектор по клавишам
  function getInputVector() {
    let dx = 0, dy = 0;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    return { dx, dy };
  }

  // Отправка входов на сервер 20Hz
  function startInputLoop() {
    setInterval(() => {
      const v = getInputVector();
      seq += 1;
      const input = { seq, dx: v.dx, dy: v.dy };

      // Сохраняем в pending и применяем сразу локально (prediction)
      pendingInputs.push(input);
      applyInputLocally(input);

      // Отправляем на сервер
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(Object.assign({ type: 'input' }, input)));
      }

      pendingEl.textContent = pendingInputs.length;
    }, 1000 / INPUT_HZ);
  }

  // Рендер цикл
  function frame(ts) {
    // FPS расчёт
    frames++;
    fpsAccum += (ts - lastFrameTs);
    if (fpsAccum >= 1000) {
      fps = Math.round((frames * 1000) / fpsAccum);
      fpsEl.textContent = fps;
      frames = 0;
      fpsAccum = 0;
    }
    lastFrameTs = ts;

    // Очищаем холст
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем других игроков (серверные координаты)
    Object.values(playersById).forEach(p => {
      if (String(p.id) === String(clientId)) return;
      ctx.beginPath();
      ctx.fillStyle = '#4ab';
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText('p' + p.id, p.x - 10, p.y - 18);
    });

    // Рисуем своего игрока (локально предсказанная позиция)
    ctx.beginPath();
    ctx.fillStyle = '#fb8';
    ctx.arc(local.x, local.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '12px monospace';
    ctx.fillText('you', local.x - 10, local.y - 18);

    requestAnimationFrame(frame);
  }

  // Запускаем
  connect();
  startInputLoop();
  requestAnimationFrame(frame);

  // UI-обновление
  setInterval(() => {
    connEl.textContent = (socket && socket.readyState === WebSocket.OPEN) ? 'connected' : 'disconnected';
    clientIdEl.textContent = clientId || '-';
    pendingEl.textContent = pendingInputs.length;
  }, 200);
})();