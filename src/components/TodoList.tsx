import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { isPriority, isTodoSortField, isTodoStatus } from '../data/todos';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTodos } from '../hooks/useTodos';
import { useToast } from '../hooks/useToast';
import type { TeamMember } from '../types/TeamMember';
import type { Todo, TodoFilters, TodoSortField } from '../types/todo';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/pages/todo.css';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { ClipboardIcon, FilterIcon } from './icons';
import { Modal } from './Modal';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, TodoForm } from './TodoForm';
import { TodoItem } from './TodoItem';

const MOBILE_QUERY = '(max-width: 767.98px)';

const SORT_OPTIONS: Array<{ value: TodoSortField; label: string }> = [
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'createdAt', label: 'Date created' },
];

interface TodoListProps {
  now?: Date;
}

export function TodoList({ now }: TodoListProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const {
    todos,
    total,
    filters,
    sortField,
    setFilters,
    setSortField,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleStatus,
  } = useTodos();
  const members = useMemo(() => listMembers(storage), [storage]);
  const peopleById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  // The task being edited is kept while the form animates out, so the title does not flip.
  const [form, setForm] = useState<{ isOpen: boolean; todo?: Todo }>({ isOpen: false });
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const sortId = useId();

  const activeFilterCount = Object.keys(filters).length;

  const handleSubmit = async (input: Parameters<typeof createTodo>[0]) => {
    if (form.todo) {
      await updateTodo(form.todo.id, input);
      showToast('Task updated', 'success');
    } else {
      await createTodo(input);
      showToast('Task added', 'success');
    }
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    const { id } = deleting;
    setDeleting(null);
    deleteTodo(id).then(
      () => {
        showToast('Task deleted', 'success');
        // The row that held focus is gone, so focus would otherwise fall back to the page body.
        addButtonRef.current?.focus();
      },
      () => undefined,
    );
  };

  const handleToggle = (id: string) => toggleStatus(id);
  const handleEdit = (todo: Todo) => setForm({ isOpen: true, todo });
  const handleAdd = () => setForm({ isOpen: true });
  const closeForm = () => setForm((current) => ({ ...current, isOpen: false }));

  const filterControls = (
    <FilterControls filters={filters} members={members} onChange={setFilters} />
  );

  return (
    <section className="todo-card" aria-labelledby="todo-card-title">
      <h2 id="todo-card-title" className="todo-card__title">
        Tasks
      </h2>
      <div className="todo-toolbar">
        {total > 0 ? (
          <div className="todo-toolbar__controls">
            {isMobile ? (
              <button
                type="button"
                className="btn btn-secondary"
                aria-haspopup="dialog"
                onClick={() => setIsFilterSheetOpen(true)}
              >
                <FilterIcon size={16} />
                {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
              </button>
            ) : (
              filterControls
            )}
            <div className="todo-field">
              <label htmlFor={sortId}>Sort by</label>
              <select
                id={sortId}
                className="form-input"
                autoComplete="off"
                value={sortField}
                onChange={(event) => {
                  if (isTodoSortField(event.target.value)) setSortField(event.target.value);
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <button
          ref={addButtonRef}
          type="button"
          className="btn btn-primary todo-toolbar__add"
          onClick={handleAdd}
        >
          + Add task
        </button>
      </div>

      {total === 0 ? (
        <EmptyState icon={<ClipboardIcon size={48} />} title="All clear! No pending tasks." />
      ) : (
        <>
          <p className="sr-only" role="status" aria-live="polite">
            {`${todos.length} ${todos.length === 1 ? 'task' : 'tasks'} shown`}
          </p>
          {todos.length === 0 ? (
            <p className="todo-card__no-match">No tasks match these filters.</p>
          ) : (
            <ul className="todo-list">
              {todos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  person={todo.linkedPersonId ? peopleById.get(todo.linkedPersonId) : undefined}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={setDeleting}
                  now={now}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <TodoForm
        isOpen={form.isOpen}
        onClose={closeForm}
        onSubmit={handleSubmit}
        members={members}
        todo={form.todo}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        onCancel={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title="Delete this task?"
        message="This can't be undone."
        confirmLabel="Delete"
      />
      {isMobile ? (
        <Modal
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          title="Filter tasks"
          mobileSheet
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsFilterSheetOpen(false)}
            >
              Done
            </button>
          }
        >
          <div className="todo-filter-sheet">{filterControls}</div>
        </Modal>
      ) : null}
    </section>
  );
}

interface FilterControlsProps {
  filters: TodoFilters;
  members: TeamMember[];
  onChange: (filters: Partial<TodoFilters>) => void;
}

/** Person options carry ids, never names, as their values. */
function FilterControls({ filters, members, onChange }: FilterControlsProps) {
  const prefix = useId();

  const handle =
    <K extends keyof TodoFilters>(key: K, isValid: (value: string) => boolean) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const { value } = event.target;
      onChange({ [key]: isValid(value) ? value : undefined });
    };

  return (
    <>
      <div className="todo-field">
        <label htmlFor={`${prefix}-status`}>Status</label>
        <select
          id={`${prefix}-status`}
          className="form-input"
          autoComplete="off"
          value={filters.status ?? ''}
          onChange={handle('status', isTodoStatus)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="todo-field">
        <label htmlFor={`${prefix}-priority`}>Priority</label>
        <select
          id={`${prefix}-priority`}
          className="form-input"
          autoComplete="off"
          value={filters.priority ?? ''}
          onChange={handle('priority', isPriority)}
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="todo-field">
        <label htmlFor={`${prefix}-person`}>Person</label>
        <select
          id={`${prefix}-person`}
          className="form-input"
          autoComplete="off"
          value={filters.personId ?? ''}
          onChange={handle('personId', (value) => members.some((member) => member.id === value))}
        >
          <option value="">All team members</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
