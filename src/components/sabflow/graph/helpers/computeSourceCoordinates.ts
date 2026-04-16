import type { Coordinates } from '@/lib/sabflow/types';

export const computeSourceCoordinates = ({
  sourcePosition,
  sourceTop,
  elementWidth,
}: {
  sourcePosition: Coordinates;
  sourceTop: number;
  elementWidth: number;
}): Coordinates => ({
  x: sourcePosition.x + elementWidth,
  y: sourceTop,
});
