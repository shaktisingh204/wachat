/**
 * sabflow → n8n adapter.
 *
 * Converts a sabflow `SabFlowDoc` (typebot-style: groups of ordered blocks +
 * edges between them) into n8n's `Workflow` shape (nodes + typed connections),
 * so we can run the n8n expression engine — and eventually `WorkflowExecute` —
 * over an authored sabflow.
 *
 * The mapping rule:
 *   - Each block becomes one n8n `INode`. Node name = `block.id` (unique).
 *   - Within a group, consecutive blocks are connected via implicit `main`
 *     connections (block N → block N+1).
 *   - Cross-group edges become explicit `main` connections (last block of
 *     source group → first block of target group, unless `from.blockId` /
 *     `to.blockId` pin a specific block).
 *   - Trigger events (`type: 'start'|'schedule'|'webhook'|'manual'`) become
 *     synthetic trigger nodes named after the event id.
 */
import type {
  SabFlowDoc,
  Block,
  Group,
  Edge,
  SabFlowEvent,
  ScheduleEventOptions,
  WebhookEventOptions,
} from '@/lib/sabflow/types';
import type {
  INode,
  IConnection,
  IConnections,
  INodeParameters,
  INodeTypes,
} from './interfaces';
import { Workflow, type WorkflowParameters } from './workflow';

/** Lightweight runtime variable shape used by the n8n expression proxy. */
export type N8nVariable = {
  id: string;
  name: string;
  value: unknown;
};

/** Result of adapting a sabflow into n8n primitives. */
export type AdaptedWorkflow = {
  /** Plain INode list — useful for serialisation / inspection. */
  nodes: INode[];
  /** n8n's source-indexed IConnections graph. */
  connections: IConnections;
  /** Original sabflow doc, retained for back-references. */
  source: SabFlowDoc;
};

/* ── Per-block conversion ───────────────────────────────────────────────── */

function nodeNameForBlock(block: Block): string {
  return block.id;
}

function nodeNameForEvent(event: SabFlowEvent): string {
  return `event::${event.id}`;
}

/** Map a sabflow `Block.type` to a recognisable n8n node-type string. */
function n8nNodeType(block: Block): string {
  // Forge blocks are already namespaced.
  if (block.type.startsWith('forge_')) {
    return `n8n-nodes-base.${block.type}`;
  }
  // Map a few core types to existing n8n node names where they overlap.
  switch (block.type) {
    case 'webhook':
      return 'n8n-nodes-base.httpRequest';
    case 'send_email':
      return 'n8n-nodes-base.emailSend';
    case 'google_sheets':
      return 'n8n-nodes-base.googleSheets';
    case 'open_ai':
      return '@n8n/n8n-nodes-langchain.openAi';
    case 'condition':
      return 'n8n-nodes-base.if';
    case 'switch':
      return 'n8n-nodes-base.switch';
    case 'set_variable':
    case 'set':
      return 'n8n-nodes-base.set';
    case 'script':
      return 'n8n-nodes-base.code';
    case 'wait':
      return 'n8n-nodes-base.wait';
    case 'merge':
      return 'n8n-nodes-base.merge';
    case 'loop':
      return 'n8n-nodes-base.splitInBatches';
    case 'filter':
      return 'n8n-nodes-base.filter';
    case 'sort':
      return 'n8n-nodes-base.sort';
    default:
      // Bubble + input blocks have no n8n equivalent — keep sabflow namespace.
      return `sabflow.${block.type}`;
  }
}

/** Resolve graph coordinates with a fallback to the containing group. */
function resolvePosition(block: Block, group: Group, idxInGroup: number): [number, number] {
  if (block.graphCoordinates) {
    return [block.graphCoordinates.x, block.graphCoordinates.y];
  }
  return [group.graphCoordinates.x, group.graphCoordinates.y + 80 * idxInGroup];
}

function blockToINode(block: Block, group: Group, idxInGroup: number): INode {
  return {
    id: block.id,
    name: nodeNameForBlock(block),
    typeVersion: 1,
    type: n8nNodeType(block),
    position: resolvePosition(block, group, idxInGroup),
    disabled: false,
    parameters: (block.options ?? {}) as unknown as INodeParameters,
    onError: block.onError === 'stop' ? 'stopWorkflow' : block.onError,
    retryOnFail: block.retry?.maxTries && block.retry.maxTries > 1 ? true : false,
    maxTries: block.retry?.maxTries,
    waitBetweenTries: block.retry?.waitMs,
  };
}

function eventToINode(event: SabFlowEvent): INode {
  let type: string;
  switch (event.type) {
    case 'webhook':
      type = 'n8n-nodes-base.webhook';
      break;
    case 'schedule':
      type = 'n8n-nodes-base.scheduleTrigger';
      break;
    case 'manual':
      type = 'n8n-nodes-base.manualTrigger';
      break;
    case 'error':
      type = 'n8n-nodes-base.errorTrigger';
      break;
    case 'start':
    default:
      type = 'n8n-nodes-base.start';
  }
  const opts = event.options as
    | ScheduleEventOptions
    | WebhookEventOptions
    | undefined;
  return {
    id: event.id,
    name: nodeNameForEvent(event),
    typeVersion: 1,
    type,
    position: [event.graphCoordinates.x, event.graphCoordinates.y],
    parameters: (opts ?? {}) as unknown as INodeParameters,
  };
}

/* ── Connection builder ─────────────────────────────────────────────────── */

function pushConnection(
  connections: IConnections,
  source: string,
  target: string,
  sourceOutputIndex = 0,
  targetInputIndex = 0,
): void {
  if (!connections[source]) connections[source] = {};
  if (!connections[source].main) connections[source].main = [];
  while (connections[source].main!.length <= sourceOutputIndex) {
    connections[source].main!.push(null);
  }
  const slot = connections[source].main![sourceOutputIndex] ?? [];
  const conn: IConnection = { node: target, type: 'main', index: targetInputIndex };
  slot.push(conn);
  connections[source].main![sourceOutputIndex] = slot;
}

function buildConnections(doc: SabFlowDoc): IConnections {
  const connections: IConnections = {};
  const groupById = new Map<string, Group>();
  for (const g of doc.groups) groupById.set(g.id, g);

  // 1. Implicit connections within each group: block N → block N+1.
  for (const group of doc.groups) {
    for (let i = 0; i < group.blocks.length - 1; i++) {
      pushConnection(connections, group.blocks[i].id, group.blocks[i + 1].id);
    }
  }

  // 2. Edges from events to their first downstream group/block.
  for (const event of doc.events) {
    const edge = doc.edges.find((e) => 'eventId' in e.from && e.from.eventId === event.id);
    if (!edge) continue;
    const targetGroup = groupById.get(edge.to.groupId);
    if (!targetGroup) continue;
    const targetBlockId = edge.to.blockId ?? targetGroup.blocks[0]?.id;
    if (!targetBlockId) continue;
    pushConnection(connections, nodeNameForEvent(event), targetBlockId);
  }

  // 3. Cross-group / inter-block edges.
  for (const edge of doc.edges) {
    if ('eventId' in edge.from && edge.from.eventId) continue; // handled above
    if (!('groupId' in edge.from) || !edge.from.groupId) continue;
    const sourceGroup = groupById.get(edge.from.groupId);
    if (!sourceGroup) continue;
    const sourceBlockId =
      edge.from.blockId ?? sourceGroup.blocks[sourceGroup.blocks.length - 1]?.id;
    const targetGroup = groupById.get(edge.to.groupId);
    if (!targetGroup) continue;
    const targetBlockId = edge.to.blockId ?? targetGroup.blocks[0]?.id;
    if (!sourceBlockId || !targetBlockId) continue;

    const { sourceOutputIndex, targetInputIndex } = parseHandleIndexes(edge);
    pushConnection(connections, sourceBlockId, targetBlockId, sourceOutputIndex, targetInputIndex);
  }

  return connections;
}

/** Parse `outputs/main/2` and `inputs/main/0` style handle ids → indexes. */
function parseHandleIndexes(edge: Edge): {
  sourceOutputIndex: number;
  targetInputIndex: number;
} {
  const parseIndex = (handle: string | undefined): number => {
    if (!handle) return 0;
    const parts = handle.split('/');
    const last = parts[parts.length - 1];
    const n = Number(last);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    sourceOutputIndex: parseIndex(edge.sourceHandle),
    targetInputIndex: parseIndex(edge.targetHandle),
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Convert a sabflow doc into the structural primitives n8n's `Workflow`
 * class understands.  Pure — no side effects.
 */
export function adaptSabFlowDoc(doc: SabFlowDoc): AdaptedWorkflow {
  const nodes: INode[] = [];
  for (const event of doc.events) {
    nodes.push(eventToINode(event));
  }
  for (const group of doc.groups) {
    group.blocks.forEach((block, idx) => {
      nodes.push(blockToINode(block, group, idx));
    });
  }
  const connections = buildConnections(doc);
  return { nodes, connections, source: doc };
}

/**
 * Wrap an adapted sabflow as a real n8n `Workflow` instance.  Note that
 * `Workflow` requires `INodeTypes`; until we register a type registry, pass
 * a minimal stub that returns a permissive shape for every type — most n8n
 * consumers (expression evaluation, connection traversal) tolerate this.
 */
export function buildN8nWorkflow(
  doc: SabFlowDoc,
  nodeTypes?: INodeTypes,
): Workflow {
  const { nodes, connections } = adaptSabFlowDoc(doc);

  const stubNodeTypes: INodeTypes =
    nodeTypes ??
    ({
      getByName: () => null,
      getByNameAndVersion: () =>
        ({
          description: {
            displayName: 'sabflow stub',
            name: 'sabflow.stub',
            group: ['transform'],
            version: 1,
            properties: [],
            inputs: ['main'],
            outputs: ['main'],
            defaults: { name: 'sabflow stub' },
          },
        } as unknown as ReturnType<INodeTypes['getByNameAndVersion']>),
      getKnownTypes: () => ({}),
    } as unknown as INodeTypes);

  const params: WorkflowParameters = {
    id: doc._id?.toString() ?? doc.name,
    name: doc.name,
    nodes,
    connections,
    active: doc.status === 'PUBLISHED',
    nodeTypes: stubNodeTypes,
    settings: {},
    pinData: undefined,
  };
  return new Workflow(params);
}

/** Convert sabflow `Variable[]` into the shape n8n's expression proxy expects. */
export function adaptVariables(
  vars: SabFlowDoc['variables'],
  runtime: Record<string, unknown> = {},
): N8nVariable[] {
  return vars.map((v) => ({
    id: v.id,
    name: v.name,
    value: runtime[v.name] ?? v.defaultValue ?? v.value ?? null,
  }));
}
