import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { DocumentCategory, DocumentLink, DocumentLinkInput } from '../types/document';
import { URL_MAX_LENGTH, normalizeExternalUrl } from '../utils/externalUrl';
import { isIsoDate } from '../utils/relativeDate';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** Which documents exist for whom hints at promotions and plans, so they live in the private envelope. */
const STORAGE_KEY = 'documentLinks';

/** Needs `get` as well because the person is validated against the team list. */
export type DocumentLinksStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const DOCUMENT_TITLE_MAX_LENGTH = 200;

export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  'promo_packet',
  'self_review',
  'career_ladder',
  'idp',
  'other',
];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  promo_packet: 'Promo Packets',
  self_review: 'Self Reviews',
  career_ladder: 'Career Ladder',
  idp: 'IDPs',
  other: 'Other',
};

export const INVALID_URL_MESSAGE = 'Enter a link that starts with https:// or http://';

/** The fields a manager can change; id, person and timestamps are never taken from the caller. */
export type DocumentLinkUpdate = Partial<DocumentLinkInput>;

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return typeof value === 'string' && (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isDocumentLink(value: unknown): value is DocumentLink {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.memberId) &&
    isString(item.title) &&
    // A stored URL that is not a safe web link is dropped, so tampering cannot reach an <a href>.
    normalizeExternalUrl(item.url) !== null &&
    isDocumentCategory(item.category) &&
    item.visibility === 'private' &&
    isIsoDate(item.createdAt) &&
    isString(item.updatedAt)
  );
}

// A malformed link is reported once per id; the message never carries a title or URL.
const reportedIds = new Set<string>();

function reportMalformed(value: unknown) {
  const id =
    typeof value === 'object' && value !== null && isString((value as { id?: unknown }).id)
      ? (value as { id: string }).id
      : 'unknown';
  if (reportedIds.has(id)) return;
  reportedIds.add(id);
  // eslint-disable-next-line no-console -- structural warning only; it names the record, never its content
  console.warn(`Failed to parse document link ${id}`);
}

function readLinks(storage: DocumentLinksStorage): DocumentLink[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is DocumentLink => {
    if (isDocumentLink(item)) return true;
    reportMalformed(item);
    return false;
  });
}

function stripControl(value: string): string {
  return Array.from(value)
    .filter((char) => char.charCodeAt(0) > 0x1f && char.charCodeAt(0) !== 0x7f)
    .join('');
}

function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Enter a title');
  const title = stripControl(value).trim();
  if (title === '') throw new ValidationError('Enter a title');
  if (title.length > DOCUMENT_TITLE_MAX_LENGTH) {
    throw new ValidationError(`Title must be ${DOCUMENT_TITLE_MAX_LENGTH} characters or fewer`);
  }
  return title;
}

// The message never includes the value; a link can carry an access token.
function cleanUrl(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > URL_MAX_LENGTH) {
    throw new ValidationError(`Link must be ${URL_MAX_LENGTH} characters or fewer`);
  }
  const url = normalizeExternalUrl(value);
  if (url === null) throw new ValidationError(INVALID_URL_MESSAGE);
  return url;
}

function cleanCategory(value: unknown): DocumentCategory {
  if (!isDocumentCategory(value)) throw new ValidationError('Category is not valid');
  return value;
}

function requireMember(memberId: unknown, storage: DocumentLinksStorage): string {
  if (typeof memberId !== 'string' || !getMember(memberId, storage)) {
    throw new ValidationError('This needs a team member');
  }
  return memberId;
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(
  storage: DocumentLinksStorage,
  previous: DocumentLink[],
  next: DocumentLink[],
): Promise<void> {
  storage.setPrivate(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

export function createDocumentLink(
  memberId: string,
  input: DocumentLinkInput,
  storage: DocumentLinksStorage,
): Promise<DocumentLink> {
  return enqueue(async () => {
    const timestamp = new Date().toISOString();
    const link: DocumentLink = {
      id: crypto.randomUUID(),
      memberId: requireMember(memberId, storage),
      title: cleanTitle(input.title),
      url: cleanUrl(input.url),
      category: cleanCategory(input.category),
      visibility: 'private',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const previous = readLinks(storage);
    await commit(storage, previous, [...previous, link]);
    return { ...link };
  });
}

export function updateDocumentLink(
  id: string,
  updates: DocumentLinkUpdate,
  storage: DocumentLinksStorage,
): Promise<DocumentLink> {
  return enqueue(async () => {
    const previous = readLinks(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: DocumentLink = {
      ...existing,
      title: 'title' in updates ? cleanTitle(updates.title) : existing.title,
      url: 'url' in updates ? cleanUrl(updates.url) : existing.url,
      category: 'category' in updates ? cleanCategory(updates.category) : existing.category,
    };
    const isChanged =
      updated.title !== existing.title ||
      updated.url !== existing.url ||
      updated.category !== existing.category;
    // "Last updated" only moves when something did.
    if (!isChanged) return { ...existing };
    updated.updatedAt = new Date().toISOString();
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

export function deleteDocumentLink(id: string, storage: DocumentLinksStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readLinks(storage);
    if (!previous.some((item) => item.id === id)) throw new NotFoundError(id);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.id !== id),
    );
  });
}

/** One person's links in the order they were added. */
export function getDocumentLinks(storage: DocumentLinksStorage, memberId: string): DocumentLink[] {
  return readLinks(storage)
    .filter((item) => item.memberId === memberId)
    .map((item) => ({ ...item }));
}

/** Removes every link for a member, for when they leave the team. */
export function deleteDocumentLinksForMember(
  memberId: string,
  storage: DocumentLinksStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = readLinks(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.memberId !== memberId),
    );
  });
}
