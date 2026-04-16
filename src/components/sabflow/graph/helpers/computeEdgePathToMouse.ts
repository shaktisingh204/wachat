import { roundCorners } from 'svg-round-corners';
import { pathRadius } from '../constants';
import { computeThreeSegments } from './segments';
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
  const isRightSide = mousePosition.x - sourceGroupCoordinates.x > elementWidth / 2;
  const sourcePosition: Coordinates = {
    x: isRightSide
      ? sourceGroupCoordinates.x + elementWidth
      : sourceGroupCoordinates.x,
    y: sourceTop,
  };
  const sourceType: 'right' | 'left' = isRightSide ? 'right' : 'left';
  const segments = computeThreeSegments(sourcePosition, mousePosition, sourceType);
  return roundCorners(
    `M${sourcePosition.x},${sourcePosition.y} ${segments}`,
    pathRadius,
  ).path;
};
