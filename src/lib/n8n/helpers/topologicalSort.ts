/**
 * Topological sort of the execution graph using Kahn's algorithm.
 *
 * Returns an ordered array of node names. Nodes that have no ordering
 * constraint relative to each other may appear in any order in their
 * respective "tier".
 *
 * If the graph contains a cycle an error is thrown — cycles are not
 * valid in a synchronous workflow execution (use loops/iterators instead).
 */

import type { GraphNode } from '../types';

export type SortResult = {
  order: string[];
  /** True when the graph had no cycles */
  valid: boolean;
  /** Node names that form the cycle (empty when valid) */
  cycleNodes: string[];
};

export function topologicalSort(graph: Map<string, GraphNode>): SortResult {
  // Build in-degree map
  const inDegree = new Map<string, number>();
  for (const [name] of graph) {
    inDegree.set(name, 0);
  }
  for (const [, entry] of graph) {
    for (const [, targets] of entry.outgoing) {
      for (const target of targets) {
        inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
      }
    }
  }

  // Queue starts with all zero-in-degree nodes
  const queue: string[] = [];
  for (const [name, deg] of inDegree) {
    if (deg === 0) queue.push(name);
  }

  const order: string[] = [];

  while (queue.length > 0) {
    // Sort each batch alphabetically for determinism
    queue.sort();
    const current = queue.shift()!;
    order.push(current);

    const entry = graph.get(current);
    if (!entry) continue;

    for (const [, targets] of entry.outgoing) {
      for (const target of targets) {
        const newDeg = (inDegree.get(target) ?? 0) - 1;
        inDegree.set(target, newDeg);
        if (newDeg === 0) queue.push(target);
      }
    }
  }

  if (order.length < graph.size) {
    // Cycle detected — collect remaining nodes
    const cycleNodes = [...inDegree.entries()]
      .filter(([, deg]) => deg > 0)
      .map(([name]) => name);
    return { order, valid: false, cycleNodes };
  }

  return { order, valid: true, cycleNodes: [] };
}
