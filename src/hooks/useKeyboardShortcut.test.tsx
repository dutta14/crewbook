import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcut } from './useKeyboardShortcut';

const press = (init: KeyboardEventInit) => fireEvent.keyDown(window, { key: 'a', ...init });

describe('useKeyboardShortcut', () => {
  it('runs the handler for Cmd or Ctrl plus Shift plus the key', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut('mod+shift+a', handler));

    press({ metaKey: true, shiftKey: true });
    press({ ctrlKey: true, shiftKey: true });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('ignores other combinations and held keys', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut('mod+shift+a', handler));

    press({ shiftKey: true });
    press({ metaKey: true });
    press({ metaKey: true, ctrlKey: true, shiftKey: true });
    press({ metaKey: true, shiftKey: true, altKey: true });
    press({ metaKey: true, shiftKey: true, repeat: true });
    fireEvent.keyDown(window, { key: 'b', metaKey: true, shiftKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing while disabled or after unmount', () => {
    const handler = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useKeyboardShortcut('mod+shift+a', handler, enabled),
      { initialProps: { enabled: false } },
    );

    press({ metaKey: true, shiftKey: true });
    expect(handler).not.toHaveBeenCalled();

    rerender({ enabled: true });
    unmount();
    press({ metaKey: true, shiftKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('leaves key presses that were already handled alone', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut('mod+shift+a', handler));
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
    });
    event.preventDefault();

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });
});
