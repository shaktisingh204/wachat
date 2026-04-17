import type { Coordinates } from '@/lib/sabflow/types';

export const dropOffBoxDimensions = { width: 100, height: 48 };
export const dropOffSegmentLength = 80;
export const dropOffStubLength = 30;

const RADIUS = 16;

/**
 * Computes the SVG path for a "drop-off arc" that extends from the last source
 * endpoint of a block that has no outgoing edge.
 *
 * - When the block is the last in its group (`isLastBlock = true`) the arc
 *   curves downward by `dropOffSegmentLength` pixels.
 * - Otherwise the arc extends horizontally to the right by `dropOffStubLength`
 *   pixels so a small badge can be placed beside the block.
 */
export const computeDropOffPath = (
  sourcePosition: Coordinates,
  isLastBlock = false,
): string => {
  const sx = sourcePosition.x;
  const sy = sourcePosition.y;

  if (isLastBlock) {
    const targetX = sx + dropOffStubLength + dropOffBoxDimensions.width / 2;
    const targetY = sy + dropOffSegmentLength;
    const r = Math.min(RADIUS, Math.abs(targetX - sx) / 2, Math.abs(targetY - sy) / 2);
    return [
      `M ${sx},${sy}`,
      `L ${targetX - r},${sy}`,
      `Q ${targetX},${sy} ${targetX},${sy + r}`,
      `L ${targetX},${targetY}`,
    ].join(' ');
  }

  const targetX = sx + dropOffStubLength;
  return `M ${sx},${sy} L ${targetX},${sy}`;
};
