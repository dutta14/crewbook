import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'theme';
// Lets every mounted copy of the hook (sidebar toggle, Settings switch) follow the same choice.
const THEME_EVENT = 'crewbook:theme';

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getInitialIsDark(): boolean {
  const stored = readStoredTheme();
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return prefersDark();
}

function announce(isDark: boolean): void {
  window.dispatchEvent(new CustomEvent<boolean>(THEME_EVENT, { detail: isDark }));
}

/** Forgets the saved theme so the system preference applies again, as after Clear All Data. */
export function resetTheme(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
  announce(prefersDark());
}

export function useDarkMode(): {
  isDark: boolean;
  toggle: () => void;
  setDark: (isDark: boolean) => void;
} {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useLayoutEffect(() => {
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const onTheme = (event: Event) => setIsDark((event as CustomEvent<boolean>).detail);
    window.addEventListener(THEME_EVENT, onTheme);
    return () => window.removeEventListener(THEME_EVENT, onTheme);
  }, []);

  const setDark = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable (private mode); the switch still works for this session.
    }
    announce(next);
  }, []);

  const toggle = useCallback(() => setDark(!isDark), [isDark, setDark]);

  return { isDark, toggle, setDark };
}
