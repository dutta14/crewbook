import { useMemo, useState } from 'react';
import { isActionItemStatus, listByMember } from '../data/actionItems';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import type { ActionItemStatus } from '../types/ActionItem';
import '../styles/action-items.css';
import { ActionItemRow } from './ActionItemRow';
import { FilterChips } from './FilterChips';

interface ActionItemListProps {
  memberId: string;
  now?: Date;
}

export const STATUS_OPTIONS: Array<{ value: ActionItemStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY_ALL = 'No action items. Create one during your next 1:1.';

/**
 * A member's action items. Open ones stay here until they are done or cancelled, so they carry
 * forward into every later 1:1. Needs the private envelope to be loaded already.
 */
export function ActionItemList({ memberId, now }: ActionItemListProps) {
  const storage = useEncryptedStorage();
  // The filter is local state only; it never reaches the URL or storage.
  const [filter, setFilter] = useState<ActionItemStatus>('open');
  // Items changed from this view stay put until the filter changes, so a done item keeps its
  // Undo link and the list does not jump under the pointer.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());

  const items = useMemo(() => listByMember(memberId, storage), [memberId, storage]);
  const ownerNames = useMemo(
    () => new Map(listMembers(storage).map((member) => [member.id, member.name])),
    [storage],
  );
  const visible = items.filter((item) => item.status === filter || pinned.has(item.id));
  const openCount = items.filter((item) => item.status === 'open').length;
  const filterLabel = STATUS_OPTIONS.find((option) => option.value === filter)?.label ?? '';

  const handleFilter = (value: string) => {
    if (!isActionItemStatus(value)) return;
    setFilter(value);
    setPinned(new Set());
  };

  const handleChanged = (id: string) => setPinned((current) => new Set(current).add(id));

  return (
    <section className="action-items" aria-labelledby={`action-items-heading-${memberId}`}>
      <div className="action-items__header">
        <h3 id={`action-items-heading-${memberId}`} className="action-items__title">
          Action items
        </h3>
        {items.length > 0 ? (
          <FilterChips
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS}
            value={filter}
            onChange={handleFilter}
          />
        ) : null}
      </div>
      {openCount > 0 ? (
        <p className="action-items__hint">
          Open items carry forward to your next 1:1 until you mark them done or cancel them.
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="action-items__empty">{EMPTY_ALL}</p>
      ) : visible.length === 0 ? (
        <p className="action-items__empty">{`No ${filterLabel.toLowerCase()} action items.`}</p>
      ) : (
        <ul className="action-items__list" aria-label={`${filterLabel} action items`}>
          {visible.map((item) => (
            <ActionItemRow
              key={item.id}
              item={item}
              ownerName={ownerNames.get(item.ownerId) ?? item.ownerName}
              now={now}
              onChanged={handleChanged}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
