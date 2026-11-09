import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetTheme, useDarkMode } from './useDarkMode';

const stubSystemTheme = (prefersDark: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: prefersDark, addEventListener: vi.fn() }),
  );
};

describe('useDarkMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to light when nothing is stored and the system prefers light', () => {
    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(false);
    expect(document.body).not.toHaveClass('dark');
  });

  it('follows the system preference when nothing is stored', () => {
    stubSystemTheme(true);

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(true);
    expect(document.body).toHaveClass('dark');
  });

  it('prefers the stored "light" theme over a dark system preference', () => {
    stubSystemTheme(true);
    localStorage.setItem('theme', 'light');

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(false);
  });

  it('restores the stored "dark" theme on mount', () => {
    localStorage.setItem('theme', 'dark');

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(true);
    expect(document.body).toHaveClass('dark');
  });

  it('adds the "dark" class to body and stores "dark" when toggled on', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => result.current.toggle());

    expect(result.current.isDark).toBe(true);
    expect(document.body).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('removes the "dark" class from body and stores "light" when toggled off', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => result.current.toggle());
    act(() => result.current.toggle());

    expect(result.current.isDark).toBe(false);
    expect(document.body).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('persists the preference across remounts', () => {
    const first = renderHook(() => useDarkMode());
    act(() => first.result.current.toggle());
    first.unmount();

    const second = renderHook(() => useDarkMode());

    expect(second.result.current.isDark).toBe(true);
  });

  it('ignores an unrecognised stored value', () => {
    localStorage.setItem('theme', 'sepia');

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDark).toBe(false);
  });

  it('sets the theme directly and keeps every hook instance in step', () => {
    const first = renderHook(() => useDarkMode());
    const second = renderHook(() => useDarkMode());

    act(() => first.result.current.setDark(true));

    expect(second.result.current.isDark).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    act(() => second.result.current.setDark(false));
    expect(first.result.current.isDark).toBe(false);
    expect(document.body).not.toHaveClass('dark');
  });

  it('forgets the saved theme and returns to the system preference on reset', () => {
    const { result } = renderHook(() => useDarkMode());
    act(() => result.current.setDark(true));
    stubSystemTheme(false);

    act(() => resetTheme());

    expect(localStorage.getItem('theme')).toBeNull();
    expect(result.current.isDark).toBe(false);
    expect(document.body).not.toHaveClass('dark');
  });

  it('still toggles for the session when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useDarkMode());

    act(() => result.current.toggle());

    expect(result.current.isDark).toBe(true);
    expect(document.body).toHaveClass('dark');
  });
});
