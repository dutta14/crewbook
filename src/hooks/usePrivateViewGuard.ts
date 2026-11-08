import { useEffect, useRef } from 'react';

/** How long a private view may sit untouched before it closes itself. */
export const PRIVATE_VIEW_IDLE_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

/**
 * While `isActive`, calls `onClose` when the tab is hidden or when nothing has been touched for
 * `idleMs`. Used to take sensitive content off the screen after an Alt+Tab or a walk away.
 */
export function usePrivateViewGuard(
  isActive: boolean,
  onClose: () => void,
  idleMs: number = PRIVATE_VIEW_IDLE_MS,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isActive) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const close = () => onCloseRef.current();
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(close, idleMs);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') close();
    };

    restart();
    document.addEventListener('visibilitychange', handleVisibility);
    ACTIVITY_EVENTS.forEach((name) => document.addEventListener(name, restart, { passive: true }));
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      ACTIVITY_EVENTS.forEach((name) => document.removeEventListener(name, restart));
    };
  }, [isActive, idleMs]);
}
