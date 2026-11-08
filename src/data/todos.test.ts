import { describe, expect, it, vi } from 'vitest';
import { createMember, createTodo as buildTodo } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  TODO_DESCRIPTION_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
  createTodo,
  deleteTodo,
  deleteTodosForMember,
  filterTodos,
  getTodos,
  isTodoOverdue,
  sortTodos,
  toggleTodoStatus,
  updateTodo,
  type TodoStorage,
} from './todos';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: TodoStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

describe('createTodo', () => {
  it('stores a trimmed task in the private envelope with defaults and forces the write', async () => {
    const { storage, data, flush } = createStorage();

    const todo = await createTodo({ title: '  Write   promo packet ' }, storage);

    expect(todo).toMatchObject({ title: 'Write promo packet', priority: 'medium', status: 'todo' });
    expect(todo.description).toBeUndefined();
    expect(data.get('todos')).toEqual([todo]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('takes the linked person name from the team, never from the input', async () => {
    const { storage } = createStorage();

    const todo = await createTodo(
      {
        title: 'Calibration notes',
        description: 'Line one\nLine two',
        dueDate: '2026-03-04',
        priority: 'high',
        linkedPersonId: PRIYA.id,
      },
      storage,
    );

    expect(todo).toMatchObject({
      description: 'Line one\nLine two',
      dueDate: '2026-03-04',
      priority: 'high',
      linkedPersonId: PRIYA.id,
      linkedPersonName: 'Priya Nair',
    });
  });

  it.each([
    ['an empty title', { title: '   ' }],
    ['a title that is too long', { title: 'x'.repeat(TODO_TITLE_MAX_LENGTH + 1) }],
    ['a description that is too long', { title: 'ok', description: 'x'.repeat(5001) }],
    ['a malformed due date', { title: 'ok', dueDate: '2026-02-31' }],
    ['an unknown priority', { title: 'ok', priority: 'urgent' as never }],
    ['an unknown status', { title: 'ok', status: 'blocked' as never }],
    ['a person who is not on the team', { title: 'ok', linkedPersonId: 'nobody' }],
  ])('rejects %s without writing', async (_name, input) => {
    const { storage, flush } = createStorage();

    await expect(createTodo(input, storage)).rejects.toBeInstanceOf(ValidationError);
    expect(flush).not.toHaveBeenCalled();
  });

  it('accepts the longest allowed description', async () => {
    const { storage } = createStorage();

    const todo = await createTodo(
      { title: 'ok', description: 'x'.repeat(TODO_DESCRIPTION_MAX_LENGTH) },
      storage,
    );

    expect(todo.description).toHaveLength(TODO_DESCRIPTION_MAX_LENGTH);
  });

  it('never repeats the title in a validation message', async () => {
    const { storage } = createStorage();
    const title = 'Secret PIP for Alex '.repeat(20);

    const error = await createTodo({ title }, storage).catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as Error).message).not.toContain('Secret');
  });

  it('rolls the in-memory copy back and rethrows when the write fails', async () => {
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ todos: [] }, failure);

    await expect(createTodo({ title: 'Will not stick' }, storage)).rejects.toBe(failure);
    expect(data.get('todos')).toEqual([]);
  });
});

describe('updateTodo', () => {
  it('changes only the given fields and keeps the rest', async () => {
    const existing = buildTodo({ title: 'Old', priority: 'low', dueDate: '2026-01-01' });
    const { storage } = createStorage({ todos: [existing] });

    const updated = await updateTodo(existing.id, { title: 'New', status: 'in_progress' }, storage);

    expect(updated).toMatchObject({
      id: existing.id,
      title: 'New',
      status: 'in_progress',
      priority: 'low',
      dueDate: '2026-01-01',
      createdAt: existing.createdAt,
    });
  });

  it('clears optional fields that are given as empty', async () => {
    const existing = buildTodo({
      description: 'Notes',
      dueDate: '2026-01-01',
      linkedPersonId: ALEX.id,
      linkedPersonName: 'Alex Chen',
    });
    const { storage } = createStorage({ todos: [existing] });

    const updated = await updateTodo(
      existing.id,
      { description: '', dueDate: '', linkedPersonId: '' },
      storage,
    );

    expect(updated).not.toHaveProperty('description');
    expect(updated).not.toHaveProperty('dueDate');
    expect(updated).not.toHaveProperty('linkedPersonId');
    expect(updated).not.toHaveProperty('linkedPersonName');
  });

  it('keeps the link when the person is not part of the update', async () => {
    const existing = buildTodo({ linkedPersonId: ALEX.id, linkedPersonName: 'Alex Chen' });
    const { storage } = createStorage({ todos: [existing] });

    const updated = await updateTodo(existing.id, { priority: 'high' }, storage);

    expect(updated.linkedPersonId).toBe(ALEX.id);
  });

  it('rejects invalid updates and unknown ids', async () => {
    const existing = buildTodo();
    const { storage, data } = createStorage({ todos: [existing] });

    await expect(updateTodo(existing.id, { title: '' }, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(updateTodo('missing', { title: 'x' }, storage)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(data.get('todos')).toEqual([existing]);
  });
});

describe('toggleTodoStatus', () => {
  it.each([
    ['todo', 'done'],
    ['in_progress', 'done'],
    ['done', 'todo'],
  ] as const)('moves %s to %s', async (from, to) => {
    const existing = buildTodo({ status: from });
    const { storage } = createStorage({ todos: [existing] });

    const toggled = await toggleTodoStatus(existing.id, storage);

    expect(toggled.status).toBe(to);
  });

  it('rejects an unknown task', async () => {
    const { storage } = createStorage();

    await expect(toggleTodoStatus('missing', storage)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('deleteTodo and deleteTodosForMember', () => {
  it('removes just the one task', async () => {
    const keep = buildTodo();
    const drop = buildTodo();
    const { storage, data } = createStorage({ todos: [keep, drop] });

    await deleteTodo(drop.id, storage);

    expect(data.get('todos')).toEqual([keep]);
    await expect(deleteTodo(drop.id, storage)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('keeps the task and rethrows when the write fails', async () => {
    const existing = buildTodo();
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ todos: [existing] }, failure);

    await expect(deleteTodo(existing.id, storage)).rejects.toBe(failure);
    expect(data.get('todos')).toEqual([existing]);
  });

  it('removes every task linked to a member and nothing else', async () => {
    const mine = buildTodo({ linkedPersonId: ALEX.id });
    const theirs = buildTodo({ linkedPersonId: PRIYA.id });
    const unlinked = buildTodo();
    const { storage, data } = createStorage({ todos: [mine, theirs, unlinked] });

    await deleteTodosForMember(ALEX.id, storage);

    expect(data.get('todos')).toEqual([theirs, unlinked]);
  });
});

describe('getTodos', () => {
  it('ignores malformed stored records', () => {
    const valid = buildTodo();
    const { storage } = createStorage({
      todos: [valid, { id: 1 }, null, { ...valid, priority: 'x' }],
    });

    expect(getTodos(storage)).toEqual([valid]);
  });

  it('returns nothing when no tasks are stored', () => {
    expect(getTodos(createStorage().storage)).toEqual([]);
  });
});

describe('filterTodos and sortTodos', () => {
  const soon = buildTodo({
    title: 'soon',
    dueDate: '2026-01-01',
    priority: 'low',
    createdAt: '2026-01-01T00:00:00Z',
  });
  const later = buildTodo({
    title: 'later',
    dueDate: '2026-02-01',
    priority: 'high',
    status: 'done',
    linkedPersonId: ALEX.id,
    createdAt: '2026-01-03T00:00:00Z',
  });
  const undated = buildTodo({
    title: 'undated',
    priority: 'medium',
    createdAt: '2026-01-02T00:00:00Z',
  });
  const all = [later, undated, soon];
  const titles = (todos: typeof all) => todos.map((todo) => todo.title);

  it('combines filters', () => {
    expect(titles(filterTodos(all, { status: 'done' }))).toEqual(['later']);
    expect(titles(filterTodos(all, { priority: 'low' }))).toEqual(['soon']);
    expect(titles(filterTodos(all, { personId: ALEX.id, priority: 'low' }))).toEqual([]);
    expect(filterTodos(all, {})).toHaveLength(3);
  });

  it('sorts by due date, soonest first, with undated tasks last', () => {
    expect(titles(sortTodos(all, 'dueDate'))).toEqual(['soon', 'later', 'undated']);
  });

  it('sorts by priority from high to low', () => {
    expect(titles(sortTodos(all, 'priority'))).toEqual(['later', 'undated', 'soon']);
  });

  it('sorts by creation date, newest first', () => {
    expect(titles(sortTodos(all, 'createdAt'))).toEqual(['later', 'undated', 'soon']);
  });

  it('breaks ties by priority, then by creation order', () => {
    const a = buildTodo({ title: 'a', priority: 'low', createdAt: '2026-01-01T00:00:00Z' });
    const b = buildTodo({ title: 'b', priority: 'high', createdAt: '2026-01-02T00:00:00Z' });
    const c = buildTodo({ title: 'c', priority: 'high', createdAt: '2026-01-01T00:00:00Z' });

    expect(titles(sortTodos([a, b, c], 'dueDate'))).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the list it sorts', () => {
    const input = [...all];
    sortTodos(input, 'priority');
    expect(input).toEqual(all);
  });
});

describe('isTodoOverdue', () => {
  const now = new Date(2026, 5, 15, 12);

  it('is overdue only when unfinished and due before today', () => {
    expect(isTodoOverdue({ status: 'todo', dueDate: '2026-06-14' }, now)).toBe(true);
    expect(isTodoOverdue({ status: 'in_progress', dueDate: '2026-06-14' }, now)).toBe(true);
    expect(isTodoOverdue({ status: 'todo', dueDate: '2026-06-15' }, now)).toBe(false);
    expect(isTodoOverdue({ status: 'done', dueDate: '2026-06-14' }, now)).toBe(false);
    expect(isTodoOverdue({ status: 'todo' }, now)).toBe(false);
  });
});
