import { useEffect, useState } from 'react';

/** The current time in milliseconds, refreshed on an interval. A minute is enough for a countdown. */
export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
