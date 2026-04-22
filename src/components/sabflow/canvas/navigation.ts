/**
 * navigation — port of n8n's arrow-key canvas navigation.
 *
 * Finds the best neighbor node in the given direction, preferring connected
 * neighbors (via edges) and falling back to geometric nearest when no
 * connection exists in that direction.
 */
import type { Edge as XYEdge, Node as XYNode } from '@xyflow/react';

export type Direction = 'left' | 'right' | 'up' | 'down';

export function findNeighbor(
  nodes: XYNode[],
  edges: XYEdge[],
  currentId: string,
  direction: Direction,
): string | undefined {
  const current = nodes.find((n) => n.id === currentId);
  if (!current) return undefined;

  // Connected neighbors — favor them when they exist in the direction.
  const neighbors = new Set<string>();
  for (const e of edges) {
    if (e.source === currentId) neighbors.add(e.target);
    if (e.target === currentId) neighbors.add(e.source);
  }

  const candidates = nodes.filter((n) => n.id !== currentId);
  const scored = candidates
    .map((n) => {
      const dx = (n.position.x ?? 0) - (current.position.x ?? 0);
      const dy = (n.position.y ?? 0) - (current.position.y ?? 0);
      let inDirection = false;
      if (direction === 'left') inDirection = dx < -20 && Math.abs(dy) < Math.abs(dx);
      else if (direction === 'right') inDirection = dx > 20 && Math.abs(dy) < Math.abs(dx);
      else if (direction === 'up') inDirection = dy < -20 && Math.abs(dx) < Math.abs(dy);
      else if (direction === 'down') inDirection = dy > 20 && Math.abs(dx) < Math.abs(dy);
      if (!inDirection) return null;
      const distance = Math.hypot(dx, dy);
      const connectedBonus = neighbors.has(n.id) ? -100 : 0;
      return { id: n.id, score: distance + connectedBonus };
    })
    .filter((x): x is { id: string; score: number } => x !== null);

  if (!scored.length) return undefined;
  scored.sort((a, b) => a.score - b.score);
  return scored[0].id;
}
