import { useCallback, useEffect, useRef, useState } from 'react';

export const AUTOSAVE_DELAY_MS = 5000;
const SAVED_VISIBLE_MS = 2000;

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutoSave {
  status: AutoSaveStatus;
  /** True while the latest value has not been saved successfully. */
  isDirty: boolean;
}

/**
 * Saves `value` once it has stopped changing for `delayMs`. The value present when the hook first
 * runs counts as already saved. A failed save is retried on the next change. Pending work is
 * cancelled on unmount, so a caller that finishes the session itself is never overwritten.
 */
export function useAutoSave(
  value: string,
  onSave: (value: string) => void | Promise<void>,
  delayMs: number = AUTOSAVE_DELAY_MS,
): AutoSave {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const lastSaved = useRef(value);
  // Mirrors the ref so `isDirty` can be computed during render.
  const [savedValue, setSavedValue] = useState(value);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const latestOnSave = useRef(onSave);
  useEffect(() => {
    latestOnSave.current = onSave;
  });

  const clearTimers = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    saveTimer.current = null;
    hideTimer.current = null;
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (value === lastSaved.current) return undefined;
    clearTimers();
    // "Saved" must not stay on screen next to text that has changed since.
    setStatus((current) => (current === 'saved' ? 'idle' : current));
    saveTimer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await latestOnSave.current(value);
      } catch {
        if (isMounted.current) setStatus('error');
        return;
      }
      if (!isMounted.current) return;
      lastSaved.current = value;
      setSavedValue(value);
      setStatus('saved');
      hideTimer.current = setTimeout(() => setStatus('idle'), SAVED_VISIBLE_MS);
    }, delayMs);
    return clearTimers;
  }, [value, delayMs, clearTimers]);

  return { status, isDirty: value !== savedValue };
}
