import type {
  Connection,
  ConnectionView,
  GraphEdge,
  GraphNode,
  RelationshipType,
} from '../types/connection';
import { getAvatarColor } from './avatarColor';

export interface NamedMember {
  id: string;
  name: string;
}

const INVERSE: Record<RelationshipType, RelationshipType> = {
  collaborator: 'collaborator',
  mentor: 'mentee',
  mentee: 'mentor',
  stakeholder: 'stakeholder',
};

/** If the target is the source's mentor, the source is the target's mentee. */
export function invertRelationship(relationship: RelationshipType): RelationshipType {
  return INVERSE[relationship];
}

/** Collaborators and stakeholders see the work first-hand; mentors and mentees are opt-in. */
export function isSuggestedReviewer(relationship: RelationshipType): boolean {
  return relationship === 'collaborator' || relationship === 'stakeholder';
}

/** One person's connections from their own side, whichever side created each one. */
export function buildConnectionViews(
  memberId: string,
  connections: readonly Connection[],
  members: readonly NamedMember[],
): ConnectionView[] {
  const names = new Map(members.map((member) => [member.id, member.name]));
  const views: ConnectionView[] = [];
  for (const item of connections) {
    const notes = item.notes ?? '';
    if (item.sourceMemberId === memberId) {
      views.push({
        id: item.id,
        peerId: item.targetMemberId,
        peerName: (item.targetMemberId && names.get(item.targetMemberId)) || item.targetName,
        relationship: item.relationship,
        notes,
        direction: 'outgoing',
      });
    } else if (item.targetMemberId === memberId) {
      views.push({
        id: item.id,
        peerId: item.sourceMemberId,
        peerName: names.get(item.sourceMemberId) ?? '',
        relationship: invertRelationship(item.relationship),
        notes,
        direction: 'incoming',
      });
    }
  }
  return views.filter((view) => view.peerName !== '');
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Team members who have any connection become nodes; edges join two team members. */
export function buildGraph(
  connections: readonly Connection[],
  members: readonly NamedMember[],
): Graph {
  const byId = new Map(members.map((member) => [member.id, member]));
  const connected = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const item of connections) {
    if (!byId.has(item.sourceMemberId)) continue;
    if (item.targetMemberId !== null && !byId.has(item.targetMemberId)) continue;
    connected.add(item.sourceMemberId);
    if (item.targetMemberId !== null) {
      connected.add(item.targetMemberId);
      edges.push({
        source: item.sourceMemberId,
        target: item.targetMemberId,
        relationship: item.relationship,
      });
    }
  }
  const nodes = members
    .filter((member) => connected.has(member.id))
    .map((member) => ({
      id: member.id,
      name: member.name,
      x: 0,
      y: 0,
      color: getAvatarColor(member.name.trim()),
    }));
  return { nodes, edges };
}
