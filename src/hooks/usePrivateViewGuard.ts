import { useEffect, useRef } from 'react';

/** How long a private view may sit untouched before it closes itself. */
export const PRIVATE_VIEW_IDLE_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

/**
 * While `isActive`, calls `onClose` when the tab is hidden or when nothing has been touched for
 * `idleMs`. Used to take sensitive content off the screen after an Alt+Tab or a walk away.
 * Pass `null` to switch the idle timer off; hiding the tab still closes the view.
 */
export function usePrivateViewGuard(
  isActive: boolean,
  onClose: () => void,
  idleMs: number | null = PRIVATE_VIEW_IDLE_MS,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isActive) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const close = () => onCloseRef.current();
    const restart = () => {
      if (idleMs === null) return;
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
