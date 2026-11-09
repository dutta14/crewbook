import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { ShareToken, ShareTokenTTL, SharedViewPayload } from '../types/sharing';
import { SHARE_LIMITS } from '../utils/validateSharePayload';
import { serializeForSharing, type SerializeOptions } from '../utils/serializeForSharing';
import {
  DEFAULT_SHARE_TTL,
  isPastExpiry,
  isShareTokenTTL,
  ttlForLifetime,
  ttlToMs,
} from '../utils/shareExpiry';
import { ShareUnsupportedError, createShareUrl } from '../utils/shareUrl';
import { listAgendaForMember } from './agenda';
import { listByMember } from './actionItems';
import { NotFoundError, ValidationError } from './errors';
import { getMember, listMembers } from './members';
import { listSharedNotes } from './notes';

/*
 * The single place share data is read from storage. It reads a fixed list of sources (the person,
 * their notes, their action items and their agenda) and hands them to serializeForSharing, which
 * picks the fields that may leave the device. Nothing else in the app is reachable from here, and
 * the isolation tests keep it that way.
 */
export type ShareStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush' | 'loadPrivate' | 'getShareSigningKey'
>;

export interface ShareLink {
  url: string;
  payload: SharedViewPayload;
  /** Length of the token inside the link, in characters. */
  tokenLength: number;
}

/** `ttl` is one of the presets; a free length is not offered, so none can be asked for. */
export type ShareOptions = Pick<SerializeOptions, 'now' | 'id'> & { ttl?: ShareTokenTTL };

export class ShareLockedError extends Error {
  constructor() {
    super('Unlock Crewbook to create a share link');
    this.name = 'ShareLockedError';
  }
}

export function cleanManagerName(name: string): string {
  const cleaned = name.replace(/\s+/g, ' ').trim();
  if (cleaned === '') throw new ValidationError('Enter your name');
  if (cleaned.length > SHARE_LIMITS.nameLength) {
    throw new ValidationError(`Name must be ${SHARE_LIMITS.nameLength} characters or fewer`);
  }
  return cleaned;
}

/** What would be shared for one person right now. Call loadPrivate first. */
export function getSharedData(
  memberId: string,
  managerName: string,
  storage: ShareStorage,
  options: ShareOptions = {},
): SharedViewPayload {
  const { ttl = DEFAULT_SHARE_TTL, ...rest } = options;
  if (!isShareTokenTTL(ttl)) throw new ValidationError('Choose how long the link lasts');
  const member = getMember(memberId, storage);
  if (!member) throw new NotFoundError(memberId);
  return serializeForSharing(
    member,
    listSharedNotes(memberId, storage),
    listByMember(memberId, storage),
    listAgendaForMember(memberId, storage),
    { ...rest, ttlMs: ttlToMs(ttl), managerName: cleanManagerName(managerName) },
  );
}

/** A snapshot link: later changes to notes or action items are not in it. */
export async function createShareLink(
  memberId: string,
  managerName: string,
  storage: ShareStorage,
  options: ShareOptions = {},
): Promise<ShareLink> {
  // Link ids come from the browser's random source, which only exists on a secure page.
  if (options.id === undefined && typeof crypto.randomUUID !== 'function') {
    throw new ShareUnsupportedError();
  }
  await storage.loadPrivate();
  const key = storage.getShareSigningKey();
  if (key === null) throw new ShareLockedError();
  const payload = getSharedData(memberId, managerName, storage, options);
  const url = await createShareUrl(payload, key);
  const marker = '#/shared/';
  return { url, payload, tokenLength: url.length - url.indexOf(marker) - marker.length };
}

/*
 * The manager's list of links they have created. A link carries its own data, so this list is not
 * what makes a link work; it lets the manager see their links and refuse one in this browser. A
 * link opened anywhere else cannot be refused, because nothing outside this browser knows.
 */
const TOKENS_KEY = 'shareTokens';

export type ShareTokenReason = 'expired' | 'revoked' | 'not_found';

function isShareToken(value: unknown): value is ShareToken {
  if (typeof value !== 'object' || value === null) return false;
  const token = value as Record<string, unknown>;
  return (
    typeof token.id === 'string' &&
    typeof token.engineerId === 'string' &&
    typeof token.createdAt === 'string' &&
    typeof token.expiresAt === 'string' &&
    !Number.isNaN(Date.parse(token.expiresAt)) &&
    typeof token.revoked === 'boolean' &&
    isShareTokenTTL(token.ttl)
  );
}

function readTokens(storage: Pick<ShareStorage, 'get'>): ShareToken[] {
  const stored = storage.get<unknown>(TOKENS_KEY);
  return Array.isArray(stored) ? stored.filter(isShareToken) : [];
}

async function writeTokens(
  next: ShareToken[],
  storage: Pick<ShareStorage, 'get' | 'set' | 'flush'>,
): Promise<void> {
  const previous = storage.get<unknown>(TOKENS_KEY);
  storage.set(TOKENS_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.set(TOKENS_KEY, previous ?? []);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

/** Past expiry a record has nothing left to say, so it is dropped whenever the list is written. */
const alive = (tokens: ShareToken[], now: Date) =>
  tokens.filter((token) => !isPastExpiry(token.expiresAt, now.getTime()));

/** Notes a link the manager has seen. Call it once the link is on screen. */
export async function recordShareToken(
  engineerId: string,
  payload: SharedViewPayload,
  storage: Pick<ShareStorage, 'get' | 'set' | 'flush'>,
  now: Date = new Date(),
): Promise<ShareToken> {
  const ttl = ttlForLifetime(Date.parse(payload.expiresAt) - Date.parse(payload.createdAt));
  if (ttl === null) throw new ValidationError('Choose how long the link lasts');
  const token: ShareToken = {
    id: payload.id,
    engineerId,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    revoked: false,
    ttl,
  };
  const others = alive(readTokens(storage), now).filter(({ id }) => id !== token.id);
  await writeTokens([...others, token], storage);
  return token;
}

/** Links for one person that still work, soonest to expire first. */
export function getActiveTokens(
  engineerId: string,
  storage: Pick<ShareStorage, 'get'>,
  now: Date = new Date(),
): ShareToken[] {
  return readTokens(storage)
    .filter((token) => token.engineerId === engineerId && !token.revoked)
    .filter((token) => !isPastExpiry(token.expiresAt, now.getTime()))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

/** Stops this browser from showing the link. It cannot reach a copy opened on someone else's device. */
export async function revokeToken(
  tokenId: string,
  storage: Pick<ShareStorage, 'get' | 'set' | 'flush'>,
  now: Date = new Date(),
): Promise<void> {
  const tokens = readTokens(storage);
  if (!tokens.some(({ id }) => id === tokenId)) throw new NotFoundError(tokenId);
  await writeTokens(
    alive(
      tokens.map((token) => (token.id === tokenId ? { ...token, revoked: true } : token)),
      now,
    ),
    storage,
  );
}

export function isTokenValid(
  tokenId: string,
  storage: Pick<ShareStorage, 'get'>,
  now: Date = new Date(),
): { valid: boolean; reason?: ShareTokenReason } {
  const token = readTokens(storage).find(({ id }) => id === tokenId);
  if (!token) return { valid: false, reason: 'not_found' };
  if (token.revoked) return { valid: false, reason: 'revoked' };
  if (isPastExpiry(token.expiresAt, now.getTime())) return { valid: false, reason: 'expired' };
  return { valid: true };
}

/** Removing a person removes the list of links made for them. */
export async function deleteShareTokensForMember(
  engineerId: string,
  storage: Pick<ShareStorage, 'get' | 'set' | 'flush'>,
): Promise<void> {
  const tokens = readTokens(storage);
  const kept = tokens.filter((token) => token.engineerId !== engineerId);
  if (kept.length === tokens.length) return;
  await writeTokens(kept, storage);
}

const MENTION = /(^|\s)@\w/;

/**
 * True when a shared agenda topic seems to name someone else on the team: an @mention, or another
 * member's full name. The manager is warned before sharing; the text itself is never changed.
 */
export function agendaMentionsOthers(
  payload: Pick<SharedViewPayload, 'agendaItems'>,
  engineerId: string,
  storage: Pick<ShareStorage, 'get' | 'set' | 'flush'>,
): boolean {
  if (payload.agendaItems.length === 0) return false;
  const others = listMembers(storage)
    .filter((member) => member.id !== engineerId)
    .map((member) => member.name.trim().toLowerCase())
    .filter((name) => name.length > 0);
  return payload.agendaItems.some(({ text }) => {
    const lower = text.toLowerCase();
    return MENTION.test(text) || others.some((name) => lower.includes(name));
  });
}
