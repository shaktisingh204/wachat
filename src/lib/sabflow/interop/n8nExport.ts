/**
 * SabFlow doc → n8n workflow.json converter.
 *
 * Inverse of `n8nImport.ts`.  Walks the flow's groups + edges + events and
 * produces an object that n8n's editor can import via "File → Import from
 * URL/clipboard".
 *
 * Blocks unique to SabFlow (bubbles, choice inputs, etc.) export as
 * `n8n-nodes-base.set` with a `_sabflowOriginalType` parameter so the
 * user can re-import into SabFlow without information loss.
 */

import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { N8nNode, N8nConnections } from './n8nImport';

/* ── Reverse type map ───────────────────────────────────────────────────── */

const REVERSE_TYPE_MAP: Record<string, string> = {
  webhook:           'n8n-nodes-base.httpRequest',
  send_email:        'n8n-nodes-base.emailSend',
  google_sheets:     'n8n-nodes-base.googleSheets',
  condition:         'n8n-nodes-base.if',
  switch:            'n8n-nodes-base.switch',
  set_variable:      'n8n-nodes-base.set',
  script:            'n8n-nodes-base.code',
  wait:              'n8n-nodes-base.wait',
  merge:             'n8n-nodes-base.merge',
  loop:              'n8n-nodes-base.splitInBatches',
  filter:            'n8n-nodes-base.filter',
  sort:              'n8n-nodes-base.sort',
  execute_workflow:  'n8n-nodes-base.executeWorkflow',
  respond_to_webhook:'n8n-nodes-base.respondToWebhook',
  open_ai:           '@n8n/n8n-nodes-langchain.openAi',
};

const TRIGGER_REVERSE_MAP: Record<string, string> = {
  webhook:  'n8n-nodes-base.webhook',
  schedule: 'n8n-nodes-base.scheduleTrigger',
  manual:   'n8n-nodes-base.manualTrigger',
  error:    'n8n-nodes-base.errorTrigger',
  start:    'n8n-nodes-base.start',
};

/* ── Public API ─────────────────────────────────────────────────────────── */

export type N8nExportResult = {
  workflow: {
    name: string;
    nodes: N8nNode[];
    connections: N8nConnections;
    active: boolean;
    staticData: Record<string, unknown>;
    versionId: string;
  };
  /** Block ids that exported as a generic fallback. */
  fallback: string[];
};

export function exportToN8n(flow: SabFlowDoc): N8nExportResult {
  const nodes: N8nNode[] = [];
  const fallback: string[] = [];
  const nameByBlockId = new Map<string, string>();

  /* ── Triggers ── */
  for (const event of flow.events ?? []) {
    const name = `event__${event.id.slice(0, 8)}`;
    nameByBlockId.set(event.id, name);
    nodes.push({
      id: event.id,
      name,
      type: TRIGGER_REVERSE_MAP[event.type] ?? 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [event.graphCoordinates.x, event.graphCoordinates.y],
      parameters: (event.options ?? {}) as Record<string, unknown>,
    });
  }

  /* ── Blocks ── */
  const usedNames = new Set<string>(nodes.map((n) => n.name));
  for (const group of flow.groups) {
    for (const block of group.blocks) {
      const mapped = REVERSE_TYPE_MAP[block.type as string];
      if (!mapped) fallback.push(block.id);
      const baseName =
        (block.options as { name?: string } | undefined)?.name?.toString() ??
        block.type.toString();
      const name = uniqueName(baseName, usedNames);
      usedNames.add(name);
      nameByBlockId.set(block.id, name);

      const params = (block.options ?? {}) as Record<string, unknown>;
      const exportType =
        mapped ?? `n8n-nodes-base.${block.type.replace(/^forge_/, '').replace(/_/g, '')}`;

      nodes.push({
        id: block.id,
        name,
        type: exportType,
        typeVersion: 1,
        position: [
          block.graphCoordinates?.x ?? 0,
          block.graphCoordinates?.y ?? 0,
        ],
        parameters: mapped
          ? params
          : { ...params, _sabflowOriginalType: block.type },
      });
    }
  }

  /* ── Connections from edges ── */
  const connections: N8nConnections = {};
  for (const edge of flow.edges ?? []) {
    const sourceId =
      ('blockId' in edge.from && edge.from.blockId) ||
      ('eventId' in edge.from && edge.from.eventId);
    const targetId = edge.to.blockId;
    if (!sourceId || !targetId) continue;
    const sourceName = nameByBlockId.get(sourceId);
    const targetName = nameByBlockId.get(targetId);
    if (!sourceName || !targetName) continue;

    const out = (connections[sourceName] ??= {});
    const mainArr = (out.main ??= []);
    const idx = parseHandleIndex(edge.sourceHandle ?? 'outputs/main/0');
    while (mainArr.length <= idx) mainArr.push([]);
    mainArr[idx].push({
      node: targetName,
      type: 'main',
      index: parseHandleIndex(edge.targetHandle ?? 'inputs/main/0'),
    });
  }

  return {
    workflow: {
      name: flow.name,
      nodes,
      connections,
      active: flow.status === 'PUBLISHED',
      staticData: variablesAsStaticData(flow),
      versionId: flow._id?.toString() ?? '',
    },
    fallback,
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function parseHandleIndex(handle: string): number {
  const m = /\/(\d+)$/.exec(handle);
  return m ? Number(m[1]) : 0;
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let i = 1;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function variablesAsStaticData(flow: SabFlowDoc): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const v of flow.variables ?? []) {
    out[v.name] =
      v.defaultValue !== undefined
        ? v.defaultValue
        : v.value !== undefined
        ? v.value
        : '';
  }
  return out;
}
