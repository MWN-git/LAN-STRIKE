const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, players: wss.clients.size }));

const players = new Map();
let nextId = 1;

function broadcast(data, except = null) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === 1) client.send(message);
  }
}

wss.on('connection', (socket) => {
  const id = String(nextId++);
  const player = {
    id,
    name: `Player-${id}`,
    x: 0,
    y: 1.6,
    z: 0,
    ry: 0,
    rx: 0,
    hp: 100
  };
  players.set(id, player);

  socket.send(JSON.stringify({ type: 'welcome', id, players: [...players.values()] }));
  broadcast({ type: 'join', player }, socket);

  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const current = players.get(id);
      if (!current) return;

      if (msg.type === 'state') {
        for (const key of ['x', 'y', 'z', 'ry', 'rx']) {
          if (typeof msg[key] === 'number' && Number.isFinite(msg[key])) current[key] = msg[key];
        }
        broadcast({ type: 'state', player: current }, socket);
      } else if (msg.type === 'name') {
        const name = String(msg.name || '').trim().slice(0, 18);
        if (name) current.name = name;
        broadcast({ type: 'state', player: current });
      } else if (msg.type === 'shoot') {
        broadcast({ type: 'shoot', id, x: current.x, y: current.y, z: current.z, ry: current.ry });
      }
    } catch (_) {
      // Ignore malformed client messages.
    }
  });

  socket.on('close', () => {
    players.delete(id);
    broadcast({ type: 'leave', id });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LAN-STRIKE running on http://0.0.0.0:${PORT}`);
});
