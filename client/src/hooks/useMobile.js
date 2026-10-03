import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { socket } from '../socket.js';

// ---------- card size (S / M / L), remembered on this device ----------
const DENSITY_KEY = 'wbt-density';
const listeners = new Set();
let density = 'm';
try {
  const saved = window.localStorage.getItem(DENSITY_KEY);
  if (saved === 's' || saved === 'm' || saved === 'l') density = saved;
} catch {
  /* storage unavailable */
}

export function setDensity(next) {
  density = next;
  try { window.localStorage.setItem(DENSITY_KEY, next); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export const useDensity = () =>
  useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => density
  );

// ---------- haptics (Android; ignored elsewhere) ----------
export const haptic = (pattern = 10) => {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
};

// ---------- "your move" alert: buzz + flash the tab title when you're needed ----------
const BASE_TITLE = 'WHO BE THIS?';

export function useTurnAlert(state) {
  const needsMe =
    !!state &&
    ((state.activePlayer === state.you && (state.phase === 'ASKING' || state.phase === 'ELIMINATING')) ||
      (state.activePlayer !== state.you && state.phase === 'WAITING_FOR_ANSWER'));
  const prev = useRef(false);

  useEffect(() => {
    if (needsMe && !prev.current) haptic([40, 60, 40]);
    prev.current = needsMe;
  }, [needsMe]);

  useEffect(() => {
    const update = () => {
      document.title = needsMe && document.hidden ? `🔔 Your move · ${BASE_TITLE}` : BASE_TITLE;
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [needsMe]);
}

// ---------- keep the screen on during a game (needs HTTPS; silently skipped otherwise) ----------
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;

    const request = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) l.release();
        else lock = l;
      } catch {
        /* not allowed (http, battery saver...): ignore */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

// ---------- wake-up check: after the phone sleeps, a socket can look connected but be dead ----------
export function useReconnectOnResume() {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      socket.timeout(2500).emit('app:ping', {}, (err) => {
        if (err) {
          socket.disconnect(); // no answer: the connection is a zombie, start fresh
          socket.connect();
        }
      });
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    window.addEventListener('pageshow', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      window.removeEventListener('pageshow', check);
    };
  }, []);
}

// ---------- round-trip time to the game server, in ms (null = unknown/offline) ----------
export function useLatency(active) {
  const [ms, setMs] = useState(null);

  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;

    const ping = () => {
      if (!socket.connected) {
        setMs(null);
        return;
      }
      const t0 = performance.now();
      socket.timeout(4000).emit('app:ping', {}, (err) => {
        if (!stopped) setMs(err ? null : Math.round(performance.now() - t0));
      });
    };

    ping();
    const id = setInterval(ping, 5000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active]);

  return ms;
}