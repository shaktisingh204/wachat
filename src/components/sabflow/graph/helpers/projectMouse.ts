import type { RefObject } from 'react';
import type { Coordinates, GraphPosition } from '@/lib/sabflow/types';

export const projectMouse = (
  clientX: number,
  clientY: number,
  canvasRef: RefObject<HTMLDivElement | null>,
  graphPosition: GraphPosition,
): Coordinates => {
  const canvas = canvasRef.current;
  if (!canvas) return { x: clientX, y: clientY };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - graphPosition.x) / graphPosition.scale,
    y: (clientY - rect.top - graphPosition.y) / graphPosition.scale,
  };
};
