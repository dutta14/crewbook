import type { ActionItem } from '../types/ActionItem';
import type { AgendaItem } from '../types/agenda';
import type { Note } from '../types/Note';
import type {
  SharedActionItem,
  SharedAgendaItem,
  SharedNote,
  SharedViewPayload,
} from '../types/sharing';
import type { TeamMember } from '../types/TeamMember';
import { getAvatarColor, getInitials } from './avatarColor';
import { SHARE_LIMITS } from './validateSharePayload';

export const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SerializeOptions {
  managerName: string;
  now?: Date;
  /** How long the link works. A later issue lets the manager choose. */
  ttlMs?: number;
  /** Identifies the link. Generated when omitted. */
  id?: string;
}

const MANAGER_OWNER_ID = 'manager';

const clip = (value: string, max: number) => Array.from(value).slice(0, max).join('');

function shareNote(note: Note): SharedNote {
  return {
    id: note.id,
    text: clip(note.content, SHARE_LIMITS.noteLength),
    createdAt: note.createdAt,
  };
}

function shareAction(item: ActionItem, engineerId: string): SharedActionItem | null {
  if (item.status !== 'open' && item.status !== 'done') return null;
  // Items owned by anyone else are left out so no other person's name travels in the link.
  const owner =
    item.ownerId === MANAGER_OWNER_ID ? 'manager' : item.ownerId === engineerId ? 'engineer' : null;
  if (owner === null) return null;
  const title = clip(item.title, SHARE_LIMITS.titleLength);
  return item.dueDate === undefined
    ? { id: item.id, title, status: item.status, owner }
    : { id: item.id, title, status: item.status, dueDate: item.dueDate, owner };
}

function shareAgenda(item: AgendaItem): SharedAgendaItem {
  return {
    id: item.id,
    text: clip(item.text, SHARE_LIMITS.agendaLength),
    addedBy: item.addedBy,
    createdAt: item.createdAt,
  };
}

/**
 * The only way data becomes a share payload. Every field is copied by name; records are never
 * spread, and a note, action item or agenda item is included only when it says it may be shared.
 * Anything this function does not name cannot leave the device.
 */
export function serializeForSharing(
  member: TeamMember,
  notes: readonly Note[],
  actionItems: readonly ActionItem[],
  agendaItems: readonly AgendaItem[],
  { managerName, now = new Date(), ttlMs = SHARE_TTL_MS, id }: SerializeOptions,
): SharedViewPayload {
  return {
    v: 1,
    id: id ?? crypto.randomUUID(),
    managerName: clip(managerName.trim(), SHARE_LIMITS.nameLength),
    engineerName: clip(member.name, SHARE_LIMITS.nameLength),
    engineerAvatar: { initials: getInitials(member.name), color: getAvatarColor(member.name) },
    sharedNotes: notes
      .filter((note) => note.memberId === member.id && note.visibility === 'shared')
      .slice(0, SHARE_LIMITS.maxNotes)
      .map(shareNote),
    actionItems: actionItems
      .filter((item) => item.memberId === member.id)
      .map((item) => shareAction(item, member.id))
      .filter((item): item is SharedActionItem => item !== null)
      .slice(0, SHARE_LIMITS.maxActionItems),
    agendaItems: agendaItems
      .filter((item) => item.memberId === member.id && item.includeInShare === true)
      .slice(0, SHARE_LIMITS.maxAgendaItems)
      .map(shareAgenda),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
}
