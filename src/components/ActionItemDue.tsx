import type { ActionItem } from '../types/ActionItem';
import { isItemOverdue } from '../data/actionItems';
import { formatScheduleDate } from '../utils/scheduleFormat';
import '../styles/action-items.css';
import { WarningIcon } from './icons';

interface ActionItemDueProps {
  item: Pick<ActionItem, 'status' | 'dueDate'>;
  now?: Date;
}

/** Overdue dates turn red and say "Overdue", so colour is never the only signal. */
export function ActionItemDue({ item, now }: ActionItemDueProps) {
  const label = item.dueDate ? formatScheduleDate(item.dueDate) : null;
  if (!item.dueDate || !label) return <span className="action-item__due">No due date</span>;
  const overdue = isItemOverdue(item, now);
  return (
    <span className={`action-item__due${overdue ? ' action-item__due--overdue' : ''}`}>
      {overdue ? <WarningIcon size={14} /> : null}
      <time dateTime={item.dueDate}>{label}</time>
      {overdue ? <span className="action-item__overdue-label">Overdue</span> : null}
    </span>
  );
}
