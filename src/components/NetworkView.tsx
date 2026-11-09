import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTeamConnections } from '../hooks/useConnections';
import { buildGraph } from '../utils/connectionViews';
import '../styles/connections.css';
import { EmptyState } from './EmptyState';
import { TeamIcon } from './icons';
import { NetworkGraph } from './NetworkGraph';
import { NetworkList } from './NetworkList';

/** The whole team's connections. Below 768px the graph is left out and a list stands in. */
export function NetworkView() {
  const { members, connections } = useTeamConnections();
  const navigate = useNavigate();
  const isNarrow = useMediaQuery('(max-width: 767px)');
  const graph = useMemo(() => buildGraph(connections, members), [connections, members]);

  if (graph.nodes.length === 0) {
    return (
      <div className="connections-card">
        <EmptyState
          icon={<TeamIcon size={48} />}
          title="No connections yet"
          description="Add connections on a team member's profile to see how your team works together."
          action={{ label: 'Go to team', onClick: () => navigate('/roster') }}
          headingLevel={2}
        />
      </div>
    );
  }

  if (isNarrow) return <NetworkList members={members} connections={connections} />;

  return (
    <div className="connections-card network-card">
      <NetworkGraph nodes={graph.nodes} edges={graph.edges} />
      <details className="network-card__details">
        <summary>Show connections as a list</summary>
        <NetworkList members={members} connections={connections} />
      </details>
    </div>
  );
}
