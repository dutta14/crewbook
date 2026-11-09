import { useEffect, useRef, useState } from 'react';
import { RELATIONSHIP_LABELS, type ConnectionUpdate } from '../data/connectionsStore';
import type { TeamMember } from '../types';
import type { ConnectionInput, ConnectionView } from '../types/connection';
import '../styles/button.css';
import '../styles/connections.css';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import { ConnectionFormModal } from './ConnectionFormModal';
import { EmptyState } from './EmptyState';
import { PencilIcon, TeamIcon, TrashIcon } from './icons';

interface PeerConnectionsProps {
  /** Whose profile this is. */
  memberId: string;
  /** Connections from this person's side, including ones the other person added. */
  connections: ConnectionView[];
  members: readonly TeamMember[];
  /** Each callback rejects when the change could not be saved; a ValidationError is shown in the form. */
  onAddConnection: (input: ConnectionInput) => Promise<void>;
  onEditConnection: (id: string, updates: ConnectionUpdate) => Promise<void>;
  onRemoveConnection: (id: string) => Promise<void>;
}

interface FormState {
  isOpen: boolean;
  connection: ConnectionView | null;
}

/** The people one person works closely with. Links are shared, so they show on both profiles. */
export function PeerConnections({
  memberId,
  connections,
  members,
  onAddConnection,
  onEditConnection,
  onRemoveConnection,
}: PeerConnectionsProps) {
  const [form, setForm] = useState<FormState>({ isOpen: false, connection: null });
  // The target is kept while the dialog fades out so its text doesn't change under the visitor.
  const [removing, setRemoving] = useState<ConnectionView | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const needsFocus = useRef(false);
  const isIdle = !form.isOpen && !isConfirming;

  // A saved or removed connection can take the control that had focus with it.
  useEffect(() => {
    if (!isIdle || !needsFocus.current) return;
    needsFocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) headingRef.current?.focus();
  });

  const openAdd = () => setForm({ isOpen: true, connection: null });
  const closeForm = () => setForm((current) => ({ ...current, isOpen: false }));

  const handleSubmit = async (input: ConnectionInput) => {
    const editing = form.connection;
    if (editing) await onEditConnection(editing.id, input);
    else await onAddConnection(input);
    needsFocus.current = true;
    closeForm();
  };

  const handleRemove = async () => {
    const target = removing;
    if (!target) return;
    try {
      await onRemoveConnection(target.id);
      needsFocus.current = true;
    } catch {
      // The failure has already been reported with a toast; the connection stays as it was.
    }
    setIsConfirming(false);
  };

  const avatarFor = (peerId: string | null) =>
    peerId ? members.find((member) => member.id === peerId)?.avatarUrl : undefined;

  return (
    <section className="connections" aria-labelledby="connections-heading">
      <h2 id="connections-heading" ref={headingRef} tabIndex={-1} className="connections__title">
        Connections
      </h2>
      <div className="connections-card">
        {connections.length === 0 ? (
          <EmptyState
            icon={<TeamIcon size={48} />}
            title="No connections yet"
            description="Note who works closely with this person to plan 360 feedback."
            action={{ label: 'Add connection', onClick: openAdd }}
            headingLevel={3}
          />
        ) : (
          <>
            <ul className="connections-list">
              {connections.map((connection) => (
                <li key={connection.id} className="connection-row">
                  <Avatar
                    name={connection.peerName}
                    size="sm"
                    avatarUrl={avatarFor(connection.peerId)}
                    aria-hidden
                  />
                  <div className="connection-row__main">
                    <span className="connection-row__name">{connection.peerName}</span>
                    <span className="connection-badge">
                      {RELATIONSHIP_LABELS[connection.relationship]}
                    </span>
                    {connection.notes ? (
                      <p className="connection-row__notes">{connection.notes}</p>
                    ) : null}
                  </div>
                  <div className="connection-row__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Edit connection with ${connection.peerName}`}
                      onClick={() => setForm({ isOpen: true, connection })}
                    >
                      <PencilIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove connection with ${connection.peerName}`}
                      onClick={() => {
                        setRemoving(connection);
                        setIsConfirming(true);
                      }}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-ghost connections__add"
              aria-label="Add connection"
              onClick={openAdd}
            >
              <span aria-hidden="true">+</span> Add connection
            </button>
          </>
        )}
      </div>
      <ConnectionFormModal
        isOpen={form.isOpen}
        ownerId={memberId}
        members={members}
        connection={form.connection}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />
      <ConfirmDialog
        isOpen={isConfirming}
        title="Remove connection?"
        message={
          removing?.peerId
            ? `Remove the connection with ${removing.peerName}? It will be removed from both profiles.`
            : `Remove the connection with ${removing?.peerName ?? ''}?`
        }
        confirmLabel="Remove"
        onConfirm={() => void handleRemove()}
        onCancel={() => setIsConfirming(false)}
      />
    </section>
  );
}
