/** A copy of `list` with the item at `fromIndex` moved to `toIndex`. Out-of-range moves change nothing. */
export function reorderList<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  const isInRange = (index: number) => Number.isInteger(index) && index >= 0 && index < list.length;
  if (!isInRange(fromIndex) || !isInRange(toIndex) || fromIndex === toIndex) return [...list];
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** Where ArrowUp or ArrowDown would move an item, or null for any other key or the end of the list. */
export function getArrowTarget(key: string, index: number, length: number): number | null {
  const target = key === 'ArrowUp' ? index - 1 : key === 'ArrowDown' ? index + 1 : null;
  return target !== null && target >= 0 && target < length ? target : null;
}

/** The index a dragged item would drop at, given the vertical midpoint of every row in order. */
export function getDropIndex(midpoints: readonly number[], pointerY: number): number {
  const passed = midpoints.filter((midpoint) => pointerY > midpoint).length;
  return Math.min(passed, Math.max(midpoints.length - 1, 0));
}
