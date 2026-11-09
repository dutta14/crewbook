import { describe, expect, it } from 'vitest';
import { makePayload } from '../test-utils/sharePayload';
import { SHARE_LIMITS, validateSharePayload } from './validateSharePayload';

const mutate = (patch: Record<string, unknown>) => ({ ...makePayload(), ...patch });

describe('validateSharePayload', () => {
  it('accepts a well-formed payload and returns a clean copy', () => {
    const input = makePayload({
      agendaItems: [
        { id: 'g1', text: 'Promo', addedBy: 'manager', createdAt: '2026-01-01T00:00:00Z' },
      ],
    });
    const result = validateSharePayload(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['an unknown top-level key', mutate({ extra: 1 })],
    ['another version', mutate({ v: 2 })],
    ['a blank manager name', mutate({ managerName: '  ' })],
    [
      'an overlong engineer name',
      mutate({ engineerName: 'x'.repeat(SHARE_LIMITS.nameLength + 1) }),
    ],
    ['a non-string id', mutate({ id: 5 })],
    ['an id with odd characters', mutate({ id: '<b>' })],
    ['a bad colour', mutate({ engineerAvatar: { initials: 'AP', color: 'red' } })],
    [
      'extra avatar keys',
      mutate({ engineerAvatar: { initials: 'AP', color: '#112233', url: 'x' } }),
    ],
    ['too many initials', mutate({ engineerAvatar: { initials: 'ABCDE', color: '#112233' } })],
    ['a bad expiry', mutate({ expiresAt: 'soon' })],
    [
      'a lifetime that is not a preset',
      mutate({ expiresAt: '2026-01-09T10:00:00.000Z', createdAt: '2026-01-08T11:00:00.000Z' }),
    ],
    ['an expiry before the creation time', mutate({ createdAt: '2026-01-10T10:00:00.000Z' })],
    ['notes that are not a list', mutate({ sharedNotes: {} })],
    [
      'too many notes',
      mutate({
        sharedNotes: Array.from({ length: SHARE_LIMITS.maxNotes + 1 }, (_, i) => ({
          id: `n${i}`,
          text: 't',
          createdAt: '2026-01-01T00:00:00Z',
        })),
      }),
    ],
    [
      'a note with extra keys',
      mutate({ sharedNotes: [{ id: 'n', text: 't', createdAt: '2026-01-01T00:00:00Z', mood: 3 }] }),
    ],
    [
      'an overlong note',
      mutate({
        sharedNotes: [
          {
            id: 'n',
            text: 'x'.repeat(SHARE_LIMITS.noteLength + 1),
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    ],
    [
      'an action with a bad status',
      mutate({ actionItems: [{ id: 'a', title: 't', status: 'cancelled', owner: 'manager' }] }),
    ],
    [
      'an action with an unknown owner',
      mutate({ actionItems: [{ id: 'a', title: 't', status: 'open', owner: 'Bob' }] }),
    ],
    [
      'an action with an impossible date',
      mutate({
        actionItems: [
          { id: 'a', title: 't', status: 'open', owner: 'manager', dueDate: '2026-02-31' },
        ],
      }),
    ],
    [
      'an agenda item with a bad author',
      mutate({
        agendaItems: [{ id: 'g', text: 't', addedBy: 'x', createdAt: '2026-01-01T00:00:00Z' }],
      }),
    ],
  ])('rejects %s', (_name, input) => {
    expect(validateSharePayload(input)).toBeNull();
  });
});
