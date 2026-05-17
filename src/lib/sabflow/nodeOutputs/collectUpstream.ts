/**
 * Upstream-node discovery for the data picker.
 *
 * Given a flow + a current block id, walks the edge graph backwards (BFS)
 * to find every block whose output could legally feed the current block.
 *
 * Distance is recorded so the picker can sort: direct parents first, then
 * grandparents, etc.  Trigger events (which produce the initial payload)
 * are also surfaced — they're modelled here as synthetic "start" nodes.
 */

import type { Edge, Group, SabFlowDoc, SabFlowEvent } from '@/lib/sabflow/types';

export type UpstreamRef =
  | { kind: 'block'; blockId: string; distance: number }
  | { kind: 'event'; eventId: string; appEvent?: string; distance: number };

/**
 * Returns every block (and trigger event) that can reach `currentBlockId`
 * via the edge graph.  Order: BFS, so direct parents come first.
 *
 * If the current block can't be located, returns an empty list.
 */
export function collectUpstream(
  flow: Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>,
  currentBlockId: string,
): UpstreamRef[] {
  const adjacency = buildReverseAdjacency(flow.groups, flow.edges, flow.events ?? []);
  // `seen` is shared across the entire BFS so a node visited at any distance
  // never gets added a second time, even when multiple edges converge on it.
  const seen = new Set<string>([currentBlockId]);
  const out: UpstreamRef[] = [];

  // Queue items are tagged with the cumulative distance.
  let frontier: Array<{ id: string; kind: 'block' | 'event'; distance: number }> = [
    { id: currentBlockId, kind: 'block', distance: 0 },
  ];

  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const parents = adjacency.get(node.id) ?? [];
      // Dedupe parent list locally too, since a single edge object cannot
      // appear twice, but two distinct edges may share endpoints.
      const localSeen = new Set<string>();
      for (const parent of parents) {
        if (localSeen.has(parent.id)) continue;
        localSeen.add(parent.id);
        if (seen.has(parent.id)) continue;
        seen.add(parent.id);
        const distance = node.distance + 1;
        if (parent.kind === 'block') {
          out.push({ kind: 'block', blockId: parent.id, distance });
        } else {
          const evt = (flow.events ?? []).find((e) => e.id === parent.id);
          out.push({
            kind: 'event',
            eventId: parent.id,
            appEvent: evt?.appEvent,
            distance,
          });
        }
        next.push({ id: parent.id, kind: parent.kind, distance });
      }
    }
    frontier = next;
  }

  return out;
}

/**
 * Builds a reverse-adjacency map: `nodeId → list of parents` (blocks or events).
 *
 * Edges in SabFlow can target either a block or just a group; when targeting
 * a group, we treat every block in that group as a downstream sink so the
 * picker still works for legacy group-level wiring.
 */
function buildReverseAdjacency(
  groups: Group[],
  edges: Edge[],
  events: SabFlowEvent[],
): Map<string, Array<{ id: string; kind: 'block' | 'event' }>> {
  const adj = new Map<string, Array<{ id: string; kind: 'block' | 'event' }>>();
  const blocksByGroup = new Map<string, string[]>();

  for (const group of groups) {
    blocksByGroup.set(
      group.id,
      group.blocks.map((b) => b.id),
    );
  }

  const eventIds = new Set(events.map((e) => e.id));

  const push = (
    targetId: string,
    source: { id: string; kind: 'block' | 'event' },
  ) => {
    const list = adj.get(targetId);
    if (list) list.push(source);
    else adj.set(targetId, [source]);
  };

  for (const edge of edges) {
    const source: { id: string; kind: 'block' | 'event' } | null =
      edge.from.eventId
        ? { id: edge.from.eventId, kind: 'event' }
        : edge.from.blockId
        ? { id: edge.from.blockId, kind: 'block' }
        : null;

    if (!source) continue;
    // Skip "blocks" that are really event ids in disguise.
    if (source.kind === 'block' && eventIds.has(source.id)) {
      source.kind = 'event';
    }

    if (edge.to.blockId) {
      push(edge.to.blockId, source);
    } else if (edge.to.groupId) {
      const sinks = blocksByGroup.get(edge.to.groupId) ?? [];
      for (const sinkId of sinks) push(sinkId, source);
    }
  }

  return adj;
}
