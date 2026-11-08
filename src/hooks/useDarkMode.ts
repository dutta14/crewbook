import { useCallback, useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'theme';

function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getInitialIsDark(): boolean {
  const stored = readStoredTheme();
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useDarkMode(): { isDark: boolean; toggle: () => void } {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useLayoutEffect(() => {
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this session.
    }
  }, [isDark]);

  return { isDark, toggle };
}
