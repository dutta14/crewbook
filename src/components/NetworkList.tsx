import { useId } from 'react';
import { RELATIONSHIP_LABELS } from '../data/connectionsStore';
import type { Connection } from '../types/connection';
import { buildConnectionViews, type NamedMember } from '../utils/connectionViews';
import '../styles/connections.css';

interface NetworkListProps {
  members: readonly NamedMember[];
  connections: readonly Connection[];
}

/** The same connections as the graph, as text, grouped by person. */
export function NetworkList({ members, connections }: NetworkListProps) {
  const prefix = useId();
  const groups = [...members]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((member) => ({ member, views: buildConnectionViews(member.id, connections, members) }))
    .filter((group) => group.views.length > 0);

  return (
    <div className="network-list">
      {groups.map(({ member, views }) => {
        const headingId = `${prefix}-${member.id}`;
        return (
          <section key={member.id} className="network-list__group" aria-labelledby={headingId}>
            <h3 id={headingId} className="network-list__person">
              {member.name}
            </h3>
            <ul className="network-list__items">
              {views.map((view) => (
                <li key={view.id} className="network-list__item">
                  <span className="network-list__peer">{view.peerName}</span>
                  <span className="connection-badge">{RELATIONSHIP_LABELS[view.relationship]}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
