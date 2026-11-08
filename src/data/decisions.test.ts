import { describe, expect, it, vi } from 'vitest';
import {
  createDecision as buildDecision,
  createFollowUp as buildFollowUp,
  createMember,
} from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  DECISION_CONTEXT_MAX_LENGTH,
  DECISION_TITLE_MAX_LENGTH,
  createDecision,
  createFollowUp,
  deleteDecisionsForMember,
  getDecisions,
  getFollowUps,
  isDecisionFollowUpFilter,
  isFollowUpOverdue,
  linkToMeeting,
  toggleFollowUpStatus,
  type DecisionStorage,
} from './decisions';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: DecisionStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const decisionInput = (overrides: Partial<Parameters<typeof createDecision>[0]> = {}) => ({
  engineerId: ALEX.id,
  title: 'Adopt new CI pipeline',
  ...overrides,
});

const followUpInput = (overrides: Partial<Parameters<typeof createFollowUp>[0]> = {}) => ({
  engineerId: ALEX.id,
  title: 'Share the plan',
  ownerId: 'manager',
  ...overrides,
});

describe('createDecision', () => {
  it('stores a trimmed decision, dated today and unlinked, and flushes', async () => {
    const { storage, data, flush } = createStorage();

    const decision = await createDecision(
      decisionInput({ title: '  Adopt   new CI  ', context: '  Faster builds ' }),
      storage,
    );

    expect(decision).toMatchObject({
      engineerId: ALEX.id,
      title: 'Adopt new CI',
      context: 'Faster builds',
      linkedMeetingId: '',
      linkedMeetingDate: '',
    });
    expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.get('decisions')).toEqual([decision]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it.each([
    ['an empty title', { title: '   ' }],
    ['a title that is too long', { title: 'x'.repeat(DECISION_TITLE_MAX_LENGTH + 1) }],
    ['context that is too long', { context: 'x'.repeat(DECISION_CONTEXT_MAX_LENGTH + 1) }],
    ['an unknown person', { engineerId: 'nobody' }],
    ['an invalid date', { date: '2025-13-45' }],
  ])('rejects %s without writing', async (_label, overrides) => {
    const { storage, data, flush } = createStorage();

    await expect(createDecision(decisionInput(overrides), storage)).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(data.has('decisions')).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('never repeats the title in a validation error', async () => {
    const { storage } = createStorage();
    const title = 'x'.repeat(DECISION_TITLE_MAX_LENGTH + 1);

    await expect(createDecision(decisionInput({ title }), storage)).rejects.toThrow(
      expect.not.objectContaining({ message: expect.stringContaining(title) }),
    );
  });

  it('rolls back when the write fails', async () => {
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({}, failure);

    await expect(createDecision(decisionInput(), storage)).rejects.toBe(failure);

    expect(data.get('decisions')).toEqual([]);
  });
});

describe('createFollowUp', () => {
  it('stores a pending follow-up with the owner name taken from the team', async () => {
    const { storage, data } = createStorage();

    const followUp = await createFollowUp(
      followUpInput({ ownerId: PRIYA.id, dueDate: '2030-01-15' }),
      storage,
    );

    expect(followUp).toMatchObject({
      engineerId: ALEX.id,
      ownerId: PRIYA.id,
      ownerName: 'Priya Nair',
      dueDate: '2030-01-15',
      status: 'pending',
    });
    expect(data.get('followUps')).toEqual([followUp]);
  });

  it('allows the manager as owner and leaves the due date out when there is none', async () => {
    const { storage } = createStorage();

    const followUp = await createFollowUp(followUpInput({ dueDate: '' }), storage);

    expect(followUp.ownerName).toBe('Me');
    expect(followUp).not.toHaveProperty('dueDate');
  });

  it.each([
    ['an unknown owner', { ownerId: 'nobody' }],
    ['an invalid due date', { dueDate: 'soon' }],
    ['an empty title', { title: '' }],
    ['an unknown person', { engineerId: 'nobody' }],
  ])('rejects %s', async (_label, overrides) => {
    const { storage, flush } = createStorage();

    await expect(createFollowUp(followUpInput(overrides), storage)).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(flush).not.toHaveBeenCalled();
  });
});

describe('getDecisions and getFollowUps', () => {
  it('returns the newest first and can be limited to one person', () => {
    const old = buildDecision({
      engineerId: ALEX.id,
      title: 'Old',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const recent = buildDecision({
      engineerId: ALEX.id,
      title: 'New',
      createdAt: '2025-02-01T00:00:00.000Z',
    });
    const other = buildDecision({ engineerId: PRIYA.id, title: 'Other' });
    const { storage } = createStorage({ decisions: [old, recent, other] });

    expect(getDecisions(storage, ALEX.id).map((d) => d.title)).toEqual(['New', 'Old']);
    expect(getDecisions(storage)).toHaveLength(3);
  });

  it('ignores stored entries that are not records', () => {
    const good = buildFollowUp({ engineerId: ALEX.id });
    const { storage } = createStorage({ followUps: [good, { id: 1 }, null, 'x'] });

    expect(getFollowUps(storage)).toEqual([good]);
  });

  it('returns nothing when the stored value is not a list', () => {
    const { storage } = createStorage({ decisions: 'oops' });

    expect(getDecisions(storage)).toEqual([]);
  });
});

describe('toggleFollowUpStatus', () => {
  it('flips pending to done and back', async () => {
    const item = buildFollowUp({ engineerId: ALEX.id });
    const { storage } = createStorage({ followUps: [item] });

    expect((await toggleFollowUpStatus(item.id, storage)).status).toBe('done');
    expect(getFollowUps(storage)[0].status).toBe('done');
    expect((await toggleFollowUpStatus(item.id, storage)).status).toBe('pending');
  });

  it('throws NotFoundError for an unknown id', async () => {
    const { storage } = createStorage();

    await expect(toggleFollowUpStatus('missing', storage)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('restores the old status when the write fails', async () => {
    const item = buildFollowUp({ engineerId: ALEX.id });
    const failure = new StorageWriteError(false, true);
    const { storage } = createStorage({ followUps: [item] }, failure);

    await expect(toggleFollowUpStatus(item.id, storage)).rejects.toBe(failure);

    expect(getFollowUps(storage)[0].status).toBe('pending');
  });
});

describe('linkToMeeting', () => {
  const meeting = { id: 'note-1', createdAt: '2025-01-15T12:00:00.000Z' };

  it('links one person’s unlinked records and leaves the rest alone', async () => {
    const mine = buildDecision({ engineerId: ALEX.id, linkedMeetingId: '', linkedMeetingDate: '' });
    const mineFollowUp = buildFollowUp({
      engineerId: ALEX.id,
      linkedMeetingId: '',
      linkedMeetingDate: '',
    });
    const theirs = buildDecision({
      engineerId: PRIYA.id,
      linkedMeetingId: '',
      linkedMeetingDate: '',
    });
    const linked = buildDecision({
      engineerId: ALEX.id,
      linkedMeetingId: 'older',
      linkedMeetingDate: '2024-12-01',
    });
    const { storage, flush } = createStorage({
      decisions: [mine, theirs, linked],
      followUps: [mineFollowUp],
    });

    const count = await linkToMeeting(ALEX.id, meeting, storage);

    expect(count).toBe(2);
    expect(getDecisions(storage, ALEX.id).find((d) => d.id === mine.id)).toMatchObject({
      linkedMeetingId: 'note-1',
      linkedMeetingDate: '2025-01-15',
    });
    expect(getFollowUps(storage)[0].linkedMeetingId).toBe('note-1');
    expect(getDecisions(storage, PRIYA.id)[0].linkedMeetingId).toBe('');
    expect(getDecisions(storage, ALEX.id).find((d) => d.id === linked.id)?.linkedMeetingId).toBe(
      'older',
    );
    expect(flush).toHaveBeenCalledOnce();
  });

  it('does not write when there is nothing to link', async () => {
    const { storage, flush } = createStorage();

    expect(await linkToMeeting(ALEX.id, meeting, storage)).toBe(0);
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a meeting with an invalid date', async () => {
    const { storage } = createStorage();

    await expect(
      linkToMeeting(ALEX.id, { id: 'n', createdAt: 'nope' }, storage),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('deleteDecisionsForMember', () => {
  it('removes only that member’s decisions and follow-ups', async () => {
    const { storage } = createStorage({
      decisions: [buildDecision({ engineerId: ALEX.id }), buildDecision({ engineerId: PRIYA.id })],
      followUps: [buildFollowUp({ engineerId: ALEX.id }), buildFollowUp({ engineerId: PRIYA.id })],
    });

    await deleteDecisionsForMember(ALEX.id, storage);

    expect(getDecisions(storage).map((d) => d.engineerId)).toEqual([PRIYA.id]);
    expect(getFollowUps(storage).map((d) => d.engineerId)).toEqual([PRIYA.id]);
  });
});

describe('isFollowUpOverdue', () => {
  const now = new Date(2025, 0, 20, 12);

  it('is overdue only when pending and due before today', () => {
    expect(isFollowUpOverdue({ status: 'pending', dueDate: '2025-01-19' }, now)).toBe(true);
    expect(isFollowUpOverdue({ status: 'pending', dueDate: '2025-01-20' }, now)).toBe(false);
    expect(isFollowUpOverdue({ status: 'done', dueDate: '2025-01-01' }, now)).toBe(false);
    expect(isFollowUpOverdue({ status: 'pending' }, now)).toBe(false);
  });
});

describe('isDecisionFollowUpFilter', () => {
  it('accepts the three filters and nothing else', () => {
    expect(['all', 'decisions', 'follow-ups'].every(isDecisionFollowUpFilter)).toBe(true);
    expect(isDecisionFollowUpFilter('done')).toBe(false);
  });
});
