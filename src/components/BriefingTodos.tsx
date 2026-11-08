import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { BriefingTodo } from '../types/briefing';
import '../styles/pages/todo.css';
import { BriefingSection } from './BriefingSection';
import { PRIORITY_LABELS } from './TodoItem';

interface BriefingTodosProps {
  todos: BriefingTodo[];
  /** Resolves once the change is saved; rejects when it is not, and the caller reports why. */
  onToggle: (id: string) => Promise<void>;
  index?: number;
}

/** Tasks due today. A finished one stays in the list, ticked, until the next visit. */
export function BriefingTodos({ todos, onToggle, index }: BriefingTodosProps) {
  return (
    <BriefingSection id="action-items" title="Action Items" count={todos.length} index={index}>
      {todos.length === 0 ? (
        <div className="todays-card__empty">
          <p>Nothing due today</p>
        </div>
      ) : (
        <ul className="todays-card__list">
          {todos.map((todo) => (
            <BriefingTodoRow key={todo.id} todo={todo} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </BriefingSection>
  );
}

interface BriefingTodoRowProps {
  todo: BriefingTodo;
  onToggle: (id: string) => Promise<void>;
}

function BriefingTodoRow({ todo, onToggle }: BriefingTodoRowProps) {
  const titleId = useId();
  const isDone = todo.status === 'done';

  const handleChange = async () => {
    try {
      await onToggle(todo.id);
    } catch {
      // The caller has already reported the failure; the box stays as it was.
    }
  };

  return (
    <li className="digest-item briefing-todo">
      <input
        type="checkbox"
        className="todo-row__checkbox briefing-todo__checkbox"
        checked={isDone}
        aria-labelledby={titleId}
        onChange={() => void handleChange()}
      />
      <Link className="digest-row briefing-todo__link" to="/tasks">
        <span
          id={titleId}
          className={`digest-row__name${isDone ? ' briefing-todo__title--done' : ''}`}
        >
          {todo.title}
        </span>
        <span className={`todo-badge todo-badge--${todo.priority}`}>
          {PRIORITY_LABELS[todo.priority]}
        </span>
      </Link>
    </li>
  );
}
