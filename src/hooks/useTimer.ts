import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 1000;

/** "0:00", "1:23", "12:05". Minutes keep counting past an hour. */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface Timer {
  elapsed: string;
  /** Starts counting from 0:00. Calling it again restarts the count. */
  startTimer: () => void;
  /** Freezes the display at the time reached. */
  stopTimer: () => void;
}

/** Elapsed time comes from the clock, not from counting ticks, so a throttled tab never drifts. */
export function useTimer(): Timer {
  const [seconds, setSeconds] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const startedAt = Date.now();
    setSeconds(0);
    interval.current = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / TICK_MS)),
      TICK_MS,
    );
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  return { elapsed: formatElapsed(seconds), startTimer, stopTimer };
}
