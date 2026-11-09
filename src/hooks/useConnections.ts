import { useCallback, useMemo } from 'react';
import {
  createConnection,
  deleteConnection,
  getAllConnections,
  updateConnection,
  type ConnectionUpdate,
} from '../data/connectionsStore';
import { ValidationError } from '../data/errors';
import { listMembers } from '../data/members';
import type { Connection, ConnectionInput, ConnectionView } from '../types/connection';
import type { TeamMember } from '../types';
import { buildConnectionViews, invertRelationship } from '../utils/connectionViews';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that connection. Try again.";
const DELETE_FAILED = "Couldn't remove that connection. Try again.";

export interface UseConnections {
  /** This person's connections from their own side, including ones the other person added. */
  connections: ConnectionView[];
  /** The team, for suggesting peers. */
  members: TeamMember[];
  /**
   * Every write waits for the encrypted store, so the screen only changes once it has landed.
   * A failed write rolls back and shows an error toast, then rejects so the caller can stand
   * down. A ValidationError rejects without a toast; the form reports it next to the field.
   * Needs the private envelope to be open; see usePrivateEnvelope.
   */
  addConnection: (input: ConnectionInput) => Promise<void>;
  /** Updates are from this person's side; the stored direction is worked out here. */
  editConnection: (id: string, updates: ConnectionUpdate) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
}

export function useConnections(memberId: string): UseConnections {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const members = useMemo(() => listMembers(storage), [storage]);
  const connections = useMemo(
    () => buildConnectionViews(memberId, getAllConnections(storage), members),
    [storage, memberId, members],
  );

  const run = useCallback(
    async (operation: () => Promise<unknown>, failure: string) => {
      try {
        await operation();
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(failure, 'error');
        throw error;
      }
    },
    [showToast],
  );

  const addConnection = useCallback(
    (input: ConnectionInput) => run(() => createConnection(memberId, input, storage), SAVE_FAILED),
    [run, memberId, storage],
  );

  const editConnection = useCallback(
    (id: string, updates: ConnectionUpdate) => {
      const view = connections.find((item) => item.id === id);
      // The other person's side can change how they relate to this person, not who they are.
      const stored: ConnectionUpdate =
        view?.direction === 'incoming'
          ? {
              ...(updates.relationship
                ? { relationship: invertRelationship(updates.relationship) }
                : {}),
              ...('notes' in updates ? { notes: updates.notes } : {}),
            }
          : updates;
      return run(() => updateConnection(id, stored, storage), SAVE_FAILED);
    },
    [run, storage, connections],
  );

  const removeConnection = useCallback(
    (id: string) => run(() => deleteConnection(id, storage), DELETE_FAILED),
    [run, storage],
  );

  return { connections, members, addConnection, editConnection, removeConnection };
}

export interface TeamConnections {
  members: TeamMember[];
  connections: Connection[];
}

/** Everyone's connections for the network and 360 views. Needs the private envelope to be open. */
export function useTeamConnections(): TeamConnections {
  const storage = useEncryptedStorage();
  return useMemo(
    () => ({ members: listMembers(storage), connections: getAllConnections(storage) }),
    [storage],
  );
}
