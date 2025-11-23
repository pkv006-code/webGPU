(function () {
  const INPUT_HZ = 20;
  const INPUT_DT = 1 / INPUT_HZ;
  const SPEED = 120;
  const SERVER_URL = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host;

  const connEl = document.getElementById('conn');
  const clientIdEl = document.getElementById('clientId');
  const pendingEl = document.getElementById('pending');
  const serverSeqEl = document.getElementById('serverSeq');
  const fpsEl = document.getElementById('fps');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let socket;
  let clientId = null;

  const local = { x: 150 + Math.random() * 200, y: 150 + Math.random() * 200 };
  let pendingInputs = [];
  let seq = 0;
  let lastServerAckSeq = 0;
  const playersById = {};

  let lastFrameTs = performance.now();
  let fps = 0;
  let frames = 0;
  let fpsAccum = 0;

  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

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
      setTimeout(connect, 1000);
    });

    socket.addEventListener('error', (e) => {
      console.warn('ws error', e);
      connEl.textContent = 'error';
    });
  }

  function handleSnapshot(snapshot) {
    snapshot.players.forEach(sp => {
      playersById[sp.id] = { id: sp.id, x: sp.x, y: sp.y, lastSeq: sp.lastSeq };
    });

    if (clientId && playersById[clientId]) {
      const serverPlayer = playersById[clientId];
      const serverSeq = serverPlayer.lastSeq || 0;
      serverSeqEl.textContent = serverSeq;
      lastServerAckSeq = serverSeq;
      local.x = serverPlayer.x;
      local.y = serverPlayer.y;

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

  function applyInputLocally(input) {
    const dx = input.dx || 0;
    const dy = input.dy || 0;
    const len = Math.hypot(dx, dy);
    let ndx = 0, ndy = 0;
    if (len > 0) { ndx = dx / len; ndy = dy / len; }
    local.x += ndx * SPEED * INPUT_DT;
    local.y += ndy * SPEED * INPUT_DT;
  }

  function getInputVector() {
    let dx = 0, dy = 0;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    return { dx, dy };
  }

  function startInputLoop() {
    setInterval(() => {
      const v = getInputVector();
      seq += 1;
      const input = { seq, dx: v.dx, dy: v.dy };
      pendingInputs.push(input);
      applyInputLocally(input);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(Object.assign({ type: 'input' }, input)));
      }
      pendingEl.textContent = pendingInputs.length;
    }, 1000 / INPUT_HZ);
  }

  function frame(ts) {
    frames++;
    fpsAccum += (ts - lastFrameTs);
    if (fpsAccum >= 1000) {
      fps = Math.round((frames * 1000) / fpsAccum);
      fpsEl.textContent = fps;
      frames = 0;
      fpsAccum = 0;
    }
    lastFrameTs = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    ctx.beginPath();
    ctx.fillStyle = '#fb8';
    ctx.arc(local.x, local.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '12px monospace';
    ctx.fillText('you', local.x - 10, local.y - 18);

    requestAnimationFrame(frame);
  }

  connect();
  startInputLoop();
  requestAnimationFrame(frame);

  setInterval(() => {
    connEl.textContent = (socket && socket.readyState === WebSocket.OPEN) ? 'connected' : 'disconnected';
    clientIdEl.textContent = clientId || '-';
    pendingEl.textContent = pendingInputs.length;
  }, 200);
})();