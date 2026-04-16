import type { GraphPosition } from '@/lib/sabflow/types';

export const projectMouse = (
  mousePos: { clientX: number; clientY: number },
  canvasRect: DOMRect,
  graphPosition: GraphPosition,
) => ({
  x: (mousePos.clientX - canvasRect.left - graphPosition.x) / graphPosition.scale,
  y: (mousePos.clientY - canvasRect.top - graphPosition.y) / graphPosition.scale,
});
