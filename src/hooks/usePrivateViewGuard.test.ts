import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRIVATE_VIEW_IDLE_MS, usePrivateViewGuard } from './usePrivateViewGuard';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('usePrivateViewGuard', () => {
  it('closes after the idle time with no activity', () => {
    const onClose = vi.fn();
    renderHook(() => usePrivateViewGuard(true, onClose));

    act(() => vi.advanceTimersByTime(PRIVATE_VIEW_IDLE_MS - 1));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restarts the idle timer on activity', () => {
    const onClose = vi.fn();
    renderHook(() => usePrivateViewGuard(true, onClose, 1000));

    act(() => vi.advanceTimersByTime(900));
    act(() => void document.dispatchEvent(new Event('keydown')));
    act(() => vi.advanceTimersByTime(900));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the tab is hidden', () => {
    const onClose = vi.fn();
    renderHook(() => usePrivateViewGuard(true, onClose));

    act(() => setVisibility('hidden'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does nothing while inactive and cleans up when it stops being active', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(({ active }) => usePrivateViewGuard(active, onClose, 100), {
      initialProps: { active: false },
    });
    act(() => vi.advanceTimersByTime(500));
    act(() => setVisibility('hidden'));
    expect(onClose).not.toHaveBeenCalled();

    setVisibility('visible');
    rerender({ active: true });
    rerender({ active: false });
    act(() => vi.advanceTimersByTime(500));
    act(() => setVisibility('hidden'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls the latest onClose without restarting the timer', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => usePrivateViewGuard(true, cb, 1000), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    act(() => vi.advanceTimersByTime(1000));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
