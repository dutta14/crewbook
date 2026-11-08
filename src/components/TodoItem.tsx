import { useId, useState } from 'react';
import { isTodoOverdue } from '../data/todos';
import type { TeamMember } from '../types/TeamMember';
import type { Priority, Todo } from '../types/todo';
import { formatScheduleDate } from '../utils/scheduleFormat';
import '../styles/button.css';
import '../styles/pages/todo.css';
import { Avatar } from './Avatar';
import { WarningIcon } from './icons';
import { OverflowMenu } from './OverflowMenu';

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

interface TodoItemProps {
  todo: Todo;
  /** The linked person, when they are still on the team. */
  person?: TeamMember;
  /** Resolves once the change is saved; rejects when it is not, and the caller reports why. */
  onToggle: (id: string) => Promise<void>;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  /** Offered only for a task that is linked to a person. */
  onSetReminder?: (todo: Todo) => void;
  now?: Date;
}

export function TodoItem({
  todo,
  person,
  onToggle,
  onEdit,
  onDelete,
  onSetReminder,
  now,
}: TodoItemProps) {
  const checkboxId = useId();
  const [announcement, setAnnouncement] = useState('');
  const { title, status, dueDate } = todo;
  const isDone = status === 'done';
  const isOverdue = isTodoOverdue(todo, now);
  const dueLabel = dueDate ? formatScheduleDate(dueDate) : null;

  const handleToggle = async () => {
    const markingDone = !isDone;
    try {
      await onToggle(todo.id);
      setAnnouncement(`Task ${title} marked as ${markingDone ? 'done' : 'to do'}`);
    } catch {
      // The caller has already reported the failure; the box stays as it was.
    }
  };

  return (
    <li className={`todo-row${isOverdue ? ' todo-row--overdue' : ''}`}>
      <input
        id={checkboxId}
        type="checkbox"
        className="todo-row__checkbox"
        checked={isDone}
        onChange={() => void handleToggle()}
      />
      <label
        htmlFor={checkboxId}
        className={`todo-row__title${isDone ? ' todo-row__title--done' : ''}`}
      >
        {title}
      </label>
      <div className="todo-row__meta">
        {person ? <Avatar name={person.name} avatarUrl={person.avatarUrl} size="sm" /> : null}
        {status === 'in_progress' ? (
          <span className="todo-badge todo-badge--progress">In progress</span>
        ) : null}
        <span className={`todo-badge todo-badge--${todo.priority}`}>
          {PRIORITY_LABELS[todo.priority]}
        </span>
        {dueDate && dueLabel ? (
          <span className={`todo-row__due${isOverdue ? ' todo-row__due--overdue' : ''}`}>
            {isOverdue ? <WarningIcon size={14} /> : null}
            <time dateTime={dueDate}>{dueLabel}</time>
            {isOverdue ? <span className="sr-only">(overdue)</span> : null}
          </span>
        ) : null}
      </div>
      <OverflowMenu
        label="Task actions"
        items={[
          { label: 'Edit', onSelect: () => onEdit(todo) },
          ...(onSetReminder && todo.linkedPersonId
            ? [{ label: 'Set reminder', onSelect: () => onSetReminder(todo) }]
            : []),
          { label: 'Delete', onSelect: () => onDelete(todo) },
        ]}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </li>
  );
}
