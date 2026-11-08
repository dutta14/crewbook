import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatElapsed, useTimer } from './useTimer';

describe('formatElapsed', () => {
  it('formats minutes and padded seconds, and keeps counting minutes past an hour', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(83)).toBe('1:23');
    expect(formatElapsed(3725)).toBe('62:05');
    expect(formatElapsed(-4)).toBe('0:00');
  });
});

describe('useTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts up once started and freezes when stopped', () => {
    const { result } = renderHook(() => useTimer());
    expect(result.current.elapsed).toBe('0:00');

    act(() => result.current.startTimer());
    act(() => void vi.advanceTimersByTime(65_000));
    expect(result.current.elapsed).toBe('1:05');

    act(() => result.current.stopTimer());
    act(() => void vi.advanceTimersByTime(10_000));
    expect(result.current.elapsed).toBe('1:05');
  });

  it('restarts from zero when started again', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.startTimer());
    act(() => void vi.advanceTimersByTime(5_000));

    act(() => result.current.startTimer());

    expect(result.current.elapsed).toBe('0:00');
  });
});
