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

/** How long a link works. The only lifetimes a manager can choose. */
export type ShareTokenTTL = '1h' | '6h' | '24h' | '48h';

/**
 * The manager's own record of a link they created, kept in their encrypted storage. It never
 * travels in a link and holds no content: only enough to list the link and to refuse it later in
 * this browser.
 */
export interface ShareToken {
  /** The `id` inside the link's payload. */
  id: string;
  engineerId: string;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  expiresAt: string;
  revoked: boolean;
  ttl: ShareTokenTTL;
}

/** A revoked link and an expired one both end up as 'expired', so a link never says which. */
export type SharedViewStatus = 'loading' | 'valid' | 'expired' | 'invalid';
