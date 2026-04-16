import { createId } from '@paralleldrive/cuid2';
import type {
  Block,
  BlockItem,
  BlockType,
  ChoiceItem,
  Coordinates,
  Edge,
  EdgeFrom,
  EdgeTo,
  Group,
  SabFlowEvent,
  Variable,
  BlockOptions,
} from '@/lib/sabflow/types';

/* ── ID helpers ─────────────────────────────────────────── */

/** Generate a fresh collision-resistant ID.  Called lazily inside `build()`. */
export const id = (): string => createId();

/* ── Block builders ─────────────────────────────────────── */

/**
 * Create a typed block.  Pass in the groupId so `block.groupId` references the
 * parent group correctly — required by the graph engine.
 */
export function makeBlock(
  groupId: string,
  type: BlockType,
  options?: BlockOptions,
  items?: BlockItem[] | ChoiceItem[],
): Block {
  const block: Block = {
    id: id(),
    type,
    groupId,
  };
  if (options) block.options = options;
  if (items) block.items = items as BlockItem[];
  return block;
}

/** Convenience factory for a text bubble block. */
export const textBlock = (groupId: string, content: string): Block =>
  makeBlock(groupId, 'text', { content });

/* ── Group builder ──────────────────────────────────────── */

/**
 * Build a group with a generated id and the given blocks.  Use the returned
 * `addBlock` callback inside the `buildBlocks` builder to insert blocks that
 * reference the parent group's id (needed so `block.groupId` is correct).
 */
export function makeGroup(
  title: string,
  graphCoordinates: Coordinates,
  buildBlocks: (groupId: string) => Block[],
): Group {
  const gid = id();
  return {
    id: gid,
    title,
    graphCoordinates,
    blocks: buildBlocks(gid),
  };
}

/* ── Edge builders ──────────────────────────────────────── */

/**
 * Create an edge between two groups (or from an event → group).
 *
 * `from` and `to` accept either a raw id string (treated as a groupId or eventId)
 * or a structured `{ groupId, blockId?, itemId? }` object.
 */
export function makeEdge(
  from: EdgeFrom,
  to: EdgeTo,
): Edge {
  return { id: id(), from, to };
}

/** Edge starting from the flow's start event, pointing at a group. */
export const edgeFromEvent = (eventId: string, toGroupId: string): Edge =>
  makeEdge({ eventId }, { groupId: toGroupId });

/** Edge from one group to another (default outgoing edge). */
export const edgeBetweenGroups = (fromGroupId: string, toGroupId: string): Edge =>
  makeEdge({ groupId: fromGroupId }, { groupId: toGroupId });

/** Edge from a specific item inside a block (e.g. choice option) → target group. */
export const edgeFromItem = (
  fromGroupId: string,
  fromBlockId: string,
  fromItemId: string,
  toGroupId: string,
): Edge =>
  makeEdge(
    { groupId: fromGroupId, blockId: fromBlockId, itemId: fromItemId },
    { groupId: toGroupId },
  );

/* ── Event builder ──────────────────────────────────────── */

/**
 * Create a start event anchored at the given coordinates.  Every template has
 * exactly one — it's the entry point rendered in the graph.
 */
export function makeStartEvent(coords: Coordinates = { x: 120, y: 80 }): SabFlowEvent {
  return {
    id: id(),
    type: 'start',
    graphCoordinates: coords,
  };
}

/* ── Variable builder ───────────────────────────────────── */

/** Create a simple named variable. */
export const variable = (name: string): Variable => ({ id: id(), name });

/* ── Link a start event + first group ──────────────────── */

/**
 * Attach the start event to a group via an outgoing edge.  Mutates the event
 * in place (sets `outgoingEdgeId`) and returns the edge to push onto the edges
 * array.  This mirrors the pattern used by the in-app editor when wiring up
 * new flows.
 */
export function linkStartToGroup(event: SabFlowEvent, group: Group): Edge {
  const edge = edgeFromEvent(event.id, group.id);
  event.outgoingEdgeId = edge.id;
  return edge;
}

/**
 * Wire consecutive groups linearly — sets each group's last block's
 * `outgoingEdgeId` (or the group's implicit outgoing edge) and returns the
 * generated edges.  We keep this simple: one edge per adjacent pair, no
 * block-level wiring, since the engine also treats group-level edges as the
 * default next step.
 */
export function linkGroupsSequentially(groups: Group[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < groups.length - 1; i += 1) {
    edges.push(edgeBetweenGroups(groups[i].id, groups[i + 1].id));
  }
  return edges;
}
