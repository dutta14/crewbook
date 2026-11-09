import { useMemo, useState } from 'react';
import { RELATIONSHIP_LABELS } from '../data/connectionsStore';
import { useForceLayout } from '../hooks/useForceLayout';
import type { GraphEdge, GraphNode } from '../types/connection';
import { getInitials } from '../utils/avatarColor';
import '../styles/connections.css';

const WIDTH = 720;
const HEIGHT = 440;
const NODE_RADIUS = 16;
const LABEL_MAX_LENGTH = 16;

interface NetworkGraphProps {
  /** Team members who have a connection. Positions are worked out here. */
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const truncate = (name: string) =>
  name.length > LABEL_MAX_LENGTH ? `${name.slice(0, LABEL_MAX_LENGTH - 1)}…` : name;

/**
 * The team's connections as a force-directed SVG. Clicking a person highlights who they are
 * connected to and dims everyone else. It is supplementary: the same data is in the lists.
 * Every name is drawn as SVG text, never as markup.
 */
export function NetworkGraph({ nodes, edges }: NetworkGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const laidOut = useForceLayout(nodes, edges, WIDTH, HEIGHT);

  const positions = useMemo(
    () => new Map(laidOut.nodes.map((node) => [node.id, node])),
    [laidOut.nodes],
  );
  const neighbours = useMemo(() => {
    const ids = new Set<string>();
    if (selectedId === null) return ids;
    for (const edge of edges) {
      if (edge.source === selectedId) ids.add(edge.target);
      if (edge.target === selectedId) ids.add(edge.source);
    }
    return ids;
  }, [edges, selectedId]);

  const selected = nodes.find((node) => node.id === selectedId);
  const caption = selected
    ? `${selected.name} selected. ${neighbours.size} connected ${
        neighbours.size === 1 ? 'person' : 'people'
      } highlighted.`
    : '';

  return (
    <div className="network-graph">
      <div role="img" aria-label="Team connection network graph" className="network-graph__frame">
        <svg
          className="network-graph__svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          focusable="false"
          aria-hidden="true"
        >
          <rect
            className="network-graph__background"
            data-testid="graph-background"
            width={WIDTH}
            height={HEIGHT}
            fill="transparent"
            onClick={() => setSelectedId(null)}
          />
          {edges.map((edge) => {
            const from = positions.get(edge.source);
            const to = positions.get(edge.target);
            if (!from || !to) return null;
            const isDimmed =
              selectedId !== null && edge.source !== selectedId && edge.target !== selectedId;
            return (
              <g
                key={`${edge.source}-${edge.target}`}
                className="network-edge"
                data-testid="graph-edge"
                data-dimmed={isDimmed || undefined}
              >
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="network-edge__line" />
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="network-edge__hit" />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 6}
                  textAnchor="middle"
                  className="network-edge__label"
                >
                  {RELATIONSHIP_LABELS[edge.relationship]}
                </text>
              </g>
            );
          })}
          {nodes.map((node) => {
            const position = positions.get(node.id);
            if (!position) return null;
            const isSelected = node.id === selectedId;
            const isDimmed = selectedId !== null && !isSelected && !neighbours.has(node.id);
            return (
              <g
                key={node.id}
                className="network-node"
                data-testid={`graph-node-${node.id}`}
                data-selected={isSelected || undefined}
                data-dimmed={isDimmed || undefined}
                transform={`translate(${position.x} ${position.y})`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(node.id);
                }}
              >
                <circle r={NODE_RADIUS} fill={node.color} className="network-node__circle" />
                <text className="network-node__initials" textAnchor="middle" dy="0.35em">
                  {getInitials(node.name)}
                </text>
                <text className="network-node__label" textAnchor="middle" y={NODE_RADIUS + 16}>
                  {truncate(node.name)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {caption}
      </p>
    </div>
  );
}
