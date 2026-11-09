export type DocumentCategory = 'promo_packet' | 'self_review' | 'career_ladder' | 'idp' | 'other';

/**
 * A pointer to a document that lives elsewhere (Google Docs, Confluence). Only the link is kept,
 * never the document. Which category a person has links in can reveal who is up for promotion,
 * so these live in the private envelope and never in a share payload.
 */
export interface DocumentLink {
  /** crypto.randomUUID() */
  id: string;
  memberId: string;
  title: string;
  /** Always a normalised http: or https: URL. */
  url: string;
  category: DocumentCategory;
  /** Reserved for a future multi-user mode. Nothing but the manager can see a link today. */
  visibility: 'private';
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** What the manager types; everything else is set by the store. */
export type DocumentLinkInput = Pick<DocumentLink, 'title' | 'url' | 'category'>;
