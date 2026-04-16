import type { Coordinates } from '@/lib/sabflow/types';

export const stubLength = 20;
export const pathRadius = 20;

export function computeEdgePath({
  from,
  to,
}: {
  from: Coordinates;
  to: Coordinates;
}): string {
  const fromX = from.x + stubLength;
  const fromY = from.y;
  const toX = to.x - stubLength;
  const toY = to.y;

  const midX = (fromX + toX) / 2;
  const cp1X = Math.max(fromX + 80, midX);
  const cp2X = Math.min(toX - 80, midX);

  return `M${fromX},${fromY} C${cp1X},${fromY} ${cp2X},${toY} ${toX},${toY}`;
}
