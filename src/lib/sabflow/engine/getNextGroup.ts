import type { Block, Edge } from '@/lib/sabflow/types';

/**
 * Given the current block and the flow's full edge list, resolve the next
 * group ID to navigate to (if any).
 *
 * Resolution order:
 *  1. If the block has an `outgoingEdgeId`, look up that edge and return its
 *     `to.groupId`.
 *  2. Otherwise return undefined (stay in the current group or end the flow).
 *
 * The optional `preferredEdgeId` parameter is used by the condition block
 * executor when it has already determined which specific edge to follow.
 */
export function getNextGroup(
  block: Block,
  edges: Edge[],
  preferredEdgeId?: string,
): string | undefined {
  const edgeId = preferredEdgeId ?? block.outgoingEdgeId;
  if (!edgeId) return undefined;

  const edge = edges.find((e) => e.id === edgeId);
  if (!edge) return undefined;

  return edge.to.groupId;
}
