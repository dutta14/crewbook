import type { SharedActionItem } from '../types/sharing';
import { isOverdue } from '../utils/scheduleCalculator';
import { formatScheduleDate } from '../utils/scheduleFormat';

interface SharedActionRowProps {
  item: SharedActionItem;
  ownerLabel: string;
  /** True for the row that just changed section, so only it fades in. */
  moved: boolean;
  onToggle: (item: SharedActionItem, done: boolean) => void;
}

/** One action item. Everything comes from the link and is shown as plain text. */
export function SharedActionRow({ item, ownerLabel, moved, onToggle }: SharedActionRowProps) {
  const isDone = item.status === 'done';
  const due = item.dueDate ? formatScheduleDate(item.dueDate) : null;
  const overdue = !isDone && item.dueDate !== undefined && isOverdue(item.dueDate);

  return (
    <li className={`shared-action${moved ? ' shared-action--moved' : ''}`} data-item-id={item.id}>
      <label className="shared-action__check">
        <input
          type="checkbox"
          className="shared-action__checkbox"
          checked={isDone}
          aria-label={`Mark ${item.title} as done`}
          onChange={(event) => onToggle(item, event.target.checked)}
        />
      </label>
      <div className="shared-action__body">
        <span className={`shared-action__title${isDone ? ' shared-action__title--done' : ''}`}>
          {item.title}
        </span>
        <span className="shared-action__owner">
          <span className="sr-only">Owner: </span>
          {ownerLabel}
        </span>
      </div>
      {due && item.dueDate ? (
        <time
          className={`shared-action__due${overdue ? ' shared-action__due--overdue' : ''}`}
          dateTime={item.dueDate}
        >
          Due {due}
          {overdue ? <span className="shared-action__overdue-label"> (overdue)</span> : null}
        </time>
      ) : null}
    </li>
  );
}
