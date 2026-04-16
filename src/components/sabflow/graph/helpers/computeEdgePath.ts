import { roundCorners } from 'svg-round-corners';
import { pathRadius } from '../constants';
import type { AnchorsPositionProps } from './segments';
import { getSegments } from './segments';

export const computeEdgePath = ({
  sourcePosition,
  targetPosition,
  sourceType,
  totalSegments,
}: AnchorsPositionProps): string => {
  const segments = getSegments({
    sourcePosition,
    targetPosition,
    sourceType,
    totalSegments,
  });
  return roundCorners(
    `M${sourcePosition.x},${sourcePosition.y} ${segments}`,
    pathRadius,
  ).path;
};
