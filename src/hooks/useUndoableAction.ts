import { useCallback, useEffect, useRef, useState } from 'react';

export const UNDO_WINDOW_MS = 5000;

export interface UndoableAction {
  /** Runs the action now, then opens the undo window. */
  execute: () => void;
  undoAvailable: boolean;
  /** Runs `undo` and closes the window. Does nothing once the window has closed. */
  triggerUndo: () => void;
}

/**
 * The action takes effect immediately; `undo` is just a second action. If `action` returns a
 * promise that rejects, the undo window closes and the caller is expected to report the failure
 * itself. Leaving the component commits the action, because the timer is only cleaned up.
 */
export function useUndoableAction<T>(
  action: () => T,
  undo: () => void,
  timeoutMs: number = UNDO_WINDOW_MS,
): UndoableAction {
  const [undoAvailable, setUndoAvailable] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ action, undo });
  useEffect(() => {
    latest.current = { action, undo };
  });

  const closeWindow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setUndoAvailable(false);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const execute = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const result = latest.current.action();
    if (result instanceof Promise) result.catch(closeWindow);
    setUndoAvailable(true);
    timer.current = setTimeout(closeWindow, timeoutMs);
  }, [closeWindow, timeoutMs]);

  const triggerUndo = useCallback(() => {
    if (!timer.current) return;
    closeWindow();
    latest.current.undo();
  }, [closeWindow]);

  return { execute, undoAvailable, triggerUndo };
}
