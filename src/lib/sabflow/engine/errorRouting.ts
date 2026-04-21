import type { Block, Edge } from '@/lib/sabflow/types';
import { getEffectivePins } from '@/lib/sabflow/pins';

/**
 * Identifies the pin ID that represents a block's error output.
 * Convention: the pin literally named `"error"` wins; otherwise the last pin
 * whose label starts with "error" (case-insensitive) is used.
 */
export function getErrorPinId(block: Block): string | undefined {
  const pins = getEffectivePins(block);
  if (!pins || pins.length === 0) return undefined;

  const exact = pins.find((p) => p.id === 'error');
  if (exact) return exact.id;

  const labelled = pins.find((p) => /^error/i.test(p.label ?? ''));
  return labelled?.id;
}

/**
 * Finds the first edge that leaves the block's error pin, if any.
 *
 * Connection model: edges leaving a specific pin carry `from.pinId` matching
 * the pin's `id` (see `Edge.EdgeFrom` variant with `blockId`).
 */
export function resolveErrorEdge(
  block: Block,
  edges: Edge[],
): Edge | undefined {
  const pinId = getErrorPinId(block);
  if (!pinId) return undefined;

  return edges.find((e) => {
    const f = e.from;
    if (!('groupId' in f) || !('blockId' in f)) return false;
    if (f.blockId !== block.id) return false;
    return f.pinId === pinId;
  });
}

/**
 * True when the block has ANY edge leaving a non-error pin. Used to decide
 * whether routing to an error pin should stop the primary branch.
 */
export function hasSuccessEdge(block: Block, edges: Edge[]): boolean {
  const errorPin = getErrorPinId(block);
  return edges.some((e) => {
    const f = e.from;
    if (!('blockId' in f) || f.blockId !== block.id) return false;
    return f.pinId !== errorPin;
  });
}
