'use client';
import { useRef } from 'react';
import { LuX } from 'react-icons/lu';
import type { Dispatch, SetStateAction } from 'react';
import type { Group, SabFlowEvent, GraphPosition } from '@/lib/sabflow/types';

/** Minimap viewport dimensions (px). */
const MINI_W = 160;
const MINI_H = 100;

/** Approximate canvas-space sizes for each element type. */
const GROUP_W = 300;
const GROUP_H = 100;
const EVENT_W = 200;
const EVENT_H = 70;

/** Padding around content inside the minimap (canvas units). */
const CONTENT_PADDING = 200;

type Props = {
  graphPosition: GraphPosition;
  setGraphPosition: Dispatch<SetStateAction<GraphPosition>>;
  groups: Group[];
  events: SabFlowEvent[];
  /** Ref to the real canvas container, used to read its screen size. */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

/** Compute the bounding box of all canvas elements. */
function computeBounds(groups: Group[], events: SabFlowEvent[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  groups.forEach((g) => {
    minX = Math.min(minX, g.graphCoordinates.x);
    minY = Math.min(minY, g.graphCoordinates.y);
    maxX = Math.max(maxX, g.graphCoordinates.x + GROUP_W);
    maxY = Math.max(maxY, g.graphCoordinates.y + GROUP_H);
  });

  events.forEach((ev) => {
    minX = Math.min(minX, ev.graphCoordinates.x);
    minY = Math.min(minY, ev.graphCoordinates.y);
    maxX = Math.max(maxX, ev.graphCoordinates.x + EVENT_W);
    maxY = Math.max(maxY, ev.graphCoordinates.y + EVENT_H);
  });

  // Default to a small area at origin when there's nothing to show
  if (!isFinite(minX)) {
    return { minX: -400, minY: -300, maxX: 400, maxY: 300 };
  }

  return {
    minX: minX - CONTENT_PADDING,
    minY: minY - CONTENT_PADDING,
    maxX: maxX + CONTENT_PADDING,
    maxY: maxY + CONTENT_PADDING,
  };
}

export function CanvasMiniMap({
  graphPosition,
  setGraphPosition,
  groups,
  events,
  canvasRef,
  onClose,
}: Props) {
  const miniRef = useRef<HTMLDivElement>(null);

  const bounds = computeBounds(groups, events);
  const boundsW = bounds.maxX - bounds.minX;
  const boundsH = bounds.maxY - bounds.minY;

  // Scale factor: minimap px per canvas-space unit
  const scaleX = MINI_W / boundsW;
  const scaleY = MINI_H / boundsH;
  const miniScale = Math.min(scaleX, scaleY);

  /** Convert a canvas-space coordinate to minimap pixel position. */
  const toMini = (cx: number, cy: number) => ({
    left: (cx - bounds.minX) * miniScale,
    top: (cy - bounds.minY) * miniScale,
  });

  // Current viewport rectangle in canvas space
  const canvasW = canvasRef.current?.clientWidth ?? 1200;
  const canvasH = canvasRef.current?.clientHeight ?? 800;

  const vpLeft = -graphPosition.x / graphPosition.scale;
  const vpTop = -graphPosition.y / graphPosition.scale;
  const vpW = canvasW / graphPosition.scale;
  const vpH = canvasH / graphPosition.scale;

  const vpMini = toMini(vpLeft, vpTop);
  const vpMiniW = vpW * miniScale;
  const vpMiniH = vpH * miniScale;

  /** Click anywhere on the minimap to navigate there. */
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!miniRef.current) return;
    const rect = miniRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Canvas-space coordinate of the clicked point
    const canvasX = clickX / miniScale + bounds.minX;
    const canvasY = clickY / miniScale + bounds.minY;

    // Centre the viewport on that canvas point
    setGraphPosition((pos) => ({
      ...pos,
      x: -(canvasX - canvasW / pos.scale / 2) * pos.scale,
      y: -(canvasY - canvasH / pos.scale / 2) * pos.scale,
    }));
  };

  return (
    <div
      className="absolute bottom-16 right-4 z-20 rounded-lg overflow-hidden shadow-lg border border-[var(--gray-5)]"
      style={{ width: MINI_W, height: MINI_H, backgroundColor: 'var(--gray-2)' }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-1 right-1 z-10 flex h-4 w-4 items-center justify-center rounded text-[var(--gray-9)] hover:text-[var(--gray-12)] hover:bg-[var(--gray-4)] transition-colors"
        title="Close minimap"
      >
        <LuX size={10} />
      </button>

      {/* Clickable minimap surface */}
      <div
        ref={miniRef}
        className="absolute inset-0 cursor-crosshair"
        onClick={handleClick}
        style={{
          backgroundImage: 'radial-gradient(var(--gray-5) 1px, transparent 0)',
          backgroundSize: '8px 8px',
        }}
      >
        {/* Group nodes — orange rectangles */}
        {groups.map((g) => {
          const pos = toMini(g.graphCoordinates.x, g.graphCoordinates.y);
          return (
            <div
              key={g.id}
              className="absolute rounded-[1px]"
              style={{
                left: pos.left,
                top: pos.top,
                width: GROUP_W * miniScale,
                height: GROUP_H * miniScale,
                backgroundColor: 'rgba(249, 115, 22, 0.7)',
              }}
            />
          );
        })}

        {/* Event nodes — gray rectangles */}
        {events.map((ev) => {
          const pos = toMini(ev.graphCoordinates.x, ev.graphCoordinates.y);
          return (
            <div
              key={ev.id}
              className="absolute rounded-[1px]"
              style={{
                left: pos.left,
                top: pos.top,
                width: EVENT_W * miniScale,
                height: EVENT_H * miniScale,
                backgroundColor: 'rgba(107, 114, 128, 0.7)',
              }}
            />
          );
        })}

        {/* Current viewport indicator */}
        <div
          className="absolute pointer-events-none rounded-[1px]"
          style={{
            left: vpMini.left,
            top: vpMini.top,
            width: vpMiniW,
            height: vpMiniH,
            border: '1.5px solid rgba(249, 115, 22, 0.9)',
            backgroundColor: 'rgba(249, 115, 22, 0.08)',
          }}
        />
      </div>
    </div>
  );
}
