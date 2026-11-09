import { describe, expect, it, vi } from 'vitest';
import { createActionItem, createMember } from '../test-utils/factories';
import { makePayload } from '../test-utils/sharePayload';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  ShareLockedError,
  agendaMentionsOthers,
  cleanManagerName,
  createShareLink,
  deleteShareTokensForMember,
  getActiveTokens,
  getSharedData,
  isTokenValid,
  recordShareToken,
  revokeToken,
} from './shareStore';
import type { ShareStorage } from './shareStore';
import { readShareToken, ShareUnsupportedError } from '../utils/shareUrl';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const SECRET = 'SENTINEL-SECRET';
const stamp = '2026-03-01T10:00:00.000Z';

// Shared notes live in the main envelope; the private envelope is never a source for share links.
const sharedNotes = [
  {
    id: 'n1',
    memberId: 'alex',
    content: 'Shared note',
    createdAt: stamp,
    updatedAt: stamp,
    visibility: 'shared',
  },
  {
    id: 'n4',
    memberId: 'priya',
    content: `Other ${SECRET}`,
    createdAt: stamp,
    updatedAt: stamp,
    visibility: 'shared',
  },
];

const notes = [
  {
    id: 'n5',
    memberId: 'alex',
    content: `Mislabelled ${SECRET}`,
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
];

function setup(key: CryptoKey | null) {
  const publicData = new Map<string, unknown>([
    ['members', [ALEX, PRIYA]],
    ['sharedNotes', sharedNotes],
  ]);
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

describe('agendaMentionsOthers', () => {
  const payload = (...texts: string[]) => ({
    agendaItems: texts.map((text, index) => ({
      id: `g${index}`,
      text,
      addedBy: 'manager' as const,
      createdAt: stamp,
    })),
  });
  const members = {
    get: <T>() => [ALEX, PRIYA] as T,
    set: vi.fn(),
    flush: vi.fn(async () => null),
  };

  it('is false when there are no agenda items', () => {
    expect(agendaMentionsOthers(payload(), 'alex', members)).toBe(false);
  });

  it('finds another member by full name, ignoring case', () => {
    expect(agendaMentionsOthers(payload('Compare with priya nair'), 'alex', members)).toBe(true);
  });

  it('does not count the engineer’s own name', () => {
    expect(agendaMentionsOthers(payload('Alex Chen promotion'), 'alex', members)).toBe(false);
  });

  it('finds an @mention at the start or after a space but not inside an email address', () => {
    expect(agendaMentionsOthers(payload('@sam to join'), 'alex', members)).toBe(true);
    expect(agendaMentionsOthers(payload('Ask @sam'), 'alex', members)).toBe(true);
    expect(agendaMentionsOthers(payload('mail a@b.com'), 'alex', members)).toBe(false);
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

  it('never puts a private note in the signed link, even one with a shared-looking record', async () => {
    const key = await newKey();
    const { storage } = setup(key);
    const link = await createShareLink('alex', 'Morgan', storage);
    const decoded = await readShareToken(link.url, key);
    const serialized = JSON.stringify(decoded);

    expect(decoded?.sharedNotes.map((note) => note.text)).toEqual(['Shared note']);
    for (const hidden of ['Hidden', 'Unmarked', 'Mislabelled', SECRET]) {
      expect(serialized).not.toContain(hidden);
    }
  });

  it('refuses while the app is locked', async () => {
    const { storage } = setup(null);
    await expect(createShareLink('alex', 'Morgan', storage)).rejects.toBeInstanceOf(
      ShareLockedError,
    );
  });

  it('lasts 24 hours unless a preset lifetime is chosen', async () => {
    const { storage } = setup(await newKey());
    const day = await createShareLink('alex', 'Morgan', storage);
    const hour = await createShareLink('alex', 'Morgan', storage, { ttl: '1h' });
    const lifetime = ({ payload }: { payload: { createdAt: string; expiresAt: string } }) =>
      Date.parse(payload.expiresAt) - Date.parse(payload.createdAt);
    expect(lifetime(day)).toBe(24 * 60 * 60 * 1000);
    expect(lifetime(hour)).toBe(60 * 60 * 1000);
  });

  it('rejects a lifetime that is not a preset', async () => {
    const { storage } = setup(await newKey());
    await expect(
      createShareLink('alex', 'Morgan', storage, { ttl: '72h' as never }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reports an unsupported browser when random ids are unavailable', async () => {
    const { storage } = setup(await newKey());
    vi.stubGlobal('crypto', { subtle: crypto.subtle });
    try {
      await expect(createShareLink('alex', 'Morgan', storage)).rejects.toBeInstanceOf(
        ShareUnsupportedError,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('share token registry', () => {
  const NOW = new Date('2026-03-01T10:00:00.000Z');
  const payloadFor = (id: string, hours = 24, from = NOW) =>
    makePayload({
      id,
      createdAt: from.toISOString(),
      expiresAt: new Date(from.getTime() + hours * 3_600_000).toISOString(),
    });

  it('records a token without any of the shared content', async () => {
    const { storage } = setup(null);
    const token = await recordShareToken('alex', payloadFor('t1'), storage, NOW);
    expect(token).toMatchObject({ id: 't1', engineerId: 'alex', revoked: false, ttl: '24h' });
    const stored = JSON.stringify(storage.get('shareTokens'));
    expect(stored).not.toContain('Morgan');
    expect(stored).not.toContain('Talked about');
  });

  it('lists live tokens for one person, soonest to expire first', async () => {
    const { storage } = setup(null);
    await recordShareToken('alex', payloadFor('long', 48), storage, NOW);
    await recordShareToken('alex', payloadFor('short', 1), storage, NOW);
    await recordShareToken('priya', payloadFor('other'), storage, NOW);
    expect(getActiveTokens('alex', storage, NOW).map(({ id }) => id)).toEqual(['short', 'long']);
  });

  it('drops tokens past their expiry from the list and the store', async () => {
    const { storage } = setup(null);
    await recordShareToken('alex', payloadFor('old', 1), storage, NOW);
    const later = new Date(NOW.getTime() + 2 * 3_600_000);
    expect(getActiveTokens('alex', storage, later)).toEqual([]);
    await recordShareToken('alex', payloadFor('new', 1, later), storage, later);
    expect(isTokenValid('old', storage, later)).toEqual({ valid: false, reason: 'not_found' });
  });

  it('revokes a token and reports why it is no longer valid', async () => {
    const { storage } = setup(null);
    await recordShareToken('alex', payloadFor('t1'), storage, NOW);
    expect(isTokenValid('t1', storage, NOW)).toEqual({ valid: true });
    await revokeToken('t1', storage, NOW);
    expect(isTokenValid('t1', storage, NOW)).toEqual({ valid: false, reason: 'revoked' });
    expect(getActiveTokens('alex', storage, NOW)).toEqual([]);
  });

  it('reports an expired and an unknown token', async () => {
    const { storage } = setup(null);
    await recordShareToken('alex', payloadFor('t1', 1), storage, NOW);
    const later = new Date(NOW.getTime() + 2 * 3_600_000);
    expect(isTokenValid('t1', storage, later)).toEqual({ valid: false, reason: 'expired' });
    expect(isTokenValid('missing', storage, NOW)).toEqual({ valid: false, reason: 'not_found' });
  });

  it('refuses to revoke a token it does not know', async () => {
    const { storage } = setup(null);
    await expect(revokeToken('missing', storage, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses a payload whose lifetime is not a preset', async () => {
    const { storage } = setup(null);
    const odd = makePayload({
      createdAt: NOW.toISOString(),
      expiresAt: '2026-03-01T10:05:00.000Z',
    });
    await expect(recordShareToken('alex', odd, storage, NOW)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('ignores stored entries that are not well-formed tokens', () => {
    const { storage } = setup(null);
    storage.set('shareTokens', [null, { id: 5 }, 'x']);
    expect(getActiveTokens('alex', storage, NOW)).toEqual([]);
    storage.set('shareTokens', 'nope');
    expect(getActiveTokens('alex', storage, NOW)).toEqual([]);
  });

  it('puts the list back when saving fails', async () => {
    const { storage } = setup(null);
    await recordShareToken('alex', payloadFor('t1'), storage, NOW);
    const failing = { ...storage, flush: async () => new StorageWriteError(false, false) };
    await expect(revokeToken('t1', failing, NOW)).rejects.toBeInstanceOf(StorageWriteError);
    expect(isTokenValid('t1', storage, NOW)).toEqual({ valid: true });
    await expect(recordShareToken('alex', payloadFor('t2'), failing, NOW)).rejects.toBeInstanceOf(
      StorageWriteError,
    );
    expect(isTokenValid('t2', storage, NOW).reason).toBe('not_found');
  });

  it('removes only the tokens made for a deleted person', async () => {
    const { storage } = setup(null);
    await recordShareToken('alex', payloadFor('a1'), storage, NOW);
    await recordShareToken('priya', payloadFor('p1'), storage, NOW);
    await deleteShareTokensForMember('alex', storage);
    expect(isTokenValid('a1', storage, NOW).reason).toBe('not_found');
    expect(isTokenValid('p1', storage, NOW).valid).toBe(true);
    await expect(deleteShareTokensForMember('nobody', storage)).resolves.toBeUndefined();
  });
});
