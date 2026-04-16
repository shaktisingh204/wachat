'use client';
import { useEffect } from 'react';
import { roundCorners } from 'svg-round-corners';
import { useConnections } from '../canvas/ConnectionsProvider';

/* ── Constants ───────────────────────────────────────────── */

/** Half the width of a rendered node card. Source X starts at right edge. */
export const NODE_WIDTH = 200;
const PATH_RADIUS = 16;
const STUB = 32;

/* ── Path helpers ────────────────────────────────────────── */

function buildPath(sx: number, sy: number, tx: number, ty: number): string {
  // Always exit right from the source, enter left into the target.
  const midX = sx + (tx - sx) / 2;
  const raw = [
    `M${sx},${sy}`,
    `L${sx + STUB},${sy}`,
    `L${midX},${sy}`,
    `L${midX},${ty}`,
    `L${tx - STUB},${ty}`,
    `L${tx},${ty}`,
  ].join(' ');
  return roundCorners(raw, PATH_RADIUS).path;
}

/* ── Props ───────────────────────────────────────────────── */

type Props = {
  /** Canvas-space position of the source output port dot (centre). */
  sourceX: number;
  sourceY: number;
  /**
   * Called when the user releases the mouse on an empty canvas area
   * (drop-on-node is handled by NodePortDot).
   */
  onCancel?: () => void;
};

/* ── DrawingEdge ─────────────────────────────────────────── */

export function DrawingEdge({ sourceX, sourceY, onCancel }: Props) {
  const { mousePosition, setMousePosition, cancelConnection } = useConnections();

  /* Track mouse position in canvas-space via the parent SVG. */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Parent SVG should have pointer-events: none at the SVG level;
      // callers transform screen coords to canvas coords before passing
      // to this component via setMousePosition — but we also accept raw
      // clientX/Y here as a fallback and let the parent handle the math.
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const onUp = () => {
      cancelConnection();
      onCancel?.();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setMousePosition, cancelConnection, onCancel]);

  const path = buildPath(sourceX, sourceY, mousePosition.x, mousePosition.y);

  return (
    <path
      d={path}
      strokeWidth={2}
      fill="none"
      markerEnd="url(#n8n-orange-arrow)"
      className="stroke-[#f76808] pointer-events-none"
      strokeDasharray="6 3"
    />
  );
}
