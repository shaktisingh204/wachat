import { roundCorners } from 'svg-round-corners';
import { pathRadius } from '../constants';
import type { Coordinates } from '@/lib/sabflow/types';
import { computeTwoSegments } from './segments';

export const dropOffBoxDimensions = { width: 100, height: 48 };
export const dropOffSegmentLength = 80;
export const dropOffStubLength = 30;

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
  const targetX =
    sourcePosition.x +
    (isLastBlock
      ? dropOffStubLength + dropOffBoxDimensions.width / 2
      : dropOffStubLength);
  const targetY =
    sourcePosition.y + (isLastBlock ? dropOffSegmentLength : 0);

  const segments = computeTwoSegments(sourcePosition, { x: targetX, y: targetY });

  return roundCorners(
    `M${sourcePosition.x},${sourcePosition.y} ${segments}`,
    pathRadius,
  ).path;
};
