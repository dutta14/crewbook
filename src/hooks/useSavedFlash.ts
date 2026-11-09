import { useCallback, useEffect, useRef, useState } from 'react';

const SAVED_VISIBLE_MS = 1500;

/** A flag that turns on when `flash()` is called and off again 1.5 seconds later. */
export function useSavedFlash(): { isSaved: boolean; flash: () => void } {
  const [isSaved, setIsSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback(() => {
    setIsSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsSaved(false), SAVED_VISIBLE_MS);
  }, []);

  return { isSaved, flash };
}
