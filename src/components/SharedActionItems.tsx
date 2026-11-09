import { useEffect, useRef, useState } from 'react';
import '../styles/shared-action-items.css';
import type { SharedActionItem } from '../types/sharing';
import { formatNoteDate } from '../utils/noteFormat';
import {
  SESSION_ONLY_NOTE,
  describeDoneCount,
  getOwnerLabel,
  splitByStatus,
} from '../utils/sharedActionItems';
import { CollapsibleSection } from './CollapsibleSection';
import { SharedActionRow } from './SharedActionRow';

interface SharedActionItemsProps {
  items: readonly SharedActionItem[];
  currentUserIsManager: boolean;
  managerName: string;
  /** ISO 8601 moment the link was made, shown so the list reads as a snapshot. */
  asOf: string;
  onToggle: (itemId: string, done: boolean) => void;
}

type FocusTarget = { kind: 'item'; id: string } | { kind: 'heading' };

/** Read-only for the manager's data: ticking an item only changes what this reader sees. */
export function SharedActionItems({
  items,
  currentUserIsManager,
  managerName,
  asOf,
  onToggle,
}: SharedActionItemsProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [movedId, setMovedId] = useState<string | null>(null);
  const { open, done } = splitByStatus(items);

  // The row that was ticked leaves the list, so focus is handed on before it can be lost.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target.kind === 'heading') {
      headingRef.current?.focus();
      return;
    }
    const row = Array.from(
      sectionRef.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? [],
    ).find((element) => element.dataset.itemId === target.id);
    row?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
  }, [items]);

  const handleToggle = (item: SharedActionItem, markDone: boolean) => {
    if (markDone) {
      const index = open.findIndex(({ id }) => id === item.id);
      const next = open[index + 1] ?? open[index - 1];
      pendingFocus.current = next ? { kind: 'item', id: next.id } : { kind: 'heading' };
    } else {
      pendingFocus.current = { kind: 'item', id: item.id };
    }
    setMovedId(item.id);
    setAnnouncement(describeDoneCount(done.length + (markDone ? 1 : -1)));
    onToggle(item.id, markDone);
  };

  const renderRows = (rows: readonly SharedActionItem[]) =>
    rows.map((item) => (
      <SharedActionRow
        key={item.id}
        item={item}
        ownerLabel={getOwnerLabel(item.owner, currentUserIsManager, managerName)}
        moved={item.id === movedId}
        onToggle={handleToggle}
      />
    ));

  return (
    <section
      ref={sectionRef}
      className="shared-view__section"
      aria-labelledby="shared-actions-title"
    >
      <h2
        id="shared-actions-title"
        ref={headingRef}
        tabIndex={-1}
        className="shared-view__section-title"
      >
        Action items
      </h2>
      {items.length === 0 ? (
        <p className="shared-view__empty">No action items yet</p>
      ) : (
        <>
          <p className="shared-view__time shared-actions__note">
            Action items as of <time dateTime={asOf}>{formatNoteDate(asOf)}</time>.{' '}
            {SESSION_ONLY_NOTE}
          </p>
          <div className="shared-actions__card">
            <h3 className="shared-actions__heading">{`Open (${open.length})`}</h3>
            {open.length === 0 ? (
              <p className="shared-actions__none">No open action items</p>
            ) : (
              <ul className="shared-actions__list" aria-label="Action items">
                {renderRows(open)}
              </ul>
            )}
            {done.length > 0 ? (
              <CollapsibleSection title="Done" count={done.length} contentId="done-items-list">
                <ul className="shared-actions__list" aria-label="Done action items">
                  {renderRows(done)}
                </ul>
              </CollapsibleSection>
            ) : null}
          </div>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </span>
        </>
      )}
    </section>
  );
}
