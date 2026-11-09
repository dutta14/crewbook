import { describe, expect, it, vi } from 'vitest';
import { StorageWriteError } from '../utils/encryptedStorage';
import {
  AGENDA_MAX_ITEMS,
  AGENDA_TEXT_MAX_LENGTH,
  addAgendaItem,
  archiveAgendaForMember,
  deleteAgendaForMember,
  deleteAgendaItem,
  listAgendaForMember,
  setAgendaDiscussed,
  setAgendaIncludeInShare,
  type AgendaStorage,
} from './agenda';
import { NotFoundError, ValidationError } from './errors';

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'g1',
  memberId: 'alex',
  text: 'Promo timeline',
  addedBy: 'engineer',
  createdAt: '2026-01-05T09:00:00Z',
  ...overrides,
});

const storageWith = (value: unknown) => ({ getPrivate: <T>() => value as T | null });

describe('listAgendaForMember', () => {
  it('is empty when nothing has been stored', () => {
    expect(listAgendaForMember('alex', storageWith(null))).toEqual([]);
    expect(listAgendaForMember('alex', storageWith('junk'))).toEqual([]);
  });

  it('returns only the items for that person', () => {
    const stored = [item(), item({ id: 'g2', memberId: 'priya' })];

    expect(listAgendaForMember('alex', storageWith(stored)).map((entry) => entry.id)).toEqual([
      'g1',
    ]);
  });

  it('skips entries that are malformed', () => {
    const stored = [
      item({ addedBy: 'someone' }),
      item({ id: 3 }),
      item({ includeInShare: 'yes' }),
      null,
      item({ id: 'ok', includeInShare: true }),
    ];

    expect(listAgendaForMember('alex', storageWith(stored)).map((entry) => entry.id)).toEqual([
      'ok',
    ]);
  });

  it('leaves archived items out and lists the rest oldest first', () => {
    const stored = [
      item({ id: 'new', createdAt: '2026-01-06T09:00:00Z' }),
      item({ id: 'gone', archived: true, archivedAt: '2026-01-07T09:00:00Z' }),
      item({ id: 'old', createdAt: '2026-01-04T09:00:00Z' }),
    ];

    expect(listAgendaForMember('alex', storageWith(stored)).map((entry) => entry.id)).toEqual([
      'old',
      'new',
    ]);
  });
});

function createStorage(initial: unknown[] = [], failure: StorageWriteError | null = null) {
  const data = new Map<string, unknown>([['agendaItems', initial]]);
  const flush = vi.fn(async () => failure);
  const storage: AgendaStorage = {
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

describe('addAgendaItem', () => {
  it('stores the item, shared by default, and returns it', async () => {
    const { storage } = createStorage();

    const added = await addAgendaItem(
      { memberId: 'alex', text: '  Promo timeline  ', addedBy: 'engineer' },
      storage,
    );

    expect(added).toMatchObject({
      text: 'Promo timeline',
      addedBy: 'engineer',
      includeInShare: true,
    });
    expect(listAgendaForMember('alex', storage)).toHaveLength(1);
  });

  it('removes tags and control characters but keeps plain comparisons', async () => {
    const { storage } = createStorage();

    const added = await addAgendaItem(
      { memberId: 'alex', text: 'Is 2 < 3? <script>x</script>\u0007ok', addedBy: 'manager' },
      storage,
    );

    expect(added.text).toBe('Is 2 < 3? xok');
  });

  it.each([
    ['empty text', '   ', 'alex', 'manager'],
    ['text that is too long', 'x'.repeat(AGENDA_TEXT_MAX_LENGTH + 1), 'alex', 'manager'],
    ['no member', 'Topic', '', 'manager'],
    ['an unknown author', 'Topic', 'alex', 'someone'],
  ])('rejects %s', async (_label, text, memberId, addedBy) => {
    const { storage, flush } = createStorage();

    await expect(
      addAgendaItem({ memberId, text, addedBy: addedBy as 'manager' }, storage),
    ).rejects.toThrow(ValidationError);
    expect(flush).not.toHaveBeenCalled();
  });

  it('refuses a 51st active item but not for another person', async () => {
    const { storage } = createStorage(
      Array.from({ length: AGENDA_MAX_ITEMS }, (_, index) => item({ id: `g${index}` })),
    );

    await expect(
      addAgendaItem({ memberId: 'alex', text: 'One more', addedBy: 'manager' }, storage),
    ).rejects.toThrow(ValidationError);
    await expect(
      addAgendaItem({ memberId: 'priya', text: 'One more', addedBy: 'manager' }, storage),
    ).resolves.toMatchObject({ memberId: 'priya' });
  });

  it('puts the list back when the write fails', async () => {
    const { storage, data } = createStorage([item()], new StorageWriteError(false, true));

    await expect(
      addAgendaItem({ memberId: 'alex', text: 'Topic', addedBy: 'manager' }, storage),
    ).rejects.toBeInstanceOf(StorageWriteError);
    expect(data.get('agendaItems')).toEqual([item()]);
  });
});

describe('changing and removing items', () => {
  it('ticks an item as discussed and back', async () => {
    const { storage } = createStorage([item()]);

    await setAgendaDiscussed('g1', true, storage);
    expect(listAgendaForMember('alex', storage)[0]?.discussed).toBe(true);
    await setAgendaDiscussed('g1', false, storage);
    expect(listAgendaForMember('alex', storage)[0]?.discussed).toBe(false);
  });

  it('opts an item out of sharing', async () => {
    const { storage } = createStorage([item({ includeInShare: true })]);

    await setAgendaIncludeInShare('g1', false, storage);

    expect(listAgendaForMember('alex', storage)[0]?.includeInShare).toBe(false);
  });

  it('rejects changes and removals for items that do not exist or are archived', async () => {
    const { storage } = createStorage([item({ archived: true })]);

    await expect(setAgendaDiscussed('g1', true, storage)).rejects.toThrow(NotFoundError);
    await expect(deleteAgendaItem('g1', storage)).rejects.toThrow(NotFoundError);
    await expect(deleteAgendaItem('missing', storage)).rejects.toThrow(NotFoundError);
  });

  it('removes one item and leaves the others', async () => {
    const { storage } = createStorage([item(), item({ id: 'g2' })]);

    await deleteAgendaItem('g1', storage);

    expect(listAgendaForMember('alex', storage).map((entry) => entry.id)).toEqual(['g2']);
  });
});

describe('archiveAgendaForMember', () => {
  it('archives that person’s items with a timestamp and keeps them in storage', async () => {
    const { storage, data } = createStorage([item(), item({ id: 'p1', memberId: 'priya' })]);

    await archiveAgendaForMember('alex', storage, new Date('2026-02-01T10:00:00Z'));

    expect(listAgendaForMember('alex', storage)).toEqual([]);
    expect(listAgendaForMember('priya', storage)).toHaveLength(1);
    expect(data.get('agendaItems')).toContainEqual(
      expect.objectContaining({ id: 'g1', archived: true, archivedAt: '2026-02-01T10:00:00.000Z' }),
    );
  });

  it('writes nothing when there is nothing to archive', async () => {
    const { storage, flush } = createStorage([item({ memberId: 'priya' })]);

    await archiveAgendaForMember('alex', storage);

    expect(flush).not.toHaveBeenCalled();
  });
});

describe('deleteAgendaForMember', () => {
  it('removes every item for that person, archived or not', async () => {
    const { storage, data } = createStorage([
      item(),
      item({ id: 'g2', archived: true }),
      item({ id: 'p1', memberId: 'priya' }),
    ]);

    await deleteAgendaForMember('alex', storage);

    expect(data.get('agendaItems')).toEqual([item({ id: 'p1', memberId: 'priya' })]);
  });

  it('writes nothing for a person with no items', async () => {
    const { storage, flush } = createStorage([item()]);

    await deleteAgendaForMember('nobody', storage);

    expect(flush).not.toHaveBeenCalled();
  });
});
