import { describe, expect, it } from 'vitest';
import type { ActionItem } from '../types/ActionItem';
import type { AgendaItem } from '../types/agenda';
import type { Note } from '../types/Note';
import type { TeamMember } from '../types/TeamMember';
import { serializeForSharing } from './serializeForSharing';
import { validateSharePayload } from './validateSharePayload';

const NOW = new Date('2026-03-10T12:00:00.000Z');
const SECRET = 'SENTINEL-SECRET';

const member = {
  id: 'm1',
  name: 'Alice Park',
  role: `Staff Engineer ${SECRET}`,
  level: 'L6',
  startDate: '2019-04-01',
  email: `alice-${SECRET}@example.com`,
  manager: null,
  status: 'active',
  avatarUrl: `https://example.com/${SECRET}.png`,
  customFields: { salary: SECRET },
  createdAt: '2019-04-01T00:00:00Z',
  updatedAt: '2019-04-01T00:00:00Z',
} as TeamMember;

const note = (id: string, visibility: Note['visibility'], extra: Partial<Note> = {}): Note => ({
  id,
  memberId: 'm1',
  content: `note ${id}`,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: `2026-03-01T10:00:00Z ${SECRET}`,
  visibility,
  ...extra,
});

const action = (id: string, extra: Partial<ActionItem> = {}): ActionItem => ({
  id,
  memberId: 'm1',
  noteId: `private-note-${SECRET}`,
  title: `item ${id}`,
  ownerId: 'manager',
  ownerName: 'Me',
  status: 'open',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  ...extra,
});

const topic = (id: string, extra: Partial<AgendaItem> = {}): AgendaItem => ({
  id,
  memberId: 'm1',
  text: `topic ${id}`,
  addedBy: 'engineer',
  createdAt: '2026-03-02T10:00:00Z',
  includeInShare: true,
  ...extra,
});

const build = (
  notes: Note[] = [],
  actions: ActionItem[] = [],
  agenda: AgendaItem[] = [],
  options: { managerName?: string; ttlMs?: number } = {},
) =>
  serializeForSharing(member, notes, actions, agenda, {
    managerName: 'Morgan',
    now: NOW,
    ...options,
  });

describe('serializeForSharing', () => {
  it('includes only notes marked shared, and treats a missing marker as private', () => {
    const payload = build([note('a', 'shared'), note('b', 'private'), note('c', undefined)]);
    expect(payload.sharedNotes.map((n) => n.id)).toEqual(['a']);
  });

  it('copies only the named fields of each note, action item and agenda item', () => {
    const payload = build(
      [note('a', 'shared')],
      [action('x', { dueDate: '2026-03-12' })],
      [topic('t')],
    );
    expect(payload.sharedNotes[0]).toEqual({
      id: 'a',
      text: 'note a',
      createdAt: '2026-03-01T10:00:00Z',
    });
    expect(payload.actionItems[0]).toEqual({
      id: 'a1',
      title: 'item x',
      status: 'open',
      dueDate: '2026-03-12',
      owner: 'manager',
    });
    expect(payload.agendaItems[0]).toEqual({
      id: 't',
      text: 'topic t',
      addedBy: 'engineer',
      createdAt: '2026-03-02T10:00:00Z',
    });
  });

  it('never lets fields it does not name into the payload', () => {
    const payload = build([note('a', 'shared')], [action('x')], [topic('t')]);
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    expect(Object.keys(payload).sort()).toEqual(
      [
        'actionItems',
        'agendaItems',
        'createdAt',
        'engineerAvatar',
        'engineerName',
        'expiresAt',
        'id',
        'managerName',
        'sharedNotes',
        'v',
      ].sort(),
    );
  });

  it('replaces action item record ids with plain row handles so internal ids stay on the device', () => {
    const payload = build(
      [],
      [
        action('record-one-secret', { title: 'First' }),
        action('record-two-secret', { title: 'Second' }),
      ],
    );
    expect(payload.actionItems.map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(JSON.stringify(payload)).not.toContain('record-');
  });

  it('leaves out action items the manager opted out, and shares ones with no choice recorded', () => {
    const payload = build(
      [],
      [
        action('a', { includeInShare: false, title: 'hidden' }),
        action('b', { includeInShare: true, title: 'chosen' }),
        action('c', { title: 'legacy' }),
      ],
    );
    expect(payload.actionItems.map((item) => item.title)).toEqual(['chosen', 'legacy']);
  });

  it('describes the engineer by name and avatar only', () => {
    const payload = build();
    expect(payload.engineerName).toBe('Alice Park');
    expect(payload.engineerAvatar).toEqual({ initials: 'AP', color: expect.stringMatching(/^#/) });
  });

  it('skips notes, action items and agenda items that belong to someone else', () => {
    const payload = build(
      [note('a', 'shared', { memberId: 'm2' })],
      [action('x', { memberId: 'm2' })],
      [topic('t', { memberId: 'm2' })],
    );
    expect(payload.sharedNotes).toEqual([]);
    expect(payload.actionItems).toEqual([]);
    expect(payload.agendaItems).toEqual([]);
  });

  it('maps owners to manager or engineer and drops items owned by other people', () => {
    const payload = build(
      [],
      [
        action('mine', { ownerId: 'manager' }),
        action('theirs', { ownerId: 'm1', ownerName: 'Alice Park' }),
        action('other', { ownerId: 'm9', ownerName: `Bob ${SECRET}` }),
      ],
    );
    expect(payload.actionItems.map((i) => [i.id, i.owner])).toEqual([
      ['a1', 'manager'],
      ['a2', 'engineer'],
    ]);
  });

  it('leaves out cancelled action items and keeps done ones', () => {
    const payload = build(
      [],
      [action('c', { status: 'cancelled' }), action('d', { status: 'done', title: 'kept' })],
    );
    expect(payload.actionItems.map((i) => [i.id, i.title])).toEqual([['a1', 'kept']]);
  });

  it('includes only agenda items that are marked for sharing', () => {
    const payload = build(
      [],
      [],
      [
        topic('a'),
        topic('b', { includeInShare: false }),
        topic('c', { includeInShare: undefined }),
      ],
    );
    expect(payload.agendaItems.map((i) => i.id)).toEqual(['a']);
  });

  it('expires after 24 hours unless told otherwise', () => {
    expect(build().expiresAt).toBe('2026-03-11T12:00:00.000Z');
    expect(build([], [], [], { ttlMs: 60_000 }).expiresAt).toBe('2026-03-10T12:01:00.000Z');
  });

  it('trims the manager name and gives each payload its own id', () => {
    expect(build([], [], [], { managerName: '  Morgan  ' }).managerName).toBe('Morgan');
    expect(build().id).not.toBe(build().id);
  });

  it('produces a payload the validator accepts, even when content is over the limits', () => {
    const long = note('a', 'shared', { content: 'x'.repeat(20_000) });
    const payload = build([long], [action('x', { title: 'y'.repeat(500) })]);
    expect(validateSharePayload(payload)).toEqual(payload);
  });
});
