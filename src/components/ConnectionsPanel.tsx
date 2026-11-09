import { useConnections } from '../hooks/useConnections';
import { PeerConnections } from './PeerConnections';
import { PrivateGate } from './PrivateGate';

/** One person's connections for their profile. */
export function ConnectionsPanel({ memberId }: { memberId: string }) {
  return (
    <PrivateGate label="connections">
      <MemberConnections memberId={memberId} />
    </PrivateGate>
  );
}

function MemberConnections({ memberId }: { memberId: string }) {
  const { connections, members, addConnection, editConnection, removeConnection } =
    useConnections(memberId);
  return (
    <PeerConnections
      memberId={memberId}
      connections={connections}
      members={members}
      onAddConnection={addConnection}
      onEditConnection={editConnection}
      onRemoveConnection={removeConnection}
    />
  );
}
