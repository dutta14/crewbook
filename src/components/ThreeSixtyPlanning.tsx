import { useId, useMemo, useState } from 'react';
import { RELATIONSHIP_LABELS } from '../data/connectionsStore';
import type { Connection } from '../types/connection';
import {
  buildConnectionViews,
  isSuggestedReviewer,
  type NamedMember,
} from '../utils/connectionViews';
import '../styles/form.css';
import '../styles/connections.css';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { TeamIcon } from './icons';

interface ThreeSixtyPlanningProps {
  members: readonly (NamedMember & { avatarUrl?: string })[];
  connections: readonly Connection[];
}

/**
 * Picks reviewers for one person's 360 from the people they work with. Collaborators and
 * stakeholders start checked. Choices live only in this component's state; leaving the page
 * discards them.
 */
export function ThreeSixtyPlanning({ members, connections }: ThreeSixtyPlanningProps) {
  const selectId = useId();
  const [personId, setPersonId] = useState('');
  // Per person, the connections whose suggestion the manager has flipped.
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [members],
  );
  const person = sorted.find((member) => member.id === personId);
  const views = useMemo(
    () => (person ? buildConnectionViews(person.id, connections, members) : []),
    [person, connections, members],
  );

  const isChecked = (viewId: string, suggested: boolean) =>
    overrides[personId]?.[viewId] ?? suggested;
  const selectedCount = views.filter((view) =>
    isChecked(view.id, isSuggestedReviewer(view.relationship)),
  ).length;

  const toggle = (viewId: string, next: boolean) =>
    setOverrides((current) => ({
      ...current,
      [personId]: { ...current[personId], [viewId]: next },
    }));

  const avatarFor = (peerId: string | null) =>
    peerId ? members.find((member) => member.id === peerId)?.avatarUrl : undefined;

  return (
    <div className="three-sixty">
      <p className="three-sixty__warning">Reviewer selections are not shared with team members</p>
      <div className="form-field three-sixty__select">
        <label className="form-label" htmlFor={selectId}>
          Select team member
        </label>
        <select
          id={selectId}
          className="form-input"
          value={personId}
          onChange={(event) => setPersonId(event.target.value)}
        >
          <option value="">Choose a team member</option>
          {sorted.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      {person && views.length === 0 ? (
        <div className="connections-card">
          <EmptyState
            icon={<TeamIcon size={48} />}
            title="No connections yet"
            description={`Add connections on ${person.name}'s profile to get reviewer suggestions.`}
            headingLevel={2}
          />
        </div>
      ) : null}
      {person && views.length > 0 ? (
        <div className="connections-card">
          <ul className="connections-list" aria-label={`Connections for ${person.name}`}>
            {views.map((view) => (
              <li key={view.id} className="connection-row three-sixty__row">
                <Avatar
                  name={view.peerName}
                  size="sm"
                  avatarUrl={avatarFor(view.peerId)}
                  aria-hidden
                />
                <div className="connection-row__main">
                  <span className="connection-row__name">{view.peerName}</span>
                  <span className="connection-badge">{RELATIONSHIP_LABELS[view.relationship]}</span>
                </div>
                <label className="three-sixty__check">
                  <input
                    type="checkbox"
                    aria-label={`Include ${view.peerName} as reviewer`}
                    checked={isChecked(view.id, isSuggestedReviewer(view.relationship))}
                    onChange={(event) => toggle(view.id, event.target.checked)}
                  />
                  <span>Include as reviewer</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="three-sixty__summary" aria-live="polite">
            {selectedCount} {selectedCount === 1 ? 'reviewer' : 'reviewers'} selected
          </p>
        </div>
      ) : null}
    </div>
  );
}
