import { describe, expect, it, vi } from 'vitest';
import { createActionItem as buildItem, createMember } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import {
  ACTION_ITEM_TITLE_MAX_LENGTH,
  MANAGER_OWNER_ID,
  compareByDueDate,
  createActionItem,
  deleteActionItemsForMember,
  getOverdueItems,
  isItemOverdue,
  listAll,
  listByMember,
  setIncludeInShare,
  updateStatus,
  type ActionItemStorage,
} from './actionItems';
import { NotFoundError, ValidationError } from './errors';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: ActionItemStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const input = (overrides: Partial<Parameters<typeof createActionItem>[0]> = {}) => ({
  memberId: ALEX.id,
  title: 'Update oncall runbook',
  ownerId: MANAGER_OWNER_ID,
  ...overrides,
});

describe('createActionItem', () => {
  it('stores an open item with a trimmed title, the owner name from the team and a flush', async () => {
    const { storage, data, flush } = createStorage();

    const item = await createActionItem(
      input({ title: '  Update oncall runbook  ', ownerId: PRIYA.id, dueDate: '2026-02-03' }),
      storage,
    );

    expect(item).toMatchObject({
      memberId: ALEX.id,
      title: 'Update oncall runbook',
      ownerId: PRIYA.id,
      ownerName: 'Priya Nair',
      dueDate: '2026-02-03',
      status: 'open',
    });
    expect(item.createdAt).toBe(item.updatedAt);
    expect(data.get('actionItems')).toEqual([item]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('names the manager "Me" and leaves the due date off when none is given', async () => {
    const { storage } = createStorage();

    const item = await createActionItem(input({ dueDate: '' }), storage);

    expect(item.ownerName).toBe('Me');
    expect(item).not.toHaveProperty('dueDate');
  });

  it.each([
    ['an empty title', { title: '   ' }],
    ['a title that is too long', { title: 'x'.repeat(ACTION_ITEM_TITLE_MAX_LENGTH + 1) }],
    ['an owner that is not on the team', { ownerId: 'someone-else' }],
    ['a free-form owner name', { ownerId: '<img src=x onerror=alert(1)>' }],
    ['a member that does not exist', { memberId: 'ghost' }],
    ['a due date that is not a calendar day', { dueDate: '2026-02-30' }],
    ['a due date written as free text', { dueDate: 'next friday' }],
    ['a status outside the allowed set', { status: 'blocked' as 'open' }],
  ])('rejects %s without writing', async (_label, overrides) => {
    const { storage, flush } = createStorage();

    await expect(createActionItem(input(overrides), storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(flush).not.toHaveBeenCalled();
  });

  it('accepts a title of exactly the maximum length and a due date in the past', async () => {
    const { storage } = createStorage();

    const item = await createActionItem(
      input({ title: 'x'.repeat(ACTION_ITEM_TITLE_MAX_LENGTH), dueDate: '2001-01-01' }),
      storage,
    );

    expect(item.title).toHaveLength(ACTION_ITEM_TITLE_MAX_LENGTH);
  });

  it('keeps the note it came from', async () => {
    const { storage } = createStorage();

    const item = await createActionItem(input({ noteId: 'note-1' }), storage);

    expect(item.noteId).toBe('note-1');
  });

  it('rolls back and rethrows when the write fails', async () => {
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({}, failure);

    await expect(createActionItem(input(), storage)).rejects.toBe(failure);

    expect(data.get('actionItems')).toEqual([]);
  });
});

describe('updateStatus', () => {
  it('changes the status, refreshes updatedAt and writes immediately', async () => {
    const existing = buildItem({
      memberId: ALEX.id,
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    const { storage, data, flush } = createStorage({ actionItems: [existing] });

    const updated = await updateStatus(existing.id, 'done', storage);

    expect(updated.status).toBe('done');
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(existing.updatedAt));
    expect(data.get('actionItems')).toEqual([updated]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('reopens a done item', async () => {
    const existing = buildItem({ status: 'done' });
    const { storage } = createStorage({ actionItems: [existing] });

    expect((await updateStatus(existing.id, 'open', storage)).status).toBe('open');
  });

  it('rejects an unknown id and an unknown status', async () => {
    const existing = buildItem();
    const { storage } = createStorage({ actionItems: [existing] });

    await expect(updateStatus('missing', 'done', storage)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateStatus(existing.id, 'blocked' as 'open', storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('restores the previous status when the write fails', async () => {
    const existing = buildItem();
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ actionItems: [existing] }, failure);

    await expect(updateStatus(existing.id, 'done', storage)).rejects.toBe(failure);

    expect(data.get('actionItems')).toEqual([existing]);
  });
});

describe('setIncludeInShare', () => {
  it('records the share choice without changing anything else, and flushes', async () => {
    const existing = buildItem();
    const { storage, data, flush } = createStorage({ actionItems: [existing] });

    const updated = await setIncludeInShare(existing.id, false, storage);

    expect(updated).toEqual({ ...existing, includeInShare: false });
    expect(data.get('actionItems')).toEqual([updated]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('rejects an unknown id and a value that is not a boolean', async () => {
    const existing = buildItem();
    const { storage } = createStorage({ actionItems: [existing] });

    await expect(setIncludeInShare('missing', true, storage)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      setIncludeInShare(existing.id, 'no' as unknown as boolean, storage),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('restores the previous choice when the write fails', async () => {
    const existing = buildItem();
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ actionItems: [existing] }, failure);

    await expect(setIncludeInShare(existing.id, false, storage)).rejects.toBe(failure);

    expect(data.get('actionItems')).toEqual([existing]);
  });

  it('keeps the choice when the status changes later', async () => {
    const existing = buildItem({ includeInShare: false });
    const { storage } = createStorage({ actionItems: [existing] });

    expect((await updateStatus(existing.id, 'done', storage)).includeInShare).toBe(false);
  });
});

describe('listing', () => {
  const open = buildItem({ memberId: ALEX.id, title: 'Open', dueDate: '2026-03-01' });
  const done = buildItem({ memberId: ALEX.id, title: 'Done', status: 'done' });
  const other = buildItem({ memberId: PRIYA.id, title: 'Other', dueDate: '2026-02-01' });

  it('lists one member newest-due first and filters by status', () => {
    const { storage } = createStorage({ actionItems: [done, open, other] });

    expect(listByMember(ALEX.id, storage).map((item) => item.title)).toEqual(['Open', 'Done']);
    expect(listByMember(ALEX.id, storage, 'done').map((item) => item.title)).toEqual(['Done']);
  });

  it('lists everyone sorted by due date with undated items last', () => {
    const { storage } = createStorage({ actionItems: [done, open, other] });

    expect(listAll(storage).map((item) => item.title)).toEqual(['Other', 'Open', 'Done']);
    expect(listAll(storage, 'open')).toHaveLength(2);
  });

  it('returns copies and ignores stored values that are not action items', () => {
    const { storage } = createStorage({ actionItems: [open, { id: 1 }, null, 'text'] });

    const [first] = listAll(storage);
    first.title = 'Changed';

    expect(listAll(storage).map((item) => item.title)).toEqual(['Open']);
  });

  it('returns nothing when the private store has no action items', () => {
    expect(listAll(createStorage().storage)).toEqual([]);
  });

  it('orders items with the same due date by when they were created', () => {
    const first = buildItem({ dueDate: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' });
    const second = buildItem({ dueDate: '2026-01-01', createdAt: '2026-01-02T00:00:00.000Z' });

    expect(compareByDueDate(first, second)).toBeLessThan(0);
  });
});

describe('overdue detection', () => {
  const today = new Date(2026, 5, 10, 15, 0);

  it('is overdue only for open items due before today', () => {
    expect(isItemOverdue({ status: 'open', dueDate: '2026-06-09' }, today)).toBe(true);
    expect(isItemOverdue({ status: 'open', dueDate: '2026-06-10' }, today)).toBe(false);
    expect(isItemOverdue({ status: 'open' }, today)).toBe(false);
    expect(isItemOverdue({ status: 'done', dueDate: '2026-06-09' }, today)).toBe(false);
    expect(isItemOverdue({ status: 'cancelled', dueDate: '2026-06-09' }, today)).toBe(false);
  });

  it('getOverdueItems lists the open items that are past due', () => {
    const late = buildItem({ title: 'Late', dueDate: '2026-06-01' });
    const fine = buildItem({ title: 'Fine', dueDate: '2026-06-30' });
    const finished = buildItem({ title: 'Finished', dueDate: '2026-06-01', status: 'done' });
    const { storage } = createStorage({ actionItems: [late, fine, finished] });

    expect(getOverdueItems(storage, today).map((item) => item.title)).toEqual(['Late']);
  });
});

describe('deleteActionItemsForMember', () => {
  it('removes only that member’s items', async () => {
    const mine = buildItem({ memberId: ALEX.id });
    const theirs = buildItem({ memberId: PRIYA.id });
    const { storage, data, flush } = createStorage({ actionItems: [mine, theirs] });

    await deleteActionItemsForMember(ALEX.id, storage);

    expect(data.get('actionItems')).toEqual([theirs]);
    expect(flush).toHaveBeenCalledOnce();
  });
});
