import { describe, expect, it } from 'vitest';
import type { Connection } from '../types/connection';
import { createConnection } from '../test-utils/factories';
import {
  buildConnectionViews,
  buildGraph,
  invertRelationship,
  isSuggestedReviewer,
} from './connectionViews';
import { MAX_ITERATIONS, advance, computeLayout, createSimulation } from './forceLayout';

const members = [
  { id: 'a', name: 'Alex Chen' },
  { id: 'b', name: 'Priya Nair' },
  { id: 'c', name: 'Sam Okoye' },
];

describe('invertRelationship and isSuggestedReviewer', () => {
  it('swaps mentor and mentee and leaves the symmetric types alone', () => {
    expect(invertRelationship('mentor')).toBe('mentee');
    expect(invertRelationship('mentee')).toBe('mentor');
    expect(invertRelationship('collaborator')).toBe('collaborator');
    expect(invertRelationship('stakeholder')).toBe('stakeholder');
  });

  it('suggests collaborators and stakeholders only', () => {
    expect(isSuggestedReviewer('collaborator')).toBe(true);
    expect(isSuggestedReviewer('stakeholder')).toBe(true);
    expect(isSuggestedReviewer('mentor')).toBe(false);
    expect(isSuggestedReviewer('mentee')).toBe(false);
  });
});

describe('buildConnectionViews', () => {
  const stored: Connection[] = [
    createConnection({
      id: '1',
      sourceMemberId: 'a',
      targetMemberId: 'b',
      targetName: 'Old Name',
      relationship: 'mentor',
      notes: 'Weekly',
    }),
    createConnection({
      id: '2',
      sourceMemberId: 'a',
      targetMemberId: null,
      targetName: 'Jo Rivera',
      relationship: 'stakeholder',
    }),
    createConnection({
      id: '3',
      sourceMemberId: 'c',
      targetMemberId: 'c2',
      relationship: 'mentee',
    }),
  ];

  it("shows the source's own side with the live roster name", () => {
    const views = buildConnectionViews('a', stored, members);

    expect(views).toEqual([
      {
        id: '1',
        peerId: 'b',
        peerName: 'Priya Nair',
        relationship: 'mentor',
        notes: 'Weekly',
        direction: 'outgoing',
      },
      {
        id: '2',
        peerId: null,
        peerName: 'Jo Rivera',
        relationship: 'stakeholder',
        notes: '',
        direction: 'outgoing',
      },
    ]);
  });

  it('shows the other side from the target with the relationship turned around', () => {
    expect(buildConnectionViews('b', stored, members)).toEqual([
      {
        id: '1',
        peerId: 'a',
        peerName: 'Alex Chen',
        relationship: 'mentee',
        notes: 'Weekly',
        direction: 'incoming',
      },
    ]);
  });

  it('drops an incoming link whose source is not on the team', () => {
    const orphan = [createConnection({ sourceMemberId: 'gone', targetMemberId: 'a' })];

    expect(buildConnectionViews('a', orphan, members)).toEqual([]);
  });
});

describe('buildGraph', () => {
  it('makes nodes of connected team members and edges between team members only', () => {
    const graph = buildGraph(
      [
        createConnection({ sourceMemberId: 'a', targetMemberId: 'b', relationship: 'mentor' }),
        createConnection({ sourceMemberId: 'c', targetMemberId: null, targetName: 'Jo' }),
        createConnection({ sourceMemberId: 'a', targetMemberId: 'gone' }),
      ],
      members,
    );

    expect(graph.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c']);
    expect(graph.edges).toEqual([{ source: 'a', target: 'b', relationship: 'mentor' }]);
    expect(graph.nodes[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is empty when nobody has a connection', () => {
    expect(buildGraph([], members)).toEqual({ nodes: [], edges: [] });
  });
});

describe('forceLayout', () => {
  const { nodes, edges } = buildGraph(
    [
      createConnection({ sourceMemberId: 'a', targetMemberId: 'b' }),
      createConnection({ sourceMemberId: 'b', targetMemberId: 'c' }),
    ],
    members,
  );

  it('starts from the same circle every time', () => {
    const first = createSimulation(nodes, edges, 720, 440);
    const second = createSimulation(nodes, edges, 720, 440);

    expect(first.nodes.map(({ x, y }) => [x, y])).toEqual(second.nodes.map(({ x, y }) => [x, y]));
    expect(first.iteration).toBe(0);
  });

  it('puts a single node in the middle and treats it as settled', () => {
    const sim = createSimulation(nodes.slice(0, 1), [], 720, 440);

    expect(sim.nodes[0]).toMatchObject({ x: 360, y: 220 });
    expect(sim.isSettled).toBe(true);
  });

  it('settles within the iteration cap and keeps every node inside the frame', () => {
    const sim = computeLayout(nodes, edges, 720, 440);

    expect(sim.isSettled).toBe(true);
    expect(sim.iteration).toBeLessThanOrEqual(MAX_ITERATIONS);
    for (const node of sim.nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(720);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(440);
    }
  });

  it('advances only as many steps as asked and stops once settled', () => {
    const start = createSimulation(nodes, edges, 720, 440);

    expect(advance(start, 3).iteration).toBe(3);
    const done = computeLayout(nodes, edges, 720, 440);
    expect(advance(done, 10)).toBe(done);
  });

  it('keeps nodes apart when they start on the same spot', () => {
    const stacked = nodes.map((node) => ({ ...node, x: 100, y: 100 }));
    const sim = { ...createSimulation(stacked, [], 720, 440), nodes: stacked };

    const after = advance(sim, 5);

    expect(new Set(after.nodes.map((node) => `${node.x},${node.y}`)).size).toBe(nodes.length);
  });
});
