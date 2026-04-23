/**
 * Adapter: SabFlowDoc ({ groups[blocks], events, edges }) ↔ flat
 * @xyflow/react `{ nodes, edges }` — letting us render n8n's atomic-node
 * model on top of Typebot's group-container model without touching the
 * persistence format.
 *
 * Rules:
 *  - Each block becomes exactly one canvas node. The canvas node ID = block.id.
 *  - Each event becomes a trigger-style canvas node. ID = event.id.
 *  - Block position = block.graphCoordinates ?? (group.graphCoordinates +
 *    (blockIndex * (DEFAULT_NODE_HEIGHT + GRID_SIZE))). We read from both but
 *    only persist back to block.graphCoordinates going forward.
 *  - Edges map existing `{from,to}` form — preserving sourceHandle/targetHandle
 *    when present, synthesising defaults when not. For legacy group-level
 *    edges (no blockId), we resolve source/target to the first/last block in
 *    the referenced group.
 */
import type {
  Annotation,
  Block,
  Coordinates,
  Edge as SabEdge,
  EdgeStatus,
  Group,
  NodePort,
  SabFlowDoc,
  SabFlowEvent,
} from '@/lib/sabflow/types';
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE, getDefaultPorts } from '@/lib/sabflow/ports';
import { blockRegistryMap } from '@/components/sabflow/editor/blockRegistry';
import {
  DEFAULT_NODE_HEIGHT,
  GRID_SIZE,
} from './constants';
import { createCanvasConnectionId } from './utils';
import type { CanvasEdge, CanvasNode, CanvasNodeData } from './types';
import { CanvasNodeRenderType } from './types';

/* ── Position helpers ─────────────────────────────────────── */

/** Compute the canvas (x,y) for a block — prefers its own coordinates, falls
 *  back to group.graphCoordinates + vertical-index offset for backwards compat. */
export function resolveBlockPosition(
  block: Block & { graphCoordinates?: Coordinates },
  group: Group,
  blockIndex: number,
): Coordinates {
  const own = (block as { graphCoordinates?: Coordinates }).graphCoordinates;
  if (own) return own;
  const x = group.graphCoordinates.x;
  const y =
    group.graphCoordinates.y +
    blockIndex * (DEFAULT_NODE_HEIGHT + GRID_SIZE);
  return { x, y };
}

/* ── Port resolution ──────────────────────────────────────── */

function resolveInputs(block: Block): NodePort[] {
  if (block.inputPorts && block.inputPorts.length) return block.inputPorts;
  return getDefaultPorts(block.type).inputs;
}
function resolveOutputs(block: Block): NodePort[] {
  if (block.outputPorts && block.outputPorts.length) return block.outputPorts;
  return getDefaultPorts(block.type).outputs;
}

/** Trigger events always have 0 inputs + 1 main output. */
function triggerPorts(): { inputs: NodePort[]; outputs: NodePort[] } {
  return {
    inputs: [],
    outputs: [
      { id: 'outputs/main/0', mode: 'output', type: 'main', index: 0 },
    ],
  };
}

/* ── Label/subtitle ───────────────────────────────────────── */

function blockLabel(block: Block): string {
  const entry = blockRegistryMap.get(block.type);
  return entry?.label ?? block.type;
}
function blockSubtitle(block: Block): string | undefined {
  const opts = (block.options ?? {}) as Record<string, unknown>;
  if (typeof opts.title === 'string' && opts.title.trim()) return opts.title.trim();
  if (typeof opts.name === 'string' && opts.name.trim()) return opts.name.trim();
  return undefined;
}

function eventLabel(event: SabFlowEvent): string {
  if (event.type === 'start') return 'When flow starts';
  if (event.type === 'webhook') return 'On webhook';
  if (event.type === 'schedule') return 'On schedule';
  if (event.type === 'manual') return 'Manual trigger';
  if (event.type === 'error') return 'On error';
  return 'Trigger';
}

/* ── Core: SabFlowDoc → canvas nodes + edges ─────────────── */

export function flowDocToCanvas(flow: SabFlowDoc): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  /* Nodes — triggers first, then block-nodes. */
  const nodes: CanvasNode[] = [];

  for (const event of flow.events ?? []) {
    const { inputs, outputs } = triggerPorts();
    const connected = (flow.edges ?? []).some(
      (e) => 'eventId' in e.from && e.from.eventId === event.id,
    );
    const data: CanvasNodeData = {
      id: event.id,
      label: eventLabel(event),
      subtitle: event.type,
      type: `event:${event.type}`,
      isTrigger: true,
      disabled: false,
      pinned: false,
      inputs,
      outputs,
      execution: {},
      event,
      render: CanvasNodeRenderType.Trigger,
      // Trigger nodes with no downstream edge get a visual "wire me up" hint.
      isUnconnected: !connected,
    };
    nodes.push({
      id: event.id,
      type: 'canvasNode',
      position: event.graphCoordinates,
      data,
    });
  }

  /* Sticky-note annotations — their own node type, won't show handles. */
  for (const note of flow.annotations ?? []) {
    if (note.type !== 'sticky_note') continue;
    // Sticky data shape is deliberately loose — it's dispatched by node type
    // (`canvasSticky`) so the narrow `CanvasNodeData` shape doesn't apply.
    // We DO NOT put width/height on the node object; React Flow would then
    // try to enforce them against the measured DOM size and feed a resize
    // loop. The component picks them up from `data.width` / `data.height`.
    nodes.push({
      id: note.id,
      type: 'canvasSticky',
      position: note.graphCoordinates,
      data: {
        id: note.id,
        content: note.content ?? '',
        color: note.color ?? 'yellow',
        width: note.width ?? 240,
        height: note.height ?? 160,
        isSticky: true,
      } as unknown as CanvasNodeData,
      zIndex: -1,
    });
  }

  /* For every group, iterate its blocks in order. */
  const blockById = new Map<string, { block: Block; group: Group; index: number }>();
  for (const group of flow.groups ?? []) {
    (group.blocks ?? []).forEach((block, index) => {
      blockById.set(block.id, { block, group, index });
      const position = resolveBlockPosition(block, group, index);
      const data: CanvasNodeData = {
        id: block.id,
        label: blockLabel(block),
        subtitle: blockSubtitle(block),
        type: block.type,
        blockType: block.type,
        isTrigger: false,
        disabled: false,
        pinned: block.pinData !== undefined,
        inputs: resolveInputs(block),
        outputs: resolveOutputs(block),
        execution: {},
        block,
        render: CanvasNodeRenderType.Default,
      };
      nodes.push({
        id: block.id,
        type: 'canvasNode',
        position,
        data,
      });
    });
  }

  /* Edges — use sourceHandle/targetHandle if already stored; otherwise default. */
  const edges: CanvasEdge[] = [];
  for (const e of flow.edges ?? []) {
    const src = resolveEdgeSource(e, flow, blockById);
    const tgt = resolveEdgeTarget(e, flow, blockById);
    if (!src || !tgt) continue;

    const sourceHandle = e.sourceHandle ?? DEFAULT_SOURCE_HANDLE;
    const targetHandle = e.targetHandle ?? DEFAULT_TARGET_HANDLE;

    edges.push({
      id:
        e.id ||
        createCanvasConnectionId({ source: src, sourceHandle, target: tgt, targetHandle }),
      source: src,
      target: tgt,
      sourceHandle,
      targetHandle,
      type: 'canvasEdge',
      data: {
        source: parseHandle(sourceHandle),
        target: parseHandle(targetHandle),
        status: e.status as EdgeStatus | undefined,
      },
    });
  }

  return { nodes, edges };
}

function parseHandle(h: string): { type: string; index: number } {
  const parts = h.split('/');
  return { type: parts[1] ?? 'main', index: Number(parts[2] ?? 0) };
}

function resolveEdgeSource(
  e: SabEdge,
  flow: SabFlowDoc,
  blockById: Map<string, { block: Block; group: Group; index: number }>,
): string | undefined {
  if ('eventId' in e.from && e.from.eventId) return e.from.eventId;
  if ('blockId' in e.from && e.from.blockId) return e.from.blockId;
  // Legacy group-level edge — point from the last block of the group
  if ('groupId' in e.from && e.from.groupId) {
    const group = flow.groups?.find((g) => g.id === e.from.groupId);
    const last = group?.blocks[group.blocks.length - 1];
    if (last) return last.id;
  }
  return undefined;
}

function resolveEdgeTarget(
  e: SabEdge,
  flow: SabFlowDoc,
  blockById: Map<string, { block: Block; group: Group; index: number }>,
): string | undefined {
  if (e.to.blockId) return e.to.blockId;
  // Legacy: target the first block of the group
  const group = flow.groups?.find((g) => g.id === e.to.groupId);
  return group?.blocks[0]?.id;
}

/* ── Canvas ops → mutate SabFlowDoc ──────────────────────── */

/**
 * Apply a position change for a single canvas node back into the flow doc.
 * If node is an event, update event.graphCoordinates. If it's a block, store
 * graphCoordinates on the block itself (promoting groups to act as pure
 * containers — the group's own coords become meaningless once blocks own theirs).
 */
export function applyNodePosition(
  flow: SabFlowDoc,
  nodeId: string,
  position: Coordinates,
): SabFlowDoc {
  const events = flow.events?.map((ev) =>
    ev.id === nodeId ? { ...ev, graphCoordinates: position } : ev,
  );
  let blockUpdated = false;
  const groups = flow.groups?.map((g) => {
    const blocks = g.blocks.map((b) => {
      if (b.id === nodeId) {
        blockUpdated = true;
        return { ...b, graphCoordinates: position } as Block;
      }
      return b;
    });
    return blocks === g.blocks ? g : { ...g, blocks };
  });
  const annotations = flow.annotations?.map((a) =>
    a.id === nodeId ? { ...a, graphCoordinates: position } : a,
  );
  if (!blockUpdated) {
    return {
      ...flow,
      events: events ?? flow.events,
      annotations: annotations ?? flow.annotations,
    };
  }
  return {
    ...flow,
    events: events ?? flow.events,
    groups: groups ?? flow.groups,
    annotations: annotations ?? flow.annotations,
  };
}

/** Apply bulk position changes in one pass. */
export function applyBulkNodePositions(
  flow: SabFlowDoc,
  updates: Array<{ id: string; position: Coordinates }>,
): SabFlowDoc {
  let out = flow;
  for (const u of updates) out = applyNodePosition(out, u.id, u.position);
  return out;
}

/* ── Start-event helpers ─────────────────────────────── */

/** Does the flow have at least one trigger event (start/webhook/schedule/manual)? */
export function hasTriggerEvent(flow: SabFlowDoc): boolean {
  return (flow.events ?? []).length > 0;
}

/** The primary start event — the one the engine treats as the entry point. */
export function findStartEvent(flow: SabFlowDoc): SabFlowEvent | undefined {
  const events = flow.events ?? [];
  return events.find((e) => e.type === 'start') ?? events[0];
}

/** Returns true if the given event has at least one outgoing edge. */
export function isEventConnected(flow: SabFlowDoc, eventId: string): boolean {
  return (flow.edges ?? []).some(
    (e) => 'eventId' in e.from && e.from.eventId === eventId,
  );
}

/**
 * Ensure the flow has a start event. If none exists, append a default 'start'
 * trigger at the top-left of the canvas. Idempotent.
 */
export function ensureStartEvent(
  flow: SabFlowDoc,
  makeId: () => string,
): SabFlowDoc {
  if (hasTriggerEvent(flow)) return flow;
  const newEvent: SabFlowEvent = {
    id: makeId(),
    type: 'start',
    graphCoordinates: { x: 100, y: 200 },
  };
  return { ...flow, events: [...(flow.events ?? []), newEvent] };
}

/**
 * Append a new trigger event of the given type. Used by the n8n-style
 * "What triggers this workflow?" panel that fires when a flow has none.
 */
export function addTriggerEvent(
  flow: SabFlowDoc,
  type: SabFlowEvent['type'],
  makeId: () => string,
  position: { x: number; y: number } = { x: 100, y: 200 },
): SabFlowDoc {
  const newEvent: SabFlowEvent = {
    id: makeId(),
    type,
    graphCoordinates: position,
  };
  return { ...flow, events: [...(flow.events ?? []), newEvent] };
}

/** Change a trigger event's type (start → webhook → schedule → manual → …). */
export function changeEventType(
  flow: SabFlowDoc,
  eventId: string,
  type: SabFlowEvent['type'],
): SabFlowDoc {
  return {
    ...flow,
    events: (flow.events ?? []).map((e) =>
      e.id === eventId ? ({ ...e, type } as SabFlowEvent) : e,
    ),
  };
}

/** Remove nodes (blocks, events, stickies) from the flow doc, plus touching edges. */
export function removeNodes(flow: SabFlowDoc, ids: string[]): SabFlowDoc {
  const idSet = new Set(ids);
  const groups = (flow.groups ?? [])
    .map((g) => ({ ...g, blocks: g.blocks.filter((b) => !idSet.has(b.id)) }))
    .filter((g) => g.blocks.length > 0);
  const events = (flow.events ?? []).filter((e) => !idSet.has(e.id));
  const annotations = (flow.annotations ?? []).filter((a) => !idSet.has(a.id));
  const edges = (flow.edges ?? []).filter((edge) => {
    const srcId = 'eventId' in edge.from ? edge.from.eventId : edge.from.blockId;
    const tgtId = edge.to.blockId;
    if (srcId && idSet.has(srcId)) return false;
    if (tgtId && idSet.has(tgtId)) return false;
    return true;
  });
  return { ...flow, groups, events, edges, annotations };
}

/** Append a new sticky-note annotation. */
export function addStickyNote(
  flow: SabFlowDoc,
  note: Annotation,
): SabFlowDoc {
  return {
    ...flow,
    annotations: [...(flow.annotations ?? []), note],
  };
}

/** Update a sticky-note annotation's properties. */
export function updateStickyNote(
  flow: SabFlowDoc,
  id: string,
  patch: Partial<Annotation>,
): SabFlowDoc {
  return {
    ...flow,
    annotations: (flow.annotations ?? []).map((a) =>
      a.id === id ? { ...a, ...patch } : a,
    ),
  };
}

/** Rename a single block. */
export function renameBlock(
  flow: SabFlowDoc,
  id: string,
  label: string,
): SabFlowDoc {
  const groups = (flow.groups ?? []).map((g) => ({
    ...g,
    blocks: g.blocks.map((b) => {
      if (b.id !== id) return b;
      const opts = (b.options ?? {}) as Record<string, unknown>;
      return { ...b, options: { ...opts, title: label } } as Block;
    }),
  }));
  return { ...flow, groups };
}

/** Add an edge between two nodes with given handles. */
export function addEdge(
  flow: SabFlowDoc,
  args: {
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  },
): SabFlowDoc {
  const srcEvent = flow.events?.find((e) => e.id === args.source);
  // Look up block for source/target
  let srcGroupId: string | undefined;
  let tgtGroupId: string | undefined;
  for (const g of flow.groups ?? []) {
    if (g.blocks.some((b) => b.id === args.source)) srcGroupId = g.id;
    if (g.blocks.some((b) => b.id === args.target)) tgtGroupId = g.id;
  }
  if (!tgtGroupId) return flow;

  const id = createCanvasConnectionId(args);
  const newEdge: SabEdge = srcEvent
    ? {
        id,
        from: { eventId: args.source },
        to: { groupId: tgtGroupId, blockId: args.target },
        sourceHandle: args.sourceHandle,
        targetHandle: args.targetHandle,
      }
    : {
        id,
        from: { groupId: srcGroupId ?? '', blockId: args.source },
        to: { groupId: tgtGroupId, blockId: args.target },
        sourceHandle: args.sourceHandle,
        targetHandle: args.targetHandle,
      };

  // Dedupe — replace existing edge with the same source+sourceHandle+target+targetHandle
  const edges = (flow.edges ?? []).filter(
    (e) => !(e.id === id || sameEndpoints(e, newEdge)),
  );
  return { ...flow, edges: [...edges, newEdge] };
}

function sameEndpoints(a: SabEdge, b: SabEdge): boolean {
  const aSrc = 'eventId' in a.from ? a.from.eventId : a.from.blockId;
  const bSrc = 'eventId' in b.from ? b.from.eventId : b.from.blockId;
  return (
    aSrc === ('eventId' in b.from ? b.from.eventId : b.from.blockId) &&
    a.to.blockId === b.to.blockId &&
    (a.sourceHandle ?? DEFAULT_SOURCE_HANDLE) === (b.sourceHandle ?? DEFAULT_SOURCE_HANDLE) &&
    (a.targetHandle ?? DEFAULT_TARGET_HANDLE) === (b.targetHandle ?? DEFAULT_TARGET_HANDLE) &&
    // prevent warning about unused variable
    bSrc !== undefined
  );
}

/** Remove a single edge by ID. */
export function removeEdge(flow: SabFlowDoc, edgeId: string): SabFlowDoc {
  return { ...flow, edges: (flow.edges ?? []).filter((e) => e.id !== edgeId) };
}
