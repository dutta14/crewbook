import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUndoableAction } from './useUndoableAction';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUndoableAction', () => {
  it('runs the action at once and offers undo for 5 seconds by default', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useUndoableAction(action, vi.fn()));

    act(() => result.current.execute());
    expect(action).toHaveBeenCalledOnce();
    expect(result.current.undoAvailable).toBe(true);

    act(() => void vi.advanceTimersByTime(4999));
    expect(result.current.undoAvailable).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.undoAvailable).toBe(false);
  });

  it('runs undo and closes the window when triggered in time', () => {
    const undo = vi.fn();
    const { result } = renderHook(() => useUndoableAction(vi.fn(), undo));

    act(() => result.current.execute());
    act(() => result.current.triggerUndo());

    expect(undo).toHaveBeenCalledOnce();
    expect(result.current.undoAvailable).toBe(false);
  });

  it('ignores undo after the window has closed', () => {
    const undo = vi.fn();
    const { result } = renderHook(() => useUndoableAction(vi.fn(), undo, 1000));

    act(() => result.current.execute());
    act(() => void vi.advanceTimersByTime(1000));
    act(() => result.current.triggerUndo());

    expect(undo).not.toHaveBeenCalled();
  });

  it('restarts the window when executed again', () => {
    const { result } = renderHook(() => useUndoableAction(vi.fn(), vi.fn(), 1000));

    act(() => result.current.execute());
    act(() => void vi.advanceTimersByTime(800));
    act(() => result.current.execute());
    act(() => void vi.advanceTimersByTime(800));

    expect(result.current.undoAvailable).toBe(true);
  });

  it('closes the window when an async action fails', async () => {
    const { result } = renderHook(() =>
      useUndoableAction(() => Promise.reject(new Error('write failed')), vi.fn()),
    );

    await act(async () => result.current.execute());

    expect(result.current.undoAvailable).toBe(false);
  });

  it('commits without undo when the component unmounts during the window', () => {
    const undo = vi.fn();
    const { result, unmount } = renderHook(() => useUndoableAction(vi.fn(), undo));

    act(() => result.current.execute());
    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(undo).not.toHaveBeenCalled();
  });
});
