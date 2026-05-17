/**
 * Build the workspace-wide `typebot_link` call graph.
 *
 * Walks every flow in the caller's workspace, finds every `typebot_link`
 * block, resolves its `options.flowId` to the linked SabFlowDoc, and emits
 * a directed edge `caller → callee`.
 *
 * Pure — no DB / fetch — so the same module can power both the dashboard
 * page (server-rendered) and a future GraphQL-style introspection API.
 */

import type { SabFlowDoc } from '@/lib/sabflow/types';

export type LinkNode = {
  flowId: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  /** Number of typebot_link blocks pointing OUT of this flow. */
  outDegree: number;
  /** Number of typebot_link blocks pointing IN to this flow. */
  inDegree: number;
};

export type LinkEdge = {
  /** Caller flow id. */
  from: string;
  /** Callee flow id (string — may not resolve to a known flow). */
  to: string;
  /** Block id of the typebot_link node inside the caller. */
  blockId: string;
  /** True when `to` doesn't match any flow in the input set. */
  isDangling: boolean;
};

export type CallGraph = {
  nodes: LinkNode[];
  edges: LinkEdge[];
};

/**
 * Build the call graph from a list of flows.
 *
 * @param flows Every SabFlowDoc in the workspace (already authorised).
 */
export function buildCallGraph(flows: SabFlowDoc[]): CallGraph {
  const byId = new Map<string, SabFlowDoc>();
  for (const f of flows) {
    const id = f._id?.toString();
    if (id) byId.set(id, f);
  }

  const edges: LinkEdge[] = [];
  const outCounts = new Map<string, number>();
  const inCounts = new Map<string, number>();

  for (const caller of flows) {
    const callerId = caller._id?.toString();
    if (!callerId) continue;
    for (const group of caller.groups ?? []) {
      for (const block of group.blocks ?? []) {
        if (block.type !== 'typebot_link') continue;
        const targetId =
          (block.options as { flowId?: string } | undefined)?.flowId;
        if (!targetId) continue;
        edges.push({
          from: callerId,
          to: targetId,
          blockId: block.id,
          isDangling: !byId.has(targetId),
        });
        outCounts.set(callerId, (outCounts.get(callerId) ?? 0) + 1);
        if (byId.has(targetId)) {
          inCounts.set(targetId, (inCounts.get(targetId) ?? 0) + 1);
        }
      }
    }
  }

  const nodes: LinkNode[] = flows
    // Only include flows that participate in the graph — keeps the view
    // tight on workspaces with many unrelated flows.
    .filter((f) => {
      const id = f._id?.toString();
      if (!id) return false;
      return (outCounts.get(id) ?? 0) > 0 || (inCounts.get(id) ?? 0) > 0;
    })
    .map((f) => {
      const id = f._id!.toString();
      return {
        flowId: id,
        name: f.name,
        status: f.status,
        outDegree: outCounts.get(id) ?? 0,
        inDegree: inCounts.get(id) ?? 0,
      };
    });

  return { nodes, edges };
}

/** Returns the connected component of a node, expressed as a Set of flowIds. */
export function connectedComponent(
  graph: CallGraph,
  startFlowId: string,
): Set<string> {
  const adj = new Map<string, Set<string>>();
  const ensure = (id: string) => {
    let s = adj.get(id);
    if (!s) {
      s = new Set();
      adj.set(id, s);
    }
    return s;
  };
  for (const e of graph.edges) {
    ensure(e.from).add(e.to);
    ensure(e.to).add(e.from);
  }
  const seen = new Set<string>([startFlowId]);
  const queue = [startFlowId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const peer of adj.get(id) ?? []) {
      if (seen.has(peer)) continue;
      seen.add(peer);
      queue.push(peer);
    }
  }
  return seen;
}
