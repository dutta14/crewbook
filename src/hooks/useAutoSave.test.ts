import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_DELAY_MS, useAutoSave } from './useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('treats the starting value as already saved', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutoSave('draft', onSave));

    act(() => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2));

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: 'idle', isDirty: false });
  });

  it('saves once the value has been still for the delay, then reports Saved and goes quiet', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ value }) => useAutoSave(value, onSave), {
      initialProps: { value: '' },
    });

    rerender({ value: 'a' });
    act(() => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1));
    rerender({ value: 'ab' });
    act(() => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1));
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.isDirty).toBe(true);

    await act(async () => void vi.advanceTimersByTime(1));
    expect(onSave).toHaveBeenCalledExactlyOnceWith('ab');
    expect(result.current).toEqual({ status: 'saved', isDirty: false });

    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.status).toBe('idle');
  });

  it('reports a failure, stays dirty and tries again on the next change', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ value }) => useAutoSave(value, onSave), {
      initialProps: { value: '' },
    });

    rerender({ value: 'a' });
    await act(async () => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(result.current).toEqual({ status: 'error', isDirty: true });

    rerender({ value: 'ab' });
    await act(async () => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(result.current).toEqual({ status: 'saved', isDirty: false });
  });

  it('cancels a pending save on unmount', () => {
    const onSave = vi.fn();
    const { rerender, unmount } = renderHook(({ value }) => useAutoSave(value, onSave), {
      initialProps: { value: '' },
    });
    rerender({ value: 'a' });

    unmount();
    act(() => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2));

    expect(onSave).not.toHaveBeenCalled();
  });
});
