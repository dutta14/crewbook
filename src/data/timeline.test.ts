import { describe, expect, it } from 'vitest';
import { createMember } from '../test-utils/factories';
import { buildTimeline, diffMember } from './timeline';

const AT = '2025-02-01T00:00:00.000Z';

describe('diffMember', () => {
  it('records a status change with both values', () => {
    const before = createMember({ status: 'active' });

    const changes = diffMember(before, { ...before, status: 'departing' }, AT);

    expect(changes).toEqual([
      expect.objectContaining({ field: 'status', from: 'active', to: 'departing', date: AT }),
    ]);
  });

  it('records new values for plain fields but never for manager or custom fields', () => {
    const before = createMember({ manager: null, customFields: {} });
    const after = {
      ...before,
      role: 'Staff Engineer',
      manager: 'someone',
      customFields: { Comp: '180K' },
    };

    const changes = diffMember(before, after, AT);

    expect(changes.map(({ field, from, to }) => ({ field, from, to }))).toEqual([
      { field: 'role', from: undefined, to: 'Staff Engineer' },
      { field: 'manager', from: undefined, to: undefined },
      { field: 'customFields', from: undefined, to: undefined },
    ]);
  });

  it('treats a date-time and the same calendar day as unchanged', () => {
    const before = createMember({ startDate: '2023-03-13T12:00:00' });

    expect(diffMember(before, { ...before, startDate: '2023-03-13' }, AT)).toEqual([]);
  });

  it('returns nothing when nothing changed', () => {
    const member = createMember({ customFields: { a: 'b' } });

    expect(diffMember(member, structuredClone(member), AT)).toEqual([]);
  });
});

describe('buildTimeline', () => {
  it('starts with an Added to team entry from createdAt', () => {
    const member = createMember({ createdAt: '2024-01-01T00:00:00.000Z' });

    expect(buildTimeline(member)).toEqual([
      { id: 'created', date: '2024-01-01T00:00:00.000Z', description: 'Added to team' },
    ]);
  });

  it('describes recorded edits in chronological order', () => {
    const member = createMember({
      createdAt: '2024-01-01T00:00:00.000Z',
      history: [
        { id: 'b', date: '2024-03-01T00:00:00.000Z', field: 'level', to: 'L5' },
        {
          id: 'a',
          date: '2024-02-01T00:00:00.000Z',
          field: 'status',
          from: 'active',
          to: 'on_leave',
        },
        { id: 'c', date: '2024-04-01T00:00:00.000Z', field: 'customFields' },
      ],
    });

    expect(buildTimeline(member).map((entry) => entry.description)).toEqual([
      'Added to team',
      'Status changed from Active to On Leave',
      'Level changed to L5',
      'Custom fields updated',
    ]);
  });

  it('skips entries with an invalid date or an unknown field, and falls back for a bad status', () => {
    const member = createMember({
      createdAt: 'garbage',
      history: [
        { id: 'x', date: 'nope', field: 'role', to: 'A' },
        { id: 'y', date: '2024-02-01T00:00:00.000Z', field: 'constructor' as never },
        {
          id: 'z',
          date: '2024-02-02T00:00:00.000Z',
          field: 'status',
          from: 'toString',
          to: 'active',
        },
      ],
    });

    expect(buildTimeline(member).map((entry) => entry.description)).toEqual([
      'Status changed from Unknown to Active',
    ]);
  });
});
