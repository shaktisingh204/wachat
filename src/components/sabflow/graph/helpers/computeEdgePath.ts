import type { Coordinates } from '@/lib/sabflow/types';

/**
 * n8n-style edge path computation.
 *
 * - **Forward connection** (target is to the right of source): smooth bezier curve.
 * - **Backward connection** (target is to the left): 2-segment smooth-step path
 *   that wraps around below the nodes with rounded corners.
 */

const HANDLE_SIZE = 16;
const BACKWARD_PADDING_BOTTOM = 130;
const BACKWARD_PADDING_X = 40;
const BORDER_RADIUS = 16;
const MAX_CONTROL_OFFSET = 150;

export type EdgePathResult = {
  path: string;
  midPoint: Coordinates;
  isBackward: boolean;
};

/** Detect whether the connection goes backward (target left of source). */
function isBackwardConnection(sx: number, tx: number): boolean {
  return tx < sx + HANDLE_SIZE;
}

/** Forward bezier path (n8n style). */
function getBezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const controlOffset = Math.min(Math.abs(tx - sx) * 0.5, MAX_CONTROL_OFFSET);
  return `M ${sx},${sy} C ${sx + controlOffset},${sy} ${tx - controlOffset},${ty} ${tx},${ty}`;
}

/**
 * Backward smooth-step path (n8n style).
 *
 * The path goes: right from source, down, left under both nodes, then up to target.
 * All corners are rounded with quadratic bezier arcs.
 */
function getBackwardPath(sx: number, sy: number, tx: number, ty: number): string {
  const r = BORDER_RADIUS;
  const padX = BACKWARD_PADDING_X;
  const padBottom = BACKWARD_PADDING_BOTTOM;

  // Exit to the right of source
  const exitX = sx + padX;
  // Enter from the left of target
  const enterX = tx - padX;
  // Bottom of the wrap-around
  const bottomY = Math.max(sy, ty) + padBottom;

  const segments: string[] = [];
  segments.push(`M ${sx},${sy}`);

  // Segment 1: horizontal right from source
  segments.push(`L ${exitX - r},${sy}`);
  // Corner: down-right
  segments.push(`Q ${exitX},${sy} ${exitX},${sy + r}`);

  // Segment 2: vertical down to bottom
  segments.push(`L ${exitX},${bottomY - r}`);
  // Corner: bottom-right to left
  segments.push(`Q ${exitX},${bottomY} ${exitX - r},${bottomY}`);

  // Segment 3: horizontal left across to target side
  segments.push(`L ${enterX + r},${bottomY}`);
  // Corner: bottom-left to up
  segments.push(`Q ${enterX},${bottomY} ${enterX},${bottomY - r}`);

  // Segment 4: vertical up to target height
  segments.push(`L ${enterX},${ty + r}`);
  // Corner: up to right
  segments.push(`Q ${enterX},${ty} ${enterX + r},${ty}`);

  // Segment 5: horizontal right to target
  segments.push(`L ${tx},${ty}`);

  return segments.join(' ');
}

/**
 * Compute the SVG path and midpoint for an edge between two anchor points.
 *
 * This replaces the old Typebot-style segment + roundCorners approach with
 * n8n-style bezier (forward) and smooth-step (backward) paths.
 */
export function computeEdgePath(anchors: {
  sourcePosition: Coordinates;
  targetPosition: Coordinates;
  sourceType?: 'right' | 'left';
  totalSegments?: number;
}): string {
  const { sourcePosition: s, targetPosition: t } = anchors;
  const backward = isBackwardConnection(s.x, t.x);

  if (backward) {
    return getBackwardPath(s.x, s.y, t.x, t.y);
  }
  return getBezierPath(s.x, s.y, t.x, t.y);
}

/**
 * Full edge path result including midpoint and direction info — used by
 * the Edge component for toolbar placement.
 */
export function computeEdgePathFull(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): EdgePathResult {
  const backward = isBackwardConnection(sx, tx);

  let path: string;
  let midPoint: Coordinates;

  if (backward) {
    path = getBackwardPath(sx, sy, tx, ty);
    const bottomY = Math.max(sy, ty) + BACKWARD_PADDING_BOTTOM;
    // Midpoint at the bottom of the wrap-around
    midPoint = { x: (sx + tx) / 2, y: bottomY };
  } else {
    path = getBezierPath(sx, sy, tx, ty);
    // Midpoint of bezier curve (approximate — the true t=0.5 point is close
    // enough for a toolbar placement).
    midPoint = { x: (sx + tx) / 2, y: (sy + ty) / 2 };
  }

  return { path, midPoint, isBackward: backward };
}

/**
 * Compute a path from a source point to the current mouse position.
 * Used by DrawingEdge during connection dragging.
 */
export function computePathToMouse(
  sx: number,
  sy: number,
  mx: number,
  my: number,
): string {
  const backward = isBackwardConnection(sx, mx);
  if (backward) {
    return getBackwardPath(sx, sy, mx, my);
  }
  return getBezierPath(sx, sy, mx, my);
}
