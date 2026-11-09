import { useCallback, useMemo, useState } from 'react';
import type { SharedActionItem } from '../types/sharing';

/**
 * The shared page's action items. Ticking an item is held in memory for this visit only: nothing
 * is written to storage or sent anywhere, and a reload starts again from the link's snapshot.
 */
export function useSharedActionItems(snapshot: readonly SharedActionItem[]) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());

  const items = useMemo<SharedActionItem[]>(
    () =>
      snapshot.map((item) => {
        const done = overrides.get(item.id);
        return done === undefined ? item : { ...item, status: done ? 'done' : 'open' };
      }),
    [snapshot, overrides],
  );

  const toggle = useCallback(
    (itemId: string, done: boolean) => {
      // Only ids that came with the link count; anything else is ignored.
      if (!snapshot.some((item) => item.id === itemId)) return;
      setOverrides((current) => new Map(current).set(itemId, done));
    },
    [snapshot],
  );

  return { items, toggle };
}
