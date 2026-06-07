'use client';
import { Plus, Minus, Maximize2, Map } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button, IconButton } from '@/components/sabcrm/20ui';
import type { Group, SabFlowEvent, GraphPosition } from '@/lib/sabflow/types';

/** Approximate dimensions of a rendered group node (px in canvas space). */
const GROUP_NODE_WIDTH = 300;
const GROUP_NODE_HEIGHT = 100;
/** Approximate dimensions of an event node. */
const EVENT_NODE_WIDTH = 200;
const EVENT_NODE_HEIGHT = 70;
/** Padding (px in viewport space) around fitted content. */
const FIT_PADDING = 80;

type Props = {
  graphPosition: GraphPosition;
  setGraphPosition: Dispatch<SetStateAction<GraphPosition>>;
  groups: Group[];
  events: SabFlowEvent[];
  /** Called when the user clicks the minimap toggle button. */
  onToggleMiniMap: () => void;
  /** Whether the minimap is currently visible. */
  isMiniMapOpen: boolean;
  /** Ref to the canvas container, used to read its width/height for fit-view. */
  canvasRef: React.RefObject<HTMLDivElement | null>;
};

const maxScale = 2;
const minScale = 0.2;
const zoomStep = 0.2;

export function ZoomButtons({
  graphPosition,
  setGraphPosition,
  groups,
  events,
  onToggleMiniMap,
  isMiniMapOpen,
  canvasRef,
}: Props) {
  const handleZoomIn = () => {
    setGraphPosition((pos) => ({
      ...pos,
      scale: Math.min(maxScale, pos.scale + zoomStep),
    }));
  };

  const handleZoomOut = () => {
    setGraphPosition((pos) => ({
      ...pos,
      scale: Math.max(minScale, pos.scale - zoomStep),
    }));
  };

  const handleResetZoom = () => {
    setGraphPosition({ x: 0, y: 0, scale: 1 });
  };

  const handleFitView = () => {
    if (!canvasRef.current) return;

    // Build list of all elements with their bounding boxes in canvas space
    const items: Array<{ x: number; y: number; w: number; h: number }> = [
      ...groups.map((g) => ({
        x: g.graphCoordinates.x,
        y: g.graphCoordinates.y,
        w: GROUP_NODE_WIDTH,
        h: GROUP_NODE_HEIGHT,
      })),
      ...events.map((ev) => ({
        x: ev.graphCoordinates.x,
        y: ev.graphCoordinates.y,
        w: EVENT_NODE_WIDTH,
        h: EVENT_NODE_HEIGHT,
      })),
    ];

    if (items.length === 0) {
      setGraphPosition({ x: 0, y: 0, scale: 1 });
      return;
    }

    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.w));
    const maxY = Math.max(...items.map((i) => i.y + i.h));

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const canvasW = canvasRef.current.clientWidth;
    const canvasH = canvasRef.current.clientHeight;

    const availableW = canvasW - FIT_PADDING * 2;
    const availableH = canvasH - FIT_PADDING * 2;

    const scaleX = availableW / contentW;
    const scaleY = availableH / contentH;
    const newScale = Math.min(maxScale, Math.max(minScale, Math.min(scaleX, scaleY)));

    // Translate so the content bounding box is centred in the canvas
    const scaledW = contentW * newScale;
    const scaledH = contentH * newScale;
    const newX = (canvasW - scaledW) / 2 - minX * newScale;
    const newY = (canvasH - scaledH) / 2 - minY * newScale;

    setGraphPosition({ x: newX, y: newY, scale: newScale });
  };

  const divider = <div className="w-px self-stretch bg-[var(--st-border)]" />;

  return (
    <>
      {/* Zoom out */}
      <IconButton
        label="Zoom out (-)"
        icon={Minus}
        size="sm"
        variant="ghost"
        onClick={handleZoomOut}
      />

      {divider}

      {/* Current zoom - click to reset to 100% */}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleResetZoom}
        title="Reset zoom to 100%"
        aria-label="Reset zoom to 100 percent"
        className="tabular-nums"
      >
        {Math.round(graphPosition.scale * 100)}%
      </Button>

      {divider}

      {/* Zoom in */}
      <IconButton
        label="Zoom in (+)"
        icon={Plus}
        size="sm"
        variant="ghost"
        onClick={handleZoomIn}
      />

      {divider}

      {/* Fit view */}
      <IconButton
        label="Fit all nodes in view"
        icon={Maximize2}
        size="sm"
        variant="ghost"
        onClick={handleFitView}
      />

      {divider}

      {/* Toggle minimap */}
      <IconButton
        label={isMiniMapOpen ? 'Hide minimap' : 'Show minimap'}
        icon={Map}
        size="sm"
        variant={isMiniMapOpen ? 'outline' : 'ghost'}
        aria-pressed={isMiniMapOpen}
        onClick={onToggleMiniMap}
      />
    </>
  );
}
