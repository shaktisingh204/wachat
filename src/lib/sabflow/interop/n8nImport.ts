/**
 * n8n workflow.json → SabFlow doc converter.
 *
 * Accepts the JSON shape that n8n's editor exports (an object with `name`,
 * `nodes`, `connections`).  Returns a partial `SabFlowDoc` that the API
 * route uses to seed a fresh flow.
 *
 * Mapping strategy:
 *
 *   1. Look up the n8n node type in the explicit map below — known nodes
 *      map to their SabFlow native counterparts (open_ai → open_ai, etc.).
 *   2. Try `forge_<snake_case>` for n8n-style namespaced names
 *      (n8n-nodes-base.slack → forge_slack).
 *   3. Fall back to `typebot_link` annotated with the original n8n type so
 *      the user can swap to a real block via the stub-fallback "Swap" UI.
 *
 * Imports are best-effort: unsupported features (expression edge cases,
 * sub-credentials, manual triggers) end up as a documented stub block
 * rather than failing the whole import.
 */

import { createId } from '@paralleldrive/cuid2';
import type {
  Block,
  BlockType,
  Edge,
  Group,
  SabFlowDoc,
  SabFlowEvent,
  Variable,
} from '@/lib/sabflow/types';

/* ── n8n workflow shape (subset we actually consume) ────────────────────── */

export type N8nNode = {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position?: [number, number];
  parameters?: Record<string, unknown>;
};

export type N8nConnectionEntry = {
  node: string;
  type: string;
  index: number;
};

export type N8nConnections = Record<
  string,
  Record<string, Array<Array<N8nConnectionEntry>>>
>;

export type N8nWorkflowJson = {
  name?: string;
  nodes?: N8nNode[];
  connections?: N8nConnections;
  active?: boolean;
  staticData?: Record<string, unknown>;
  pinData?: Record<string, unknown>;
};

/* ── Type mapping ───────────────────────────────────────────────────────── */

const TYPE_MAP: Record<string, BlockType> = {
  // n8n native → SabFlow native
  'n8n-nodes-base.httpRequest':        'webhook',
  'n8n-nodes-base.emailSend':          'send_email',
  'n8n-nodes-base.googleSheets':       'google_sheets',
  'n8n-nodes-base.if':                 'condition',
  'n8n-nodes-base.switch':             'switch',
  'n8n-nodes-base.set':                'set_variable',
  'n8n-nodes-base.code':               'script',
  'n8n-nodes-base.wait':               'wait',
  'n8n-nodes-base.merge':              'merge',
  'n8n-nodes-base.splitInBatches':     'loop',
  'n8n-nodes-base.filter':             'filter',
  'n8n-nodes-base.sort':               'sort',
  'n8n-nodes-base.executeWorkflow':    'execute_workflow',
  'n8n-nodes-base.respondToWebhook':   'respond_to_webhook',
  '@n8n/n8n-nodes-langchain.openAi':   'open_ai',
};

/** Trigger node types we know how to map to a SabFlow event. */
const TRIGGER_MAP: Record<string, SabFlowEvent['type']> = {
  'n8n-nodes-base.webhook':         'webhook',
  'n8n-nodes-base.scheduleTrigger': 'schedule',
  'n8n-nodes-base.manualTrigger':   'manual',
  'n8n-nodes-base.errorTrigger':    'error',
  'n8n-nodes-base.start':           'start',
};

/* ── Public API ─────────────────────────────────────────────────────────── */

export type N8nImportResult = {
  /** Partial flow doc the caller can hand off to `saveSabFlow`. */
  doc: Pick<
    SabFlowDoc,
    'name' | 'events' | 'groups' | 'edges' | 'variables' | 'theme' | 'settings'
  >;
  /** Names of nodes that were imported but landed as typebot_link stubs. */
  stubbed: string[];
  /** Total nodes processed (excluding triggers). */
  blocks: number;
  /** Total triggers extracted. */
  triggers: number;
};

export function importN8nWorkflow(input: unknown): N8nImportResult {
  const wf = validate(input);
  const stubbed: string[] = [];

  /* Separate triggers from regular nodes. */
  const triggerNodes: N8nNode[] = [];
  const blockNodes: N8nNode[] = [];
  for (const node of wf.nodes ?? []) {
    if (TRIGGER_MAP[node.type]) triggerNodes.push(node);
    else blockNodes.push(node);
  }

  /* ── Triggers ── */
  const events: SabFlowEvent[] = triggerNodes.map((n, idx) => {
    const id = n.id ?? createId();
    return {
      id,
      type: TRIGGER_MAP[n.type],
      graphCoordinates: {
        x: n.position?.[0] ?? 0,
        y: n.position?.[1] ?? idx * 80,
      },
      options: (n.parameters ?? {}) as SabFlowEvent['options'],
    };
  });

  /* ── Blocks — single group keyed by `_imported` so the layout is flat ── */
  const blockIdByN8nName = new Map<string, string>();
  const groupId = `_imported_${createId()}`;
  const blocks: Block[] = blockNodes.map((n, idx) => {
    const id = n.id ?? createId();
    blockIdByN8nName.set(n.name, id);
    const mapped = resolveType(n.type);
    if (mapped.stubbed) stubbed.push(n.name);
    return {
      id,
      type: mapped.type,
      groupId,
      options: {
        ...((n.parameters ?? {}) as Record<string, unknown>),
        // Tag the original n8n type so the stub-fallback "Swap" UI can
        // suggest a real replacement.
        ...(mapped.stubbed ? { _n8nOriginalType: n.type } : {}),
      } as Block['options'],
      graphCoordinates: {
        x: n.position?.[0] ?? 0,
        y: n.position?.[1] ?? idx * 80,
      },
    };
  });

  /* ── Edges from n8n connections (main only) ── */
  const edges: Edge[] = [];
  for (const [sourceName, byType] of Object.entries(wf.connections ?? {})) {
    const sourceId = blockIdByN8nName.get(sourceName);
    if (!sourceId) continue;
    const mainArr = byType.main ?? [];
    mainArr.forEach((slot, outputIndex) => {
      for (const conn of slot ?? []) {
        const targetId = blockIdByN8nName.get(conn.node);
        if (!targetId) continue;
        edges.push({
          id: createId(),
          from: { groupId, blockId: sourceId },
          to: { groupId, blockId: targetId },
          sourceHandle: `outputs/main/${outputIndex}`,
          targetHandle: `inputs/main/${conn.index}`,
        });
      }
    });
  }

  /* ── Variables: pull from n8n staticData when present ── */
  const variables: Variable[] = Object.entries(wf.staticData ?? {}).map(
    ([name, value]) => ({
      id: createId(),
      name,
      defaultValue: typeof value === 'string' ? value : JSON.stringify(value ?? ''),
    }),
  );

  const groups: Group[] = [
    {
      id: groupId,
      title: 'Imported workflow',
      graphCoordinates: { x: 0, y: 0 },
      blocks,
    },
  ];

  return {
    doc: {
      name: wf.name ?? 'Imported workflow',
      events,
      groups,
      edges,
      variables,
      theme: {},
      settings: { description: 'Imported from a workflow JSON export' },
    },
    stubbed,
    blocks: blocks.length,
    triggers: events.length,
  };
}

/* ── Internals ──────────────────────────────────────────────────────────── */

function validate(input: unknown): N8nWorkflowJson {
  if (!input || typeof input !== 'object') {
    throw new Error('Import payload must be an object');
  }
  const wf = input as N8nWorkflowJson;
  if (!Array.isArray(wf.nodes)) {
    throw new Error('Import payload missing "nodes" array');
  }
  return wf;
}

function resolveType(n8nType: string): { type: BlockType; stubbed: boolean } {
  const exact = TYPE_MAP[n8nType];
  if (exact) return { type: exact, stubbed: false };

  // n8n-nodes-base.slack → forge_slack
  const baseMatch = /^n8n-nodes-base\.(.+)$/.exec(n8nType);
  if (baseMatch) {
    const snake = baseMatch[1]
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();
    return { type: `forge_${snake}` as BlockType, stubbed: false };
  }

  // Anything else lands as typebot_link so the user can swap via the stub
  // fallback UI without losing the original type information.
  return { type: 'typebot_link', stubbed: true };
}
