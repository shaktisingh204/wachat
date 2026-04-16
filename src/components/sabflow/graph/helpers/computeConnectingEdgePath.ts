import { computeEdgePath } from './computeEdgePath';
import { getAnchorsPosition, type GetAnchorsPositionProps } from './getAnchorsPosition';

export const computeConnectingEdgePath = ({
  sourceGroupCoordinates,
  targetGroupCoordinates,
  elementWidth,
  sourceTop,
  targetTop,
  graphScale,
}: GetAnchorsPositionProps): string => {
  const anchorsPosition = getAnchorsPosition({
    sourceGroupCoordinates,
    targetGroupCoordinates,
    elementWidth,
    sourceTop,
    targetTop,
    graphScale,
  });
  return computeEdgePath(anchorsPosition);
};
