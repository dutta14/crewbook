/** Who a shared item belongs to or was added by, from the engineer's point of view. */
export type SharePerson = 'manager' | 'engineer';

export interface SharedNote {
  id: string;
  /** Plain text. Never rendered as HTML. */
  text: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface SharedActionItem {
  id: string;
  title: string;
  status: 'open' | 'done';
  /** YYYY-MM-DD. */
  dueDate?: string;
  owner: SharePerson;
}

export interface SharedAgendaItem {
  id: string;
  text: string;
  addedBy: SharePerson;
  /** ISO 8601. */
  createdAt: string;
}

/**
 * Everything a share link carries. It is built field by field in serializeForSharing and checked
 * field by field in validateSharePayload; nothing outside this shape can travel in a link.
 */
export interface SharedViewPayload {
  /** Payload version. */
  v: 1;
  /** Identifies this link, so a later issue can list and revoke links. */
  id: string;
  managerName: string;
  engineerName: string;
  engineerAvatar: { initials: string; color: string };
  sharedNotes: SharedNote[];
  actionItems: SharedActionItem[];
  agendaItems: SharedAgendaItem[];
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. The view refuses to render after this moment. */
  expiresAt: string;
}

export type SharedViewStatus = 'loading' | 'valid' | 'expired' | 'invalid';
