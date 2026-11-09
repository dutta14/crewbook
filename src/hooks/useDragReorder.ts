import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { getArrowTarget, getDropIndex } from '../utils/dragReorder';

const MOVE_THROTTLE_MS = 16;

interface Drag {
  from: number;
  to: number;
}

export interface UseDragReorder {
  /** The row being dragged and the row it would land on, or null when idle. */
  drag: Drag | null;
  registerRow: (index: number, element: HTMLElement | null) => void;
  getHandleProps: (index: number) => {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
}

/**
 * Reorders a list by pointer (using pointer events, so touch and mouse behave alike) or with
 * ArrowUp and ArrowDown on the focused handle. `onMove` receives the item's old and new index.
 */
export function useDragReorder(
  length: number,
  onMove: (fromIndex: number, toIndex: number) => void,
): UseDragReorder {
  const [drag, setDrag] = useState<Drag | null>(null);
  const rows = useRef(new Map<number, HTMLElement>());
  const lastMove = useRef(0);

  const registerRow = useCallback((index: number, element: HTMLElement | null) => {
    if (element) rows.current.set(index, element);
    else rows.current.delete(index);
  }, []);

  const midpoints = () =>
    Array.from({ length }, (_, index) => {
      const box = rows.current.get(index)?.getBoundingClientRect();
      return box ? box.top + box.height / 2 : 0;
    });

  const getHandleProps = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDrag({ from: index, to: index });
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!drag) return;
      const now = performance.now();
      if (now - lastMove.current < MOVE_THROTTLE_MS) return;
      lastMove.current = now;
      const to = getDropIndex(midpoints(), event.clientY);
      if (to !== drag.to) setDrag({ from: drag.from, to });
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (!drag) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      // The release can arrive inside the throttle window, so the final position is read again.
      const to = getDropIndex(midpoints(), event.clientY);
      setDrag(null);
      if (to !== drag.from) onMove(drag.from, to);
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const target = getArrowTarget(event.key, index, length);
      if (target === null) return;
      event.preventDefault();
      onMove(index, target);
    },
  });

  return { drag, registerRow, getHandleProps };
}
