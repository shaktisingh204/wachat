import type { Coordinates } from '@/lib/sabflow/types';

type SelectBoxCoordinates = {
  origin: Coordinates;
  dimension: {
    width: number;
    height: number;
  };
};

export const isSelectBoxIntersectingWithElement = (
  selectBoxCoordinates: SelectBoxCoordinates,
  elementRect: DOMRect,
): boolean =>
  selectBoxCoordinates.origin.x < elementRect.right &&
  selectBoxCoordinates.origin.x + selectBoxCoordinates.dimension.width > elementRect.left &&
  selectBoxCoordinates.origin.y < elementRect.bottom &&
  selectBoxCoordinates.origin.y + selectBoxCoordinates.dimension.height > elementRect.top;
