import { useId, useRef, useState, type FormEvent } from 'react';
import {
  CONNECTION_NOTES_MAX_LENGTH,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  isRelationshipType,
} from '../data/connectionsStore';
import { ValidationError } from '../data/errors';
import type { TeamMember } from '../types';
import type { ConnectionInput, ConnectionView, RelationshipType } from '../types/connection';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/connections.css';
import { FormField } from './FormField';
import { Modal } from './Modal';
import { PeerCombobox } from './PeerCombobox';

interface ConnectionFormModalProps {
  isOpen: boolean;
  /** The person whose profile this is; they can't be their own peer. */
  ownerId: string;
  members: readonly TeamMember[];
  /** Set when editing; otherwise the form adds a connection. */
  connection?: ConnectionView | null;
  /** Saves the connection. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (input: ConnectionInput) => Promise<void>;
  onClose: () => void;
}

interface Values {
  name: string;
  peerId: string | null;
  relationship: RelationshipType;
  notes: string;
}

const emptyValues = (): Values => ({
  name: '',
  peerId: null,
  relationship: 'collaborator',
  notes: '',
});

const valuesFor = (connection: ConnectionView | null | undefined): Values =>
  connection
    ? {
        name: connection.peerName,
        peerId: connection.peerId,
        relationship: connection.relationship,
        notes: connection.notes,
      }
    : emptyValues();

/** Adds a connection or edits one. The caller closes it once `onSubmit` resolves. */
export function ConnectionFormModal({
  isOpen,
  ownerId,
  members,
  connection,
  onSubmit,
  onClose,
}: ConnectionFormModalProps) {
  const prefix = useId();
  const formId = `${prefix}-form`;
  const ids = { peer: `${prefix}-peer`, type: `${prefix}-type`, notes: `${prefix}-notes` };
  const [values, setValues] = useState<Values>(() => valuesFor(connection));
  const [peerError, setPeerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const peerRef = useRef<HTMLDivElement>(null);

  // Every time the dialog opens it starts from the connection being edited, or from blank.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(valuesFor(connection));
      setPeerError('');
      setIsSubmitting(false);
    }
  }

  const isEditing = Boolean(connection);
  // Only the person who added a link can change who it is with.
  const isPeerLocked = connection?.direction === 'incoming';
  const candidates = members.filter((member) => member.id !== ownerId);

  const focusPeer = () => peerRef.current?.querySelector('input')?.focus();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const name = values.name.trim();
    if (name === '') {
      setPeerError('Enter a peer name');
      focusPeer();
      return;
    }
    // Typing a team member's name in full counts as picking them.
    const rosterMatch =
      values.peerId === null && !isPeerLocked
        ? candidates.find((member) => member.name.toLowerCase() === name.toLowerCase())
        : undefined;
    const isSelf = members.some(
      (member) => member.id === ownerId && member.name.toLowerCase() === name.toLowerCase(),
    );
    if (isSelf && values.peerId === null) {
      setPeerError("A person can't be connected to themselves");
      focusPeer();
      return;
    }
    const peerId = rosterMatch?.id ?? values.peerId;
    setPeerError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        targetMemberId: peerId,
        targetName: rosterMatch?.name ?? name,
        relationship: values.relationship,
        notes: values.notes,
      });
    } catch (error) {
      // The data layer re-validates; its messages never include what was typed. Anything else has
      // already been reported with a toast.
      if (error instanceof ValidationError) {
        setPeerError(error.message);
        focusPeer();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit connection' : 'Add connection'}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={isSubmitting}>
            Save Connection
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="connection-form"
        noValidate
        autoComplete="off"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <FormField id={ids.peer} label="Peer name" required error={peerError}>
          <div ref={peerRef}>
            <PeerCombobox
              id={ids.peer}
              value={values.name}
              members={candidates}
              disabled={isPeerLocked}
              invalid={peerError !== ''}
              describedBy={peerError ? `${ids.peer}-error` : undefined}
              onChange={(name, peerId) => {
                setValues((current) => ({ ...current, name, peerId }));
                setPeerError('');
              }}
            />
          </div>
        </FormField>
        <FormField id={ids.type} label="Relationship type">
          <select
            id={ids.type}
            className="form-input"
            value={values.relationship}
            onChange={(event) => {
              const { value } = event.target;
              if (isRelationshipType(value)) {
                setValues((current) => ({ ...current, relationship: value }));
              }
            }}
          >
            {RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {RELATIONSHIP_LABELS[type]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={ids.notes} label="Notes (optional)">
          <textarea
            id={ids.notes}
            className="form-input connection-form__notes"
            autoComplete="off"
            rows={3}
            maxLength={CONNECTION_NOTES_MAX_LENGTH}
            value={values.notes}
            onChange={(event) => {
              const { value } = event.target;
              setValues((current) => ({ ...current, notes: value }));
            }}
          />
        </FormField>
      </form>
    </Modal>
  );
}
