import { useEffect, useRef } from 'react';

interface ParsedCombo {
  key: string;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  ctrl: boolean;
  /** Command on a Mac, Control elsewhere. */
  mod: boolean;
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const has = (name: string) => parts.slice(0, -1).includes(name);
  return {
    key,
    shift: has('shift'),
    alt: has('alt'),
    meta: has('meta'),
    ctrl: has('ctrl'),
    mod: has('mod'),
  };
}

function matches(event: KeyboardEvent, combo: ParsedCombo): boolean {
  if (event.key.toLowerCase() !== combo.key) return false;
  if (event.shiftKey !== combo.shift || event.altKey !== combo.alt) return false;
  if (combo.mod) return event.metaKey !== event.ctrlKey && !combo.meta && !combo.ctrl;
  return event.metaKey === combo.meta && event.ctrlKey === combo.ctrl;
}

/** Whether the shortcut hints should show the Command key. Display only. */
export function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/**
 * Registers a window-level shortcut such as "mod+shift+a" for as long as the caller is mounted
 * and `enabled`. A key press that something else already handled is left alone.
 */
export function useKeyboardShortcut(
  combo: string,
  handler: () => void,
  enabled: boolean = true,
): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const parsed = parseCombo(combo);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || !matches(event, parsed)) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled]);
}
