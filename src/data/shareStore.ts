import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { SharedViewPayload } from '../types/sharing';
import { SHARE_LIMITS } from '../utils/validateSharePayload';
import { serializeForSharing, type SerializeOptions } from '../utils/serializeForSharing';
import { createShareUrl } from '../utils/shareUrl';
import { listAgendaForMember } from './agenda';
import { listByMember } from './actionItems';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';
import { listNotes } from './notes';

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

export type ShareOptions = Pick<SerializeOptions, 'now' | 'ttlMs' | 'id'>;

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
  const member = getMember(memberId, storage);
  if (!member) throw new NotFoundError(memberId);
  return serializeForSharing(
    member,
    listNotes(memberId, storage),
    listByMember(memberId, storage),
    listAgendaForMember(memberId, storage),
    { ...options, managerName: cleanManagerName(managerName) },
  );
}

/** A snapshot link: later changes to notes or action items are not in it. */
export async function createShareLink(
  memberId: string,
  managerName: string,
  storage: ShareStorage,
  options: ShareOptions = {},
): Promise<ShareLink> {
  await storage.loadPrivate();
  const key = storage.getShareSigningKey();
  if (key === null) throw new ShareLockedError();
  const payload = getSharedData(memberId, managerName, storage, options);
  const url = await createShareUrl(payload, key);
  const marker = '#/shared/';
  return { url, payload, tokenLength: url.length - url.indexOf(marker) - marker.length };
}
