'use client';
/**
 * CanvasEdge — port of n8n's CanvasEdge.vue.
 *
 * Renders a bezier path (or a smooth-step path when the source is to the right
 * of the target, mimicking n8n's getEdgeRenderData backwards handling). Edge
 * toolbar appears at midpoint on hover after a short delay.
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { EdgeProps, EdgeTypes } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, Position } from '@xyflow/react';
import { CanvasEdgeToolbar } from './CanvasEdgeToolbar';
import type { CanvasEdge as CanvasEdgeType } from '../types';
import { EDGE_TOOLBAR_HOVER_DELAY } from '../constants';
import { cn } from '@/lib/utils';
import { useCanvasHandlers } from '../CanvasHandlersContext';

const EDGE_PADDING_BOTTOM = 130;
const EDGE_PADDING_X = 40;
const EDGE_BORDER_RADIUS = 16;
const HANDLE_SIZE = 20;

/** Match n8n's two-segment fallback when source is right-of target. */
function renderEdgePath(p: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  isMain: boolean;
}) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, isMain } = p;
  const isBackwards = sourceX - HANDLE_SIZE <= targetX;

  if (isBackwards || !isMain) {
    const [d, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
    return { d, labelX, labelY, segments: [d] };
  }

  const midX = (sourceX + targetX) / 2;
  const midY = sourceY + EDGE_PADDING_BOTTOM;

  const [firstD] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX: midX,
    targetY: midY,
    sourcePosition,
    targetPosition: Position.Right,
    borderRadius: EDGE_BORDER_RADIUS,
    offset: EDGE_PADDING_X,
  });
  const [secondD] = getSmoothStepPath({
    sourceX: midX,
    sourceY: midY,
    targetX,
    targetY,
    sourcePosition: Position.Left,
    targetPosition,
    borderRadius: EDGE_BORDER_RADIUS,
    offset: EDGE_PADDING_X,
  });

  return {
    d: firstD + ' ' + secondD,
    labelX: midX,
    labelY: midY,
    segments: [firstD, secondD],
  };
}

export const CanvasEdge = memo(function CanvasEdge(
  props: EdgeProps<CanvasEdgeType>,
) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    data,
    markerEnd,
  } = props;

  const handlers = useCanvasHandlers();
  const onAdd = handlers.onEdgeAdd;
  const onDelete = handlers.onEdgeDelete;
  const readOnly = handlers.isReadOnly;

  const isMain = data?.source?.type === 'main' && data?.target?.type === 'main';
  const status = data?.status;

  const { segments, labelX, labelY } = renderEdgePath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetPosition: targetPosition ?? Position.Left,
    isMain,
  });

  const [hovered, setHovered] = useState(false);
  const [delayedHovered, setDelayedHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hovered) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setDelayedHovered(true);
    } else {
      timerRef.current = setTimeout(
        () => setDelayedHovered(false),
        EDGE_TOOLBAR_HOVER_DELAY,
      );
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hovered]);

  const edgeClassName = cn(
    selected && 'selected',
    !isMain && 'is-non-main',
    status === 'success' && 'is-success',
    status === 'error' && 'is-error',
    status === 'pinned' && 'is-pinned',
    status === 'running' && 'is-running',
  );

  return (
    <g
      className={edgeClassName}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="canvas-edge"
    >
      {segments.map((d, i) => (
        <BaseEdge
          key={`${id}-seg-${i}`}
          id={i === 0 ? id : `${id}-${i}`}
          path={d}
          markerEnd={isMain ? markerEnd : undefined}
          interactionWidth={40}
        />
      ))}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="nodrag nopan"
        >
          {delayedHovered && !readOnly ? (
            <CanvasEdgeToolbar
              canAdd={isMain}
              onAdd={() => onAdd?.(id)}
              onDelete={() => onDelete?.(id)}
            />
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
});

/** Module-level stable edge-type map. See CanvasNode.tsx for the same pattern. */
export const CANVAS_EDGE_TYPES: EdgeTypes = {
  canvasEdge: CanvasEdge,
};
