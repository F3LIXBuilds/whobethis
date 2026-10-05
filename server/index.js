import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import config from './config.js';
import { CELEBRITIES } from './data/celebrities.js';
import { registerHandlers } from './sockets/handlers.js';
import { sweepFinished } from './game/rooms.js';
import * as store from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Public data: same board for everyone, contains no secrets
app.get('/api/celebrities', (_req, res) => res.json(CELEBRITIES));
app.get('/api/leaderboard', (_req, res) => res.json(store.leaderboard()));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Serve React frontend
const clientPath = path.join(__dirname, '../client/dist');

console.log('Client path:', clientPath);
console.log('Client exists:', fs.existsSync(clientPath));
console.log(
  'Index exists:',
  fs.existsSync(path.join(clientPath, 'index.html'))
);

app.use(express.static(clientPath));

// React SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  pingInterval: 10_000,
  pingTimeout: 8_000,
});
registerHandlers(io);

setInterval(sweepFinished, 60_000);

const shutdown = () => {
  store.flush();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(config.port, () => {
  console.log(`WHO BE THIS? server running on http://localhost:${config.port}`);
});