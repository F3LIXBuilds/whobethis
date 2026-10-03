import { CELEBRITIES } from '../data/celebrities.js';
import config from '../config.js';

// Tiny seeded random generator: the same date always gives the same board
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "2026-10-02" in Lagos time
export const todayKey = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: config.boardTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export function buildBoard(dateKey, size = config.boardSize) {
  const rng = mulberry32(hashString(`who-be-this:${dateKey}`));
  const total = CELEBRITIES.length;
  const n = Math.min(size, total);

  const groups = new Map();
  for (const c of CELEBRITIES) {
    if (!groups.has(c.category)) groups.set(c.category, []);
    groups.get(c.category).push(c);
  }
  const cats = [...groups.keys()].sort(); // sorted so file order never matters

  // How many from each category: proportional, biggest remainders get the leftovers
  const quotas = cats.map((cat) => {
    const exact = (n * groups.get(cat).length) / total;
    return { cat, quota: Math.floor(exact), rem: exact - Math.floor(exact) };
  });
  let left = n - quotas.reduce((sum, q) => sum + q.quota, 0);
  [...quotas]
    .sort((a, b) => b.rem - a.rem || a.cat.localeCompare(b.cat))
    .forEach((q) => {
      if (left > 0) { q.quota += 1; left -= 1; }
    });

  // Spread every category evenly across the whole board (with a little jitter)
  const placed = [];
  for (const { cat, quota } of quotas) {
    const chosen = shuffle(groups.get(cat), rng).slice(0, quota);
    chosen.forEach((c, k) => placed.push({ id: c.id, key: (k + rng()) / chosen.length }));
  }
  return placed.sort((a, b) => a.key - b.key).map((p) => p.id);
}

let cache = { key: null, ids: [] };

export function getDailyBoard() {
  const key = todayKey();
  if (cache.key !== key) cache = { key, ids: buildBoard(key) };
  return { date: key, ids: [...cache.ids] };
}