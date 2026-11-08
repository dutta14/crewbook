import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionItemDue } from '../components/ActionItemDue';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { FilterChips } from '../components/FilterChips';
import { ChecklistIcon } from '../components/icons';
import { compareByDueDate, isActionItemStatus, listAll } from '../data/actionItems';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import type { ActionItem, ActionItemStatus } from '../types/ActionItem';
import type { TeamMember } from '../types/TeamMember';
import '../styles/action-items.css';
import '../styles/form.css';
import '../styles/table.css';

type StatusFilter = ActionItemStatus | 'all';
type SortKey = 'person' | 'title' | 'owner' | 'dueDate' | 'status';
type SortDirection = 'ascending' | 'descending';

interface Row {
  item: ActionItem;
  member: TeamMember;
  ownerName: string;
}

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'person', label: 'Person' },
  { key: 'title', label: 'Title' },
  { key: 'owner', label: 'Owner' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'status', label: 'Status' },
];

const STATUS_RANK: Record<ActionItemStatus, number> = { open: 0, done: 1, cancelled: 2 };
const STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: 'Open',
  done: 'Done',
  cancelled: 'Cancelled',
};
const LOAD_FAILED = "Couldn't open your action items. Lock and unlock Crewbook to try again.";

const text = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

const COMPARATORS: Record<SortKey, (a: Row, b: Row) => number> = {
  person: (a, b) => text(a.member.name, b.member.name),
  title: (a, b) => text(a.item.title, b.item.title),
  owner: (a, b) => text(a.ownerName, b.ownerName),
  dueDate: (a, b) => compareByDueDate(a.item, b.item),
  status: (a, b) => STATUS_RANK[a.item.status] - STATUS_RANK[b.item.status],
};

const isStatusFilter = (value: string): value is StatusFilter =>
  value === 'all' || isActionItemStatus(value);

/** Every open commitment across the team, so this page is as sensitive as all the notes together. */
export function GlobalActions() {
  const { isPrivateUnlocked, loadPrivate } = useEncryptedStorage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [loadPrivate]);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="action-items-page__title">
        Action Items
      </h1>
      {loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : isPrivateUnlocked ? (
        <ActionItemsTable />
      ) : (
        <p className="action-items__empty">Opening your action items…</p>
      )}
    </>
  );
}

function ActionItemsTable() {
  const storage = useEncryptedStorage();
  // Filter and sort state stays in the component; names must never end up in the URL.
  const [status, setStatus] = useState<StatusFilter>('open');
  const [personId, setPersonId] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'dueDate',
    direction: 'ascending',
  });

  const members = useMemo(() => listMembers(storage), [storage]);
  const rows = useMemo(() => {
    const byId = new Map(members.map((member) => [member.id, member]));
    // Items of a member who no longer exists have no person to show.
    return listAll(storage).flatMap((item): Row[] => {
      const member = byId.get(item.memberId);
      if (!member) return [];
      return [{ item, member, ownerName: byId.get(item.ownerId)?.name ?? item.ownerName }];
    });
  }, [members, storage]);

  const visible = useMemo(() => {
    const compare = COMPARATORS[sort.key];
    const direction = sort.direction === 'ascending' ? 1 : -1;
    return rows
      .filter((row) => status === 'all' || row.item.status === status)
      .filter((row) => personId === 'all' || row.member.id === personId)
      .sort((a, b) => {
        // Items without a due date sort last in either direction.
        if (sort.key === 'dueDate' && Boolean(a.item.dueDate) !== Boolean(b.item.dueDate)) {
          return a.item.dueDate ? -1 : 1;
        }
        return compare(a, b) * direction || text(a.item.title, b.item.title);
      });
  }, [rows, status, personId, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending',
    }));

  const sortedLabel = COLUMNS.find((column) => column.key === sort.key)?.label ?? '';

  const nothingOpen = (
    <EmptyState
      icon={<ChecklistIcon size={48} />}
      title="No open action items across your team. Nice work!"
    />
  );
  // With no items at all there is nothing to filter, so the controls would only be noise.
  if (rows.length === 0) return nothingOpen;

  return (
    <>
      <div className="action-items-page__controls">
        <FilterChips
          ariaLabel="Filter by status"
          options={FILTER_OPTIONS}
          value={status}
          onChange={(value) => {
            if (isStatusFilter(value)) setStatus(value);
          }}
        />
        <div className="action-items-page__person">
          <label htmlFor="action-items-person">Person</label>
          <select
            id="action-items-person"
            className="form-input"
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
          >
            <option value="all">All team members</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {`${visible.length} ${visible.length === 1 ? 'action item' : 'action items'}. Sorted by ${sortedLabel}, ${sort.direction}.`}
      </div>
      {visible.length === 0 ? (
        status === 'open' && personId === 'all' ? (
          nothingOpen
        ) : (
          <p className="action-items__empty">No action items match these filters.</p>
        )
      ) : (
        <div className="action-items-page__table-wrap">
          <table className="roster-table action-items-table">
            <caption className="sr-only">Action items across team</caption>
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const isSorted = sort.key === column.key;
                  return (
                    <th key={column.key} scope="col" aria-sort={isSorted ? sort.direction : 'none'}>
                      <button
                        type="button"
                        className="action-items-table__sort"
                        onClick={() => toggleSort(column.key)}
                      >
                        {column.label}
                        <span aria-hidden="true" className="action-items-table__arrow">
                          {isSorted ? (sort.direction === 'ascending' ? '↑' : '↓') : ''}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ item, member, ownerName }) => (
                <tr key={item.id} className={`action-items-table__row--${item.status}`}>
                  <td>
                    <div className="roster-identity">
                      <Avatar
                        name={member.name}
                        avatarUrl={member.avatarUrl}
                        size="sm"
                        aria-hidden
                      />
                      <Link className="action-items-table__person" to={`/person/${member.id}`}>
                        {member.name}
                      </Link>
                    </div>
                  </td>
                  <td className="action-items-table__title">{item.title}</td>
                  <td>
                    <span className="action-item__owner">{ownerName}</span>
                  </td>
                  <td>
                    <ActionItemDue item={item} />
                  </td>
                  <td>
                    <span className="action-item__state">{STATUS_LABELS[item.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
