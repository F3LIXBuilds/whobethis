import { useEffect, useState } from 'react';

// Counts down to a SERVER timestamp, so both players stay in sync regardless of their clocks.
export function useCountdown(deadline, serverTime) {
  const [secs, setSecs] = useState(() =>
    deadline ? Math.max(0, Math.ceil((deadline - serverTime) / 1000)) : 0
  );

  useEffect(() => {
    if (!deadline) { setSecs(0); return undefined; }
    const receivedAt = Date.now();
    const calc = () =>
      Math.max(0, Math.ceil((deadline - serverTime - (Date.now() - receivedAt)) / 1000));
    setSecs(calc());
    const t = setInterval(() => setSecs(calc()), 250);
    return () => clearInterval(t);
  }, [deadline, serverTime]);

  return secs;
}