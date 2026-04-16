import { stubLength } from '../constants';
import type { Coordinates } from '@/lib/sabflow/types';

export type AnchorsPositionProps = {
  sourcePosition: Coordinates;
  targetPosition: Coordinates;
  sourceType: 'right' | 'left';
  totalSegments: number;
};

export const getSegments = ({
  sourcePosition,
  targetPosition,
  sourceType,
  totalSegments,
}: AnchorsPositionProps): string => {
  switch (totalSegments) {
    case 2: return computeTwoSegments(sourcePosition, targetPosition);
    case 3: return computeThreeSegments(sourcePosition, targetPosition, sourceType);
    case 4: return computeFourSegments(sourcePosition, targetPosition, sourceType);
    default: return computeFiveSegments(sourcePosition, targetPosition, sourceType);
  }
};

export const computeTwoSegments = (s: Coordinates, t: Coordinates) => [
  `L${t.x},${s.y}`,
  `L${t.x},${t.y}`,
].join(' ');

export const computeThreeSegments = (
  s: Coordinates,
  t: Coordinates,
  sourceType: 'right' | 'left',
) => {
  const midX = sourceType === 'right'
    ? s.x + (t.x - s.x) / 2
    : s.x - (s.x - t.x) / 2;
  return [`L${midX},${s.y}`, `L${midX},${t.y}`, `L${t.x},${t.y}`].join(' ');
};

export const computeFourSegments = (
  s: Coordinates,
  t: Coordinates,
  sourceType: 'right' | 'left',
) => {
  const x1 = s.x + (sourceType === 'right' ? stubLength : -stubLength);
  const y2 = s.y + (t.y - s.y) - stubLength;
  return [
    `L${x1},${s.y}`,
    `L${x1},${y2}`,
    `L${t.x},${y2}`,
    `L${t.x},${t.y}`,
  ].join(' ');
};

export const computeFiveSegments = (
  s: Coordinates,
  t: Coordinates,
  sourceType: 'right' | 'left',
) => {
  const x1 = s.x + (sourceType === 'right' ? stubLength : -stubLength);
  const y1 = s.y + (t.y - s.y) / 2;
  return [
    `L${x1},${s.y}`,
    `L${x1},${y1}`,
    `L${t.x + (sourceType === 'right' ? -stubLength : stubLength)},${y1}`,
    `L${t.x + (sourceType === 'right' ? -stubLength : stubLength)},${t.y}`,
    `L${t.x},${t.y}`,
  ].join(' ');
};
