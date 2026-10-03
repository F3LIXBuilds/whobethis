const buckets = new Map(); // key -> { count, reset }

const live = (key) => {
  const b = buckets.get(key);
  if (b && Date.now() > b.reset) {
    buckets.delete(key);
    return undefined;
  }
  return b;
};

// "At most `max` per window". Returns false once exceeded (used for sign-ups).
export function allow(key, max, windowMs) {
  const b = live(key);
  if (!b) {
    buckets.set(key, { count: 1, reset: Date.now() + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

// Failure tracking (used for logins)
export const isBlocked = (key, max) => (live(key)?.count ?? 0) >= max;

export function recordFailure(key, windowMs) {
  const b = live(key);
  if (!b) buckets.set(key, { count: 1, reset: Date.now() + windowMs });
  else b.count += 1;
}

export const clearFailures = (key) => buckets.delete(key);

setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (now > b.reset) buckets.delete(key);
}, 60_000).unref();
