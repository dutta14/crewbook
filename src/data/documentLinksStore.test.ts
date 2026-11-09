import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember, createDocumentLink as buildLink } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import {
  DOCUMENT_TITLE_MAX_LENGTH,
  createDocumentLink,
  deleteDocumentLink,
  deleteDocumentLinksForMember,
  getDocumentLinks,
  isDocumentCategory,
  updateDocumentLink,
  type DocumentLinksStorage,
} from './documentLinksStore';
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
  const storage: DocumentLinksStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const input = (overrides: Partial<Parameters<typeof createDocumentLink>[1]> = {}) => ({
  title: 'Q3 promo packet',
  url: 'https://docs.google.com/document/d/abc123',
  category: 'promo_packet' as const,
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('createDocumentLink', () => {
  it('stores a private, timestamped link in the private envelope and flushes', async () => {
    const { storage, data, flush } = createStorage();

    const link = await createDocumentLink(ALEX.id, input(), storage);

    expect(link).toMatchObject({
      memberId: ALEX.id,
      title: 'Q3 promo packet',
      url: 'https://docs.google.com/document/d/abc123',
      category: 'promo_packet',
      visibility: 'private',
    });
    expect(link.createdAt).toBe(link.updatedAt);
    expect(data.get('documentLinks')).toEqual([link]);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('trims the title and normalises the URL', async () => {
    const { storage } = createStorage();

    const link = await createDocumentLink(
      ALEX.id,
      input({ title: '  Staff\u0007 ladder  ', url: '  https://Wiki.Example.com  ' }),
      storage,
    );

    expect(link.title).toBe('Staff ladder');
    expect(link.url).toBe('https://wiki.example.com/');
  });

  it.each([
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['data:text/html;base64,PHNjcmlwdD4='],
    ['vbscript:msgbox(1)'],
    ['file:///etc/passwd'],
    ['ftp://example.com/a'],
    ['//example.com/a'],
    ['example.com/a'],
    ['https://'],
    ['https://user:pass@example.com'],
    ['https://exa\nmple.com'],
    [''],
  ])('rejects the URL %j without storing anything or echoing it', async (url) => {
    const { storage, data } = createStorage();

    const attempt = createDocumentLink(ALEX.id, input({ url }), storage);

    await expect(attempt).rejects.toBeInstanceOf(ValidationError);
    await attempt.catch((error: Error) => {
      if (url.length > 8) expect(error.message).not.toContain(url);
    });
    expect(data.has('documentLinks')).toBe(false);
  });

  it('accepts a plain http link', async () => {
    const { storage } = createStorage();

    const link = await createDocumentLink(
      ALEX.id,
      input({ url: 'http://wiki.example.com/a' }),
      storage,
    );

    expect(link.url).toBe('http://wiki.example.com/a');
  });

  it('rejects a URL longer than 2048 characters', async () => {
    const { storage } = createStorage();

    await expect(
      createDocumentLink(
        ALEX.id,
        input({ url: `https://example.com/${'a'.repeat(2048)}` }),
        storage,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects an empty or over-long title, a bad category and an unknown person', async () => {
    const { storage } = createStorage();

    await expect(createDocumentLink(ALEX.id, input({ title: '  ' }), storage)).rejects.toThrow(
      ValidationError,
    );
    await expect(
      createDocumentLink(
        ALEX.id,
        input({ title: 'x'.repeat(DOCUMENT_TITLE_MAX_LENGTH + 1) }),
        storage,
      ),
    ).rejects.toThrow(ValidationError);
    await expect(
      createDocumentLink(ALEX.id, input({ category: 'secret' as never }), storage),
    ).rejects.toThrow(ValidationError);
    await expect(createDocumentLink('nobody', input(), storage)).rejects.toThrow(ValidationError);
  });

  it('rolls back and rejects with the failure when the write fails', async () => {
    const failure = new StorageWriteError(true, true);
    const existing = buildLink({ memberId: ALEX.id });
    const { storage, data } = createStorage({ documentLinks: [existing] }, failure);

    await expect(createDocumentLink(ALEX.id, input(), storage)).rejects.toBe(failure);

    expect(data.get('documentLinks')).toEqual([existing]);
  });
});

describe('updateDocumentLink', () => {
  it('changes the given fields and moves the updated time', async () => {
    const existing = buildLink({
      memberId: ALEX.id,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    const { storage, flush } = createStorage({ documentLinks: [existing] });

    const updated = await updateDocumentLink(
      existing.id,
      { title: 'Renamed', category: 'idp' },
      storage,
    );

    expect(updated).toMatchObject({
      title: 'Renamed',
      category: 'idp',
      url: existing.url,
      createdAt: existing.createdAt,
    });
    expect(updated.updatedAt > existing.updatedAt).toBe(true);
    expect(flush).toHaveBeenCalled();
  });

  it('validates a new URL the same way as a new link', async () => {
    const existing = buildLink({ memberId: ALEX.id });
    const { storage, data } = createStorage({ documentLinks: [existing] });

    await expect(
      updateDocumentLink(existing.id, { url: 'javascript:alert(1)' }, storage),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(data.get('documentLinks')).toEqual([existing]);
  });

  it('leaves the updated time and storage alone when nothing changed', async () => {
    const existing = buildLink({ memberId: ALEX.id, updatedAt: '2025-01-01T00:00:00.000Z' });
    const { storage, flush } = createStorage({ documentLinks: [existing] });

    const updated = await updateDocumentLink(
      existing.id,
      { title: existing.title, url: existing.url },
      storage,
    );

    expect(updated.updatedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects an unknown id', async () => {
    const { storage } = createStorage();

    await expect(updateDocumentLink('missing', { title: 'x' }, storage)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('deleteDocumentLink', () => {
  it('removes only the named link', async () => {
    const keep = buildLink({ memberId: ALEX.id, title: 'Keep' });
    const drop = buildLink({ memberId: ALEX.id, title: 'Drop' });
    const { storage, data } = createStorage({ documentLinks: [keep, drop] });

    await deleteDocumentLink(drop.id, storage);

    expect(data.get('documentLinks')).toEqual([keep]);
  });

  it('rejects an unknown id', async () => {
    const { storage } = createStorage();

    await expect(deleteDocumentLink('missing', storage)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getDocumentLinks', () => {
  it('returns one person’s links in the order they were added', () => {
    const first = buildLink({ memberId: ALEX.id, title: 'First' });
    const other = buildLink({ memberId: PRIYA.id, title: 'Other' });
    const second = buildLink({ memberId: ALEX.id, title: 'Second' });
    const { storage } = createStorage({ documentLinks: [first, other, second] });

    expect(getDocumentLinks(storage, ALEX.id).map((link) => link.title)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('returns nothing when the stored value is not a list', () => {
    const { storage } = createStorage({ documentLinks: 'oops' });

    expect(getDocumentLinks(storage, ALEX.id)).toEqual([]);
  });

  it('drops tampered records, warns once by id and never logs the URL or title', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const good = buildLink({ memberId: ALEX.id, title: 'Good' });
    const unsafe = buildLink({
      id: 'unsafe-id',
      memberId: ALEX.id,
      title: 'Secret title',
      url: 'javascript:alert(1)',
    });
    const { storage } = createStorage({
      documentLinks: [good, unsafe, { id: 'half' }, null, { ...good, id: 'x', category: 'nope' }],
    });

    expect(getDocumentLinks(storage, ALEX.id)).toEqual([good]);
    getDocumentLinks(storage, ALEX.id);

    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).toContain('unsafe-id');
    expect(logged).not.toContain('javascript');
    expect(logged).not.toContain('Secret title');
    expect(
      warn.mock.calls.filter(([message]) => String(message).includes('unsafe-id')),
    ).toHaveLength(1);
  });
});

describe('deleteDocumentLinksForMember', () => {
  it('removes every link for the member and keeps the rest', async () => {
    const mine = [buildLink({ memberId: ALEX.id }), buildLink({ memberId: ALEX.id })];
    const theirs = buildLink({ memberId: PRIYA.id });
    const { storage, data } = createStorage({ documentLinks: [...mine, theirs] });

    await deleteDocumentLinksForMember(ALEX.id, storage);

    expect(data.get('documentLinks')).toEqual([theirs]);
  });
});

describe('isDocumentCategory', () => {
  it('accepts only the five categories', () => {
    expect(isDocumentCategory('idp')).toBe(true);
    expect(isDocumentCategory('promo')).toBe(false);
    expect(isDocumentCategory(undefined)).toBe(false);
  });
});
