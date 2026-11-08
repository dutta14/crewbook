import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { Priority, Todo, TodoFilters, TodoSortField, TodoStatus } from '../types/todo';
import { isOverdue as isPastDay, parseIsoDate } from '../utils/scheduleCalculator';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** Titles and descriptions can name people and performance, so tasks live in the private envelope. */
const STORAGE_KEY = 'todos';

/** Needs `get` as well because linked people are validated against the team list. */
export type TodoStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const TODO_TITLE_MAX_LENGTH = 200;
export const TODO_DESCRIPTION_MAX_LENGTH = 5000;

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high'];
export const TODO_STATUSES: readonly TodoStatus[] = ['todo', 'in_progress', 'done'];
export const TODO_SORT_FIELDS: readonly TodoSortField[] = ['dueDate', 'priority', 'createdAt'];

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export interface TodoInput {
  title: string;
  description?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  priority?: Priority;
  status?: TodoStatus;
  linkedPersonId?: string;
}

/** A key that is present with an empty value clears that optional field. */
export type TodoUpdate = Partial<TodoInput>;

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

export function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === 'string' && (TODO_STATUSES as readonly string[]).includes(value);
}

export function isTodoSortField(value: unknown): value is TodoSortField {
  return typeof value === 'string' && (TODO_SORT_FIELDS as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isOptionalString = (value: unknown) => value === undefined || isString(value);

function isTodo(value: unknown): value is Todo {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.title) &&
    isOptionalString(item.description) &&
    isOptionalString(item.dueDate) &&
    isPriority(item.priority) &&
    isTodoStatus(item.status) &&
    isOptionalString(item.linkedPersonId) &&
    isOptionalString(item.linkedPersonName) &&
    isString(item.createdAt)
  );
}

function readTodos(storage: TodoStorage): Todo[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isTodo) : [];
}

/** Throws a ValidationError that never repeats the title. */
function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Title must be text');
  const title = value.replace(/\s+/g, ' ').trim();
  if (title.length === 0) throw new ValidationError('Title is required');
  if (title.length > TODO_TITLE_MAX_LENGTH) {
    throw new ValidationError(`Title must be ${TODO_TITLE_MAX_LENGTH} characters or fewer`);
  }
  return title;
}

/** Keeps line breaks, since a description is prose. */
function cleanDescription(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ValidationError('Description must be text');
  const description = value.trim();
  if (description.length > TODO_DESCRIPTION_MAX_LENGTH) {
    throw new ValidationError(
      `Description must be ${TODO_DESCRIPTION_MAX_LENGTH} characters or fewer`,
    );
  }
  return description || undefined;
}

function cleanDueDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || parseIsoDate(value) === null) {
    throw new ValidationError('Due date is not a valid date');
  }
  return value;
}

function cleanPriority(value: unknown): Priority {
  if (!isPriority(value)) throw new ValidationError('Priority is not valid');
  return value;
}

function cleanStatus(value: unknown): TodoStatus {
  if (!isTodoStatus(value)) throw new ValidationError('Status is not valid');
  return value;
}

/** The person must be on the team; the name always comes from the team. */
function resolvePerson(personId: unknown, storage: TodoStorage) {
  if (personId === undefined || personId === null || personId === '') return {};
  const person = typeof personId === 'string' ? getMember(personId, storage) : null;
  if (!person) throw new ValidationError('Linked person must be on your team');
  return { linkedPersonId: person.id, linkedPersonName: person.name };
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(storage: TodoStorage, previous: Todo[], next: Todo[]): Promise<void> {
  storage.setPrivate(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

export function createTodo(input: TodoInput, storage: TodoStorage): Promise<Todo> {
  return enqueue(async () => {
    const title = cleanTitle(input.title);
    const description = cleanDescription(input.description);
    const dueDate = cleanDueDate(input.dueDate);
    const priority = cleanPriority(input.priority ?? 'medium');
    const status = cleanStatus(input.status ?? 'todo');
    const person = resolvePerson(input.linkedPersonId, storage);
    const todo: Todo = {
      id: crypto.randomUUID(),
      title,
      ...(description ? { description } : {}),
      ...(dueDate ? { dueDate } : {}),
      priority,
      status,
      ...person,
      createdAt: new Date().toISOString(),
    };
    const previous = readTodos(storage);
    await commit(storage, previous, [...previous, todo]);
    return { ...todo };
  });
}

/** Reads the current task inside the write queue, so back-to-back updates never see stale data. */
function update(id: string, storage: TodoStorage, build: (existing: Todo) => Todo): Promise<Todo> {
  return enqueue(async () => {
    const previous = readTodos(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated = build(existing);
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

export function updateTodo(id: string, updates: TodoUpdate, storage: TodoStorage): Promise<Todo> {
  return update(id, storage, (existing) => {
    const description =
      'description' in updates ? cleanDescription(updates.description) : existing.description;
    const dueDate = 'dueDate' in updates ? cleanDueDate(updates.dueDate) : existing.dueDate;
    const person =
      'linkedPersonId' in updates
        ? resolvePerson(updates.linkedPersonId, storage)
        : existing.linkedPersonId
          ? { linkedPersonId: existing.linkedPersonId, linkedPersonName: existing.linkedPersonName }
          : {};
    return {
      id: existing.id,
      title: 'title' in updates ? cleanTitle(updates.title) : existing.title,
      ...(description ? { description } : {}),
      ...(dueDate ? { dueDate } : {}),
      priority: 'priority' in updates ? cleanPriority(updates.priority) : existing.priority,
      status: 'status' in updates ? cleanStatus(updates.status) : existing.status,
      ...person,
      createdAt: existing.createdAt,
    };
  });
}

/** Done goes back to to do; anything unfinished becomes done. */
export function toggleTodoStatus(id: string, storage: TodoStorage): Promise<Todo> {
  return update(id, storage, (existing) => ({
    ...existing,
    status: existing.status === 'done' ? 'todo' : 'done',
  }));
}

export function deleteTodo(id: string, storage: TodoStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readTodos(storage);
    if (!previous.some((item) => item.id === id)) throw new NotFoundError(id);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.id !== id),
    );
  });
}

/** Every task in the order it was created. */
export function getTodos(storage: TodoStorage): Todo[] {
  return readTodos(storage).map((item) => ({ ...item }));
}

export function filterTodos(todos: Todo[], filters: TodoFilters): Todo[] {
  return todos.filter(
    (todo) =>
      (!filters.status || todo.status === filters.status) &&
      (!filters.priority || todo.priority === filters.priority) &&
      (!filters.personId || todo.linkedPersonId === filters.personId),
  );
}

const byCreated = (a: Todo, b: Todo) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
const byPriority = (a: Todo, b: Todo) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

/** Soonest first; tasks without a due date come last. */
function byDueDate(a: Todo, b: Todo): number {
  if (a.dueDate && b.dueDate) return a.dueDate === b.dueDate ? 0 : a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueDate || b.dueDate) return a.dueDate ? -1 : 1;
  return 0;
}

const COMPARATORS: Record<TodoSortField, (a: Todo, b: Todo) => number> = {
  dueDate: (a, b) => byDueDate(a, b) || byPriority(a, b) || byCreated(a, b),
  priority: (a, b) => byPriority(a, b) || byDueDate(a, b) || byCreated(a, b),
  // Newest first. The sort is stable, so tasks made in the same millisecond keep their order.
  createdAt: (a, b) => byCreated(b, a),
};

export function sortTodos(todos: Todo[], field: TodoSortField): Todo[] {
  return [...todos].sort(COMPARATORS[field]);
}

/** Whether the task is unfinished and its due day is before today. Done tasks are never overdue. */
export function isTodoOverdue(
  todo: Pick<Todo, 'status' | 'dueDate'>,
  now: Date = new Date(),
): boolean {
  return todo.status !== 'done' && todo.dueDate !== undefined && isPastDay(todo.dueDate, now);
}

/** Removes every task linked to a member, for when they leave the team. */
export function deleteTodosForMember(memberId: string, storage: TodoStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readTodos(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.linkedPersonId !== memberId),
    );
  });
}
