import { computePathToMouse } from './computeEdgePath';
import type { Coordinates } from '@/lib/sabflow/types';

export const computeEdgePathToMouse = ({
  sourceGroupCoordinates,
  mousePosition,
  sourceTop,
  elementWidth,
}: {
  sourceGroupCoordinates: Coordinates;
  mousePosition: Coordinates;
  sourceTop: number;
  elementWidth: number;
}): string => {
  const sourceX =
    mousePosition.x - sourceGroupCoordinates.x > elementWidth / 2
      ? sourceGroupCoordinates.x + elementWidth
      : sourceGroupCoordinates.x;

  return computePathToMouse(sourceX, sourceTop, mousePosition.x, mousePosition.y);
};
