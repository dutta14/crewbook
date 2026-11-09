import { useEffect, useMemo, useState } from 'react';
import type { GraphEdge, GraphNode } from '../types/connection';
import { advance, computeLayout, createSimulation, type Simulation } from '../utils/forceLayout';
import { useMediaQuery } from './useMediaQuery';

// 30 frames of 10 steps settle the picture in about half a second.
const TICKS_PER_FRAME = 10;

/**
 * Positions for a force-directed graph. The picture settles over a few animation frames, or
 * is computed in one go when the visitor prefers reduced motion. It only restarts when the
 * nodes or edges change, not when the caller re-renders.
 */
export function useForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const signature = JSON.stringify([
    nodes.map((node) => node.id),
    edges.map((edge) => [edge.source, edge.target]),
  ]);
  // The signature stands in for the arrays, which are new objects on every render.
  /* eslint-disable react-hooks/exhaustive-deps */
  const initial = useMemo(
    () => createSimulation(nodes, edges, width, height),
    [signature, width, height],
  );
  const settled = useMemo(
    () => (reduceMotion ? computeLayout(nodes, edges, width, height) : null),
    [reduceMotion, signature, width, height],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  const [progress, setProgress] = useState<{ from: Simulation; current: Simulation } | null>(null);

  useEffect(() => {
    if (reduceMotion || initial.isSettled) return undefined;
    let current = initial;
    let frame = 0;
    const tick = () => {
      current = advance(current, TICKS_PER_FRAME);
      setProgress({ from: initial, current });
      if (!current.isSettled) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [initial, reduceMotion]);

  const simulation = settled ?? (progress?.from === initial ? progress.current : initial);
  const latest = useMemo(
    () => new Map(simulation.nodes.map((node) => [node.id, node])),
    [simulation],
  );
  // Names and colours come from the caller, so a rename shows without restarting the layout.
  return {
    nodes: nodes.map((node) => ({
      ...node,
      x: latest.get(node.id)?.x ?? 0,
      y: latest.get(node.id)?.y ?? 0,
    })),
    edges,
  };
}
