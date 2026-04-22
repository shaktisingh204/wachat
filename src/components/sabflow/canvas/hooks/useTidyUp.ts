'use client';
/**
 * useTidyUp — port of n8n's Shift+Alt+T auto-layout.
 *
 * Implements a Sugiyama-style layered layout without pulling in a graph
 * library. The algorithm:
 *   1. Find roots (nodes with no incoming main edges).
 *   2. BFS-layer: layer[id] = max(layer[parents]) + 1.
 *   3. Per-layer ordering: stable by current Y to keep user intent.
 *   4. Assign positions: x = layer * H_SPACING, y = rowIndex * V_SPACING.
 */
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { applyBulkNodePositions } from '../adapter';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH, GRID_SIZE } from '../constants';

const H_SPACING = DEFAULT_NODE_WIDTH + GRID_SIZE * 8;
const V_SPACING = DEFAULT_NODE_HEIGHT + GRID_SIZE * 6;

export function tidyUp(flow: SabFlowDoc): SabFlowDoc {
  // Build id → node position map from current doc + id → incoming edge count.
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const nodeIds = new Set<string>();

  for (const event of flow.events ?? []) {
    nodeIds.add(event.id);
  }
  for (const group of flow.groups ?? []) {
    for (const block of group.blocks) {
      nodeIds.add(block.id);
    }
  }

  for (const edge of flow.edges ?? []) {
    const src =
      'eventId' in edge.from
        ? edge.from.eventId
        : edge.from.blockId ?? '';
    const tgt = edge.to.blockId;
    if (!src || !tgt) continue;
    if (!outgoing.has(src)) outgoing.set(src, []);
    outgoing.get(src)!.push(tgt);
    if (!incoming.has(tgt)) incoming.set(tgt, []);
    incoming.get(tgt)!.push(src);
  }

  // Layer via BFS from roots
  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const id of nodeIds) {
    if (!incoming.has(id) || (incoming.get(id)?.length ?? 0) === 0) {
      layer.set(id, 0);
      queue.push(id);
    }
  }

  // Guard: if there are no roots (everything's in a cycle), seed with
  // arbitrary ordering — put each unlayered node after its max parent.
  while (queue.length) {
    const id = queue.shift()!;
    const next = outgoing.get(id) ?? [];
    for (const childId of next) {
      const candidate = (layer.get(id) ?? 0) + 1;
      const existing = layer.get(childId);
      if (existing === undefined || existing < candidate) {
        layer.set(childId, candidate);
        queue.push(childId);
      }
    }
  }

  // Any still-unlayered nodes (cycle-only) — dump them into layer 0.
  for (const id of nodeIds) {
    if (!layer.has(id)) layer.set(id, 0);
  }

  // Group by layer, keep per-layer order stable by previous Y.
  const prevPositions = new Map<string, { x: number; y: number }>();
  for (const event of flow.events ?? []) {
    prevPositions.set(event.id, event.graphCoordinates);
  }
  for (const group of flow.groups ?? []) {
    for (const block of group.blocks) {
      prevPositions.set(
        block.id,
        block.graphCoordinates ?? group.graphCoordinates,
      );
    }
  }

  const layers = new Map<number, string[]>();
  for (const [id, l] of layer.entries()) {
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(id);
  }
  for (const ids of layers.values()) {
    ids.sort(
      (a, b) =>
        (prevPositions.get(a)?.y ?? 0) - (prevPositions.get(b)?.y ?? 0),
    );
  }

  const updates: Array<{ id: string; position: { x: number; y: number } }> = [];
  const sortedLayers = [...layers.keys()].sort((a, b) => a - b);
  for (const l of sortedLayers) {
    const ids = layers.get(l) ?? [];
    ids.forEach((id, rowIndex) => {
      updates.push({
        id,
        position: { x: l * H_SPACING, y: rowIndex * V_SPACING },
      });
    });
  }

  return applyBulkNodePositions(flow, updates);
}
