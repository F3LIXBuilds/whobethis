import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import config from './config.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');
const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Used when a username doesn't exist, so "unknown user" takes as long as "wrong password"
const DUMMY_HASH = await hashPassword('not-a-real-password');

let db = { players: {} };
try {
  db = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
  db.players ??= {};
} catch {
  /* first run: start empty */
}

let saveTimer = null;
const scheduleSave = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
};

export function flush() {
  clearTimeout(saveTimer);
  try {
    // Test accounts (bots) are never written to disk
    const persistent = Object.fromEntries(Object.entries(db.players).filter(([, p]) => !p.test));
    fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
    const tmp = `${config.dataFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ players: persistent }));
    fs.renameSync(tmp, config.dataFile);
  } catch (err) {
    console.error('Could not save data:', err.message);
  }
}

const confirmedWins = (p) => p.wins; // every win is server-recorded, including wins when the opponent quits

const summary = (p) => ({
  username: p.username,
  games: p.wins + p.losses,
  confirmedWins: confirmedWins(p),
  snipeHits: p.snipeHits,
  hasPassword: !!p.passwordHash,
});

export function findByUsername(name) {
  const lower = name.toLowerCase();
  return Object.values(db.players).find((p) => p.usernameLower === lower);
}

export function register(username, { test = false } = {}) {
  if (findByUsername(username)) return null;
  const id = randomUUID();
  const key = randomBytes(24).toString('hex'); // shown to the client once, only the hash is stored
  db.players[id] = {
    id,
    username,
    usernameLower: username.toLowerCase(),
    keyHash: hash(key),
    createdAt: Date.now(),
    test,
    wins: 0,
    losses: 0,
    forfeitWins: 0, // wins because the opponent quit/disconnected (not "confirmed")
    snipeHits: 0,
    snipeMisses: 0,
    lastPlayedAt: null,
  };
  if (!test) scheduleSave();
  return { id, key, profile: summary(db.players[id]) };
}

// Device key login (the "stay logged in" path)
export function login(id, key) {
  const p = db.players[id];
  if (!p || typeof key !== 'string') return null;
  const h = hash(key);
  const ok = p.keyHash === h || (p.sessions ?? []).some((s) => s.hash === h);
  if (!ok) return null;
  return { id, username: p.username, profile: summary(p) };
}

// ---------- accounts with passwords ----------
const MAX_SESSIONS = 10; // devices that can stay logged in at once

function addSession(p) {
  const key = randomBytes(24).toString('hex');
  p.sessions ??= [];
  p.sessions.push({ hash: hash(key), createdAt: Date.now() });
  if (p.sessions.length > MAX_SESSIONS) p.sessions = p.sessions.slice(-MAX_SESSIONS);
  return key;
}

export async function createAccount(username, password, { test = false } = {}) {
  if (findByUsername(username)) return null;
  const passwordHash = await hashPassword(password);
  if (findByUsername(username)) return null; // someone took it while we were hashing
  const id = randomUUID();
  db.players[id] = {
    id,
    username,
    usernameLower: username.toLowerCase(),
    passwordHash,
    sessions: [],
    createdAt: Date.now(),
    test,
    wins: 0,
    losses: 0,
    forfeitWins: 0,
    snipeHits: 0,
    snipeMisses: 0,
    lastPlayedAt: null,
  };
  const key = addSession(db.players[id]);
  if (!test) scheduleSave();
  return { id, key, profile: summary(db.players[id]) };
}

export async function passwordLogin(username, password) {
  const p = findByUsername(String(username ?? '').trim());
  const pw = typeof password === 'string' && password.length <= config.password.max ? password : '';
  const ok = await verifyPassword(pw, p?.passwordHash ?? DUMMY_HASH);
  if (!p || !p.passwordHash || !ok) return null;
  const key = addSession(p);
  if (!p.test) scheduleSave();
  return { id: p.id, username: p.username, key, profile: summary(p) };
}

export async function setPassword(id, password) {
  const p = db.players[id];
  if (!p) return { error: 'Account not found' };
  if (p.passwordHash) return { error: 'This account already has a password' };
  p.passwordHash = await hashPassword(password);
  if (!p.test) scheduleSave();
  return { ok: true };
}

// Log out ONE device (the key must match, so nobody can revoke other people's sessions)
export function revokeSession(id, key) {
  const p = db.players[id];
  if (!p || typeof key !== 'string') return;
  const h = hash(key);
  p.sessions = (p.sessions ?? []).filter((s) => s.hash !== h);
  if (p.keyHash === h) p.keyHash = null;
  if (!p.test) scheduleSave();
}

export const getProfile = (id) => (db.players[id] ? summary(db.players[id]) : null);

export function recordGame(winnerId, loserId, reason) {
  const w = db.players[winnerId];
  const l = db.players[loserId];
  if (!w || !l) return;
  w.wins += 1;
  l.losses += 1;
  if (reason === 'snipe_hit') w.snipeHits += 1; // the winner was the sniper
  if (reason === 'snipe_miss') l.snipeMisses += 1; // the loser was the sniper
  w.lastPlayedAt = l.lastPlayedAt = Date.now();
  if (!w.test && !l.test) scheduleSave();
}

export function leaderboard(limit = config.leaderboardSize) {
  return Object.values(db.players)
    .filter((p) => !p.test && p.wins + p.losses > 0)
    .sort(
      (a, b) =>
        confirmedWins(b) - confirmedWins(a) ||
        b.snipeHits - a.snipeHits ||
        a.wins + a.losses - (b.wins + b.losses) ||
        a.createdAt - b.createdAt
    )
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1,
      username: p.username,
      games: p.wins + p.losses,
      confirmedWins: confirmedWins(p),
      confirmedSnipes: p.snipeHits,
    }));
}

// ---------- friends ----------
const list = (p, key) => (p[key] ??= []);
const without = (arr, id) => arr.filter((x) => x !== id);
const toEntries = (ids) =>
  ids.map((id) => db.players[id]).filter(Boolean).map((p) => ({ id: p.id, username: p.username }));
const persist = (...ps) => { if (ps.some((p) => !p.test)) scheduleSave(); };

function makeFriends(a, b) {
  a.incoming = without(list(a, 'incoming'), b.id);
  a.outgoing = without(list(a, 'outgoing'), b.id);
  b.incoming = without(list(b, 'incoming'), a.id);
  b.outgoing = without(list(b, 'outgoing'), a.id);
  if (!list(a, 'friends').includes(b.id)) a.friends.push(b.id);
  if (!list(b, 'friends').includes(a.id)) b.friends.push(a.id);
  persist(a, b);
}

export function requestFriend(fromId, toUsername) {
  const me = db.players[fromId];
  const other = findByUsername(String(toUsername ?? '').trim());
  if (!me) return { error: 'Account not found' };
  if (!other) return { error: 'No player with that username' };
  if (other.id === me.id) return { error: "You can't add yourself" };
  if (list(me, 'friends').includes(other.id)) return { error: 'You are already friends' };
  if (list(me, 'incoming').includes(other.id)) {
    makeFriends(me, other); // they already asked you: that's an accept
    return { status: 'accepted', otherId: other.id };
  }
  if (list(me, 'outgoing').includes(other.id)) return { error: 'Request already sent' };
  if (me.friends.length >= config.maxFriends) return { error: 'Your friends list is full' };
  if (me.outgoing.length >= config.maxPendingRequests) return { error: 'Too many pending requests' };
  me.outgoing.push(other.id);
  list(other, 'incoming').push(me.id);
  persist(me, other);
  return { status: 'sent', otherId: other.id };
}

export function respondFriend(myId, username, accept) {
  const me = db.players[myId];
  const other = findByUsername(String(username ?? '').trim());
  if (!me || !other || !list(me, 'incoming').includes(other.id)) {
    return { error: 'No request from that player' };
  }
  if (accept) {
    makeFriends(me, other);
    return { status: 'accepted', otherId: other.id };
  }
  me.incoming = without(me.incoming, other.id);
  other.outgoing = without(list(other, 'outgoing'), me.id);
  persist(me, other);
  return { status: 'declined', otherId: other.id };
}

export function removeFriend(myId, username) {
  const me = db.players[myId];
  const other = findByUsername(String(username ?? '').trim());
  if (!me || !other) return { error: 'Player not found' };
  me.friends = without(list(me, 'friends'), other.id);
  other.friends = without(list(other, 'friends'), me.id);
  persist(me, other);
  return { status: 'removed', otherId: other.id };
}

export function friendsOf(id) {
  const p = db.players[id];
  if (!p) return { friends: [], incoming: [], outgoing: [] };
  return {
    friends: toEntries(list(p, 'friends')),
    incoming: toEntries(list(p, 'incoming')),
    outgoing: toEntries(list(p, 'outgoing')),
  };
}