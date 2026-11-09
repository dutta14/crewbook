import type { GraphEdge, GraphNode } from '../types/connection';

export const MAX_ITERATIONS = 300;
const SETTLE_DISTANCE = 0.1;
const MARGIN_X = 48;
const MARGIN_TOP = 32;
const MARGIN_BOTTOM = 56;

export interface Simulation {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  iteration: number;
  isSettled: boolean;
}

/** Spreads the nodes evenly on a circle, so the same data always starts from the same picture. */
export function createSimulation(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  width: number,
  height: number,
): Simulation {
  const radius = Math.min(width, height) * 0.35;
  const placed = nodes.map((node, index) => {
    if (nodes.length === 1) return { ...node, x: width / 2, y: height / 2 };
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
    return {
      ...node,
      x: width / 2 + radius * Math.cos(angle),
      y: height / 2 + radius * Math.sin(angle),
    };
  });
  return {
    nodes: placed,
    edges: [...edges],
    width,
    height,
    iteration: 0,
    isSettled: nodes.length < 2,
  };
}

/** One Fruchterman-Reingold step: nodes repel, edges pull, and the step size cools to zero. */
function step(sim: Simulation): Simulation {
  const { nodes, edges, width, height, iteration } = sim;
  const k = Math.sqrt((width * height) / nodes.length) * 0.6;
  const temperature = (width / 10) * (1 - iteration / MAX_ITERATIONS);
  const move = nodes.map(() => ({ x: 0, y: 0 }));
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      let dx = nodes[i].x - nodes[j].x;
      let dy = nodes[i].y - nodes[j].y;
      if (dx === 0 && dy === 0) {
        dx = 0.01 * (i + 1);
        dy = 0.01 * (j + 1);
      }
      const distance = Math.hypot(dx, dy);
      const force = (k * k) / distance;
      move[i].x += (dx / distance) * force;
      move[i].y += (dy / distance) * force;
      move[j].x -= (dx / distance) * force;
      move[j].y -= (dy / distance) * force;
    }
  }

  for (const edge of edges) {
    const from = indexById.get(edge.source);
    const to = indexById.get(edge.target);
    if (from === undefined || to === undefined) continue;
    const dx = nodes[from].x - nodes[to].x;
    const dy = nodes[from].y - nodes[to].y;
    const distance = Math.max(Math.hypot(dx, dy), 0.01);
    const force = (distance * distance) / k;
    move[from].x -= (dx / distance) * force;
    move[from].y -= (dy / distance) * force;
    move[to].x += (dx / distance) * force;
    move[to].y += (dy / distance) * force;
  }

  let farthest = 0;
  const next = nodes.map((node, index) => {
    // A light pull to the middle keeps unconnected nodes from drifting to the edge.
    const gx = (width / 2 - node.x) * 0.05;
    const gy = (height / 2 - node.y) * 0.05;
    const dx = move[index].x + gx;
    const dy = move[index].y + gy;
    const length = Math.max(Math.hypot(dx, dy), 0.0001);
    const limited = Math.min(length, temperature);
    const x = Math.min(Math.max(node.x + (dx / length) * limited, MARGIN_X), width - MARGIN_X);
    const y = Math.min(
      Math.max(node.y + (dy / length) * limited, MARGIN_TOP),
      height - MARGIN_BOTTOM,
    );
    farthest = Math.max(farthest, Math.hypot(x - node.x, y - node.y));
    return { ...node, x, y };
  });

  const nextIteration = iteration + 1;
  return {
    ...sim,
    nodes: next,
    iteration: nextIteration,
    isSettled: farthest < SETTLE_DISTANCE || nextIteration >= MAX_ITERATIONS,
  };
}

/** Runs up to `ticks` steps, stopping early once the picture stops moving. */
export function advance(sim: Simulation, ticks: number): Simulation {
  let current = sim;
  for (let i = 0; i < ticks && !current.isSettled; i += 1) current = step(current);
  return current;
}

/** The finished picture, for when motion is reduced. */
export function computeLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  width: number,
  height: number,
): Simulation {
  return advance(createSimulation(nodes, edges, width, height), MAX_ITERATIONS);
}
