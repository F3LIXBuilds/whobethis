export const initials = (name) =>
  name
    .replace(/[^A-Za-z\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export function hueFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export const celebName = (celebs, id) => celebs.find((c) => c.id === id)?.name ?? '—';

export const formatDuration = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};