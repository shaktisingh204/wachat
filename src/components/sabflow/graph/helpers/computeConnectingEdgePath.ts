import { computeEdgePath } from './computeEdgePath';
import { getAnchorsPosition, type GetAnchorsPositionProps } from './getAnchorsPosition';

export const computeConnectingEdgePath = (props: GetAnchorsPositionProps): string => {
  const anchorsPosition = getAnchorsPosition(props);
  return computeEdgePath(anchorsPosition);
};
