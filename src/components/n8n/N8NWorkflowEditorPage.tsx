'use client';
/**
 * N8NWorkflowEditorPage
 *
 * Bridge between the Next.js route (which passes the raw MongoDB N8NWorkflow
 * shape from @/lib/n8n/types) and the canvas WorkflowEditor (which uses the
 * flattened N8NCanvasWorkflow shape).
 *
 * Conversion:
 *   DB  → canvas: N8NConnections (nested map) → N8NCanvasConnection[]
 *   canvas → DB:  N8NCanvasConnection[] → N8NConnections (nested map)
 */

import { useCallback, useMemo } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { saveWorkflow } from '@/app/actions/n8n';
import { WorkflowEditor } from './WorkflowEditor';
import type {
  N8NCanvasWorkflow,
  N8NCanvasNode,
  N8NCanvasConnection,
} from './types';
import type { N8NWorkflow, N8NNode, N8NConnections } from '@/lib/n8n/types';

/* ── DB → canvas ─────────────────────────────────────────────────────────── */

function dbNodeToCanvas(n: N8NNode): N8NCanvasNode {
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    typeVersion: n.typeVersion,
    position: n.position as [number, number],
    parameters: n.parameters ?? {},
    disabled: n.disabled,
    notes: n.notes,
  };
}

function dbConnectionsToCanvas(conns: N8NConnections): N8NCanvasConnection[] {
  const result: N8NCanvasConnection[] = [];
  for (const [sourceNodeName, outputs] of Object.entries(conns)) {
    for (const [connType, outputSlots] of Object.entries(outputs)) {
      if (connType !== 'main') continue;
      outputSlots.forEach((targets, outputIndex) => {
        (targets ?? []).forEach((point) => {
          result.push({
            id: createId(),
            sourceNodeName,
            sourceOutputIndex: outputIndex,
            targetNodeName: point.node,
            targetInputIndex: point.index,
          });
        });
      });
    }
  }
  return result;
}

/* ── canvas → DB ─────────────────────────────────────────────────────────── */

function canvasConnectionsToDB(conns: N8NCanvasConnection[]): N8NConnections {
  const result: N8NConnections = {};
  for (const conn of conns) {
    if (!result[conn.sourceNodeName]) result[conn.sourceNodeName] = {};
    if (!result[conn.sourceNodeName]['main'])
      result[conn.sourceNodeName]['main'] = [];
    const slots = result[conn.sourceNodeName]['main'];
    while (slots.length <= conn.sourceOutputIndex) slots.push([]);
    slots[conn.sourceOutputIndex].push({
      node: conn.targetNodeName,
      type: 'main',
      index: conn.targetInputIndex,
    });
  }
  return result;
}

/* ── Component ───────────────────────────────────────────────────────────── */

type Props = {
  workflow: N8NWorkflow & { _id: string };
};

export function N8NWorkflowEditorPage({ workflow }: Props) {
  const canvasWorkflow: N8NCanvasWorkflow = useMemo(
    () => ({
      _id: workflow._id,
      name: workflow.name,
      active: workflow.active,
      nodes: workflow.nodes.map(dbNodeToCanvas),
      connections: dbConnectionsToCanvas(workflow.connections),
      createdAt:
        workflow.createdAt instanceof Date
          ? workflow.createdAt
          : new Date(workflow.createdAt),
      updatedAt:
        workflow.updatedAt instanceof Date
          ? workflow.updatedAt
          : new Date(workflow.updatedAt),
    }),
    // Stable on mount — the editor owns mutations after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSave = useCallback(
    async (updated: N8NCanvasWorkflow) => {
      const dbNodes: N8NNode[] = updated.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        typeVersion: n.typeVersion,
        position: n.position,
        parameters: n.parameters,
        ...(n.disabled !== undefined ? { disabled: n.disabled } : {}),
        ...(n.notes ? { notes: n.notes } : {}),
      }));
      await saveWorkflow(workflow._id, {
        name: updated.name,
        active: updated.active,
        nodes: dbNodes,
        connections: canvasConnectionsToDB(updated.connections),
      });
    },
    [workflow._id],
  );

  return (
    <WorkflowEditor
      workflow={canvasWorkflow}
      onSave={handleSave}
      backHref="/dashboard/n8n"
    />
  );
}
