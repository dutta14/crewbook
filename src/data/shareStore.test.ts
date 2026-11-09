import { describe, expect, it, vi } from 'vitest';
import { createActionItem, createMember } from '../test-utils/factories';
import { NotFoundError, ValidationError } from './errors';
import { ShareLockedError, cleanManagerName, createShareLink, getSharedData } from './shareStore';
import type { ShareStorage } from './shareStore';
import { readShareToken } from '../utils/shareUrl';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const SECRET = 'SENTINEL-SECRET';
const stamp = '2026-03-01T10:00:00.000Z';

const notes = [
  {
    id: 'n1',
    memberId: 'alex',
    content: 'Shared note',
    createdAt: stamp,
    updatedAt: stamp,
    visibility: 'shared',
  },
  {
    id: 'n2',
    memberId: 'alex',
    content: `Hidden ${SECRET}`,
    createdAt: stamp,
    updatedAt: stamp,
    visibility: 'private',
  },
  { id: 'n3', memberId: 'alex', content: `Unmarked ${SECRET}`, createdAt: stamp, updatedAt: stamp },
  {
    id: 'n4',
    memberId: 'priya',
    content: `Other ${SECRET}`,
    createdAt: stamp,
    updatedAt: stamp,
    visibility: 'shared',
  },
];

function setup(key: CryptoKey | null) {
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const privateData = new Map<string, unknown>([
    ['notes', notes],
    [
      'actionItems',
      [
        createActionItem({ id: 'a1', memberId: 'alex', title: 'Ship it', ownerId: 'manager' }),
        createActionItem({ id: 'a2', memberId: 'priya', title: `Other ${SECRET}` }),
      ],
    ],
    ['moods', [{ memberId: 'alex', score: 1, note: SECRET }]],
    ['flightRisk', [{ engineerId: 'alex', text: SECRET, flightRisk: 'high' }]],
    ['feedbackEntries', [{ memberId: 'alex', text: SECRET }]],
  ]);
  const loadPrivate = vi.fn(async () => undefined);
  const storage: ShareStorage = {
    get: <T>(k: string) => (publicData.has(k) ? (publicData.get(k) as T) : null),
    set: <T>(k: string, v: T) => void publicData.set(k, v),
    getPrivate: <T>(k: string) => (privateData.has(k) ? (privateData.get(k) as T) : null),
    setPrivate: <T>(k: string, v: T) => void privateData.set(k, v),
    flush: async () => null,
    loadPrivate,
    getShareSigningKey: () => key,
  };
  return { storage, loadPrivate };
}

const newKey = () =>
  crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

describe('getSharedData', () => {
  it('returns only the shared notes and action items for that person', () => {
    const { storage } = setup(null);
    const payload = getSharedData('alex', 'Morgan', storage);
    expect(payload.engineerName).toBe('Alex Chen');
    expect(payload.sharedNotes.map((n) => n.text)).toEqual(['Shared note']);
    expect(payload.actionItems.map((i) => i.title)).toEqual(['Ship it']);
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    expect(JSON.stringify(payload)).not.toContain('Priya');
  });

  it('throws for an unknown person or a missing name', () => {
    const { storage } = setup(null);
    expect(() => getSharedData('nobody', 'Morgan', storage)).toThrow(NotFoundError);
    expect(() => getSharedData('alex', '   ', storage)).toThrow(ValidationError);
  });
});

describe('cleanManagerName', () => {
  it('collapses whitespace and enforces the length limit', () => {
    expect(cleanManagerName('  Morgan \n Lee ')).toBe('Morgan Lee');
    expect(() => cleanManagerName('x'.repeat(101))).toThrow(ValidationError);
  });
});

describe('createShareLink', () => {
  it('loads private data, signs the payload and returns a link the viewer can read', async () => {
    const key = await newKey();
    const { storage, loadPrivate } = setup(key);
    const link = await createShareLink('alex', 'Morgan', storage);
    expect(loadPrivate).toHaveBeenCalled();
    expect(link.url).toContain('#/shared/');
    expect(link.url).not.toContain(SECRET);
    expect(link.tokenLength).toBeGreaterThan(50);
    expect(await readShareToken(link.url, key)).toEqual(link.payload);
  });

  it('refuses while the app is locked', async () => {
    const { storage } = setup(null);
    await expect(createShareLink('alex', 'Morgan', storage)).rejects.toBeInstanceOf(
      ShareLockedError,
    );
  });
});
