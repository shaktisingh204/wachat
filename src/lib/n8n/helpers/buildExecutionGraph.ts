/**
 * Converts an N8NWorkflow's nodes + connections into a GraphNode map
 * that the executor can traverse.
 */

import type { N8NWorkflow, N8NNode, GraphNode } from '../types';

export function buildExecutionGraph(workflow: N8NWorkflow): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  // Initialise every node with empty adjacency
  for (const node of workflow.nodes) {
    graph.set(node.name, {
      node,
      incomingFrom: [],
      outgoing: new Map(),
    });
  }

  // connections structure:
  //   connections[sourceName][connectionType][outputIndex] = [{ node, type, index }, ...]
  for (const [sourceName, byType] of Object.entries(workflow.connections)) {
    const sourceEntry = graph.get(sourceName);
    if (!sourceEntry) continue;

    for (const [, byOutputIndex] of Object.entries(byType)) {
      byOutputIndex.forEach((targets, outputIndex) => {
        if (!targets) return;
        for (const target of targets) {
          const targetEntry = graph.get(target.node);
          if (!targetEntry) continue;

          // Record outgoing edge from source
          const existing = sourceEntry.outgoing.get(outputIndex) ?? [];
          existing.push(target.node);
          sourceEntry.outgoing.set(outputIndex, existing);

          // Record incoming edge on target
          if (!targetEntry.incomingFrom.includes(sourceName)) {
            targetEntry.incomingFrom.push(sourceName);
          }
        }
      });
    }
  }

  return graph;
}

/**
 * Find all trigger/start nodes in the graph.
 * A trigger node has no incoming edges.
 */
export function findTriggerNodes(graph: Map<string, GraphNode>): N8NNode[] {
  const triggers: N8NNode[] = [];
  for (const entry of graph.values()) {
    if (entry.incomingFrom.length === 0) {
      triggers.push(entry.node);
    }
  }
  return triggers;
}
