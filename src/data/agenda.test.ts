import { describe, expect, it } from 'vitest';
import { listAgendaForMember } from './agenda';

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
});
