import { useCallback, useEffect, useRef, useState } from 'react';

// Flips a card on screen instantly, then lets the server confirm.
// The server stays the source of truth: if it rejects a flip, the board snaps back.
export function useOptimisticBoard(serverList, emit) {
  const [local, setLocal] = useState(() => new Set(serverList));
  const pending = useRef(0);
  const latest = useRef(serverList);
  latest.current = serverList;

  // Take the server's version whenever none of our own flips are still in flight
  useEffect(() => {
    if (pending.current === 0) setLocal(new Set(serverList));
  }, [serverList]);

  const toggle = useCallback(
    async (id) => {
      setLocal((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      pending.current += 1;
      const res = await emit('board:toggle', { id });
      pending.current -= 1;
      if (!res.ok) setLocal(new Set(latest.current)); // rejected: snap back to the server's board
    },
    [emit]
  );

  return [local, toggle];
}
