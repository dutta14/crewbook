export type RelationshipType = 'collaborator' | 'mentor' | 'mentee' | 'stakeholder';

/**
 * One working relationship, stored once. `relationship` says what the target is to the source:
 * "mentor" means the target mentors the source. The target's profile reads it the other way round.
 */
export interface Connection {
  /** crypto.randomUUID() */
  id: string;
  sourceMemberId: string;
  /** Null for a cross-team peer who is not on the roster. */
  targetMemberId: string | null;
  /** Display name; always set. For a roster peer the live roster name is shown instead. */
  targetName: string;
  relationship: RelationshipType;
  notes?: string;
}

/** What the manager types; the store sets the id and the source. */
export type ConnectionInput = Omit<Connection, 'id' | 'sourceMemberId'>;

/** One connection as one person's profile sees it. */
export interface ConnectionView {
  id: string;
  /** The other person; null for a cross-team peer. */
  peerId: string | null;
  peerName: string;
  /** What the peer is to the person whose profile this is. */
  relationship: RelationshipType;
  notes: string;
  /** Incoming views come from a connection the other person's side created. */
  direction: 'outgoing' | 'incoming';
}

export interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  /** From the avatar palette. */
  color: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: RelationshipType;
}
