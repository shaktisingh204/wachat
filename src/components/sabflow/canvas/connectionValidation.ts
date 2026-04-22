/**
 * Connection validation — port of n8n's isValidConnection logic.
 *
 * A connection is valid iff:
 *   1. source ≠ target (no self-loop)
 *   2. Port types match (main↔main, ai↔ai, tool↔tool, data↔data).
 *   3. Target handle has capacity (its max-connections isn't already full).
 *   4. Connecting from an output handle to an input handle (not the inverse).
 *   5. No cycle is created in the graph (DFS from target; must not reach source).
 */
import type { Connection } from '@xyflow/react';
import type { Edge as SabEdge, SabFlowDoc } from '@/lib/sabflow/types';
import { parseCanvasConnectionHandleString } from './utils';
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE } from '@/lib/sabflow/ports';

export function canConnect(
  connection: Connection,
  flow: SabFlowDoc,
): { ok: true } | { ok: false; reason: string } {
  const { source, target, sourceHandle, targetHandle } = connection;
  if (!source || !target) return { ok: false, reason: 'incomplete connection' };

  if (source === target) return { ok: false, reason: 'no self-loop' };

  const s = parseCanvasConnectionHandleString(sourceHandle);
  const t = parseCanvasConnectionHandleString(targetHandle);
  if (s.mode !== 'outputs' || t.mode !== 'inputs') {
    return { ok: false, reason: 'must connect output → input' };
  }
  if (s.type !== t.type) {
    return { ok: false, reason: `type mismatch: ${s.type} → ${t.type}` };
  }

  // Check target capacity — the target input port's maxConnections.
  const targetBlock = findBlockById(flow, target);
  if (targetBlock) {
    const inputs = targetBlock.inputPorts ?? [];
    const port = inputs.find((p) => p.type === t.type && p.index === t.index);
    const max = port?.maxConnections ?? 1;
    const taken = (flow.edges ?? []).filter(
      (e) =>
        e.to.blockId === target &&
        (e.targetHandle ?? DEFAULT_TARGET_HANDLE) ===
          (targetHandle ?? DEFAULT_TARGET_HANDLE),
    ).length;
    if (taken >= max) {
      return { ok: false, reason: 'target input already connected' };
    }
  }

  // Cycle detection: DFS from target's outgoing, reject if we reach source.
  const outgoing = new Map<string, string[]>();
  for (const edge of flow.edges ?? []) {
    const src = srcOf(edge);
    const tgt = edge.to.blockId;
    if (!src || !tgt) continue;
    if (!outgoing.has(src)) outgoing.set(src, []);
    outgoing.get(src)!.push(tgt);
  }
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === source) return { ok: false, reason: 'connection creates a cycle' };
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of outgoing.get(id) ?? []) stack.push(n);
  }

  return { ok: true };
}

function srcOf(edge: SabEdge): string | undefined {
  return 'eventId' in edge.from ? edge.from.eventId : edge.from.blockId;
}

function findBlockById(flow: SabFlowDoc, id: string) {
  for (const g of flow.groups ?? []) {
    const b = g.blocks.find((b) => b.id === id);
    if (b) return b;
  }
  return undefined;
}
