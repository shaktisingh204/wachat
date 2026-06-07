'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { Plus, X } from 'lucide-react';
import { Button, ButtonGroup, IconButton } from '@/components/sabcrm/20ui';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { useSelectionStore } from '../../hooks/useSelectionStore';
import { computeEdgePathFull } from '../../helpers/computeEdgePath';
import { getAnchorsPosition } from '../../helpers/getAnchorsPosition';
import { groupWidth, eventWidth } from '../../constants';
import { getArrowMarkerId, getEdgeStrokeColor } from './ArrowMarker';
import { parsePortId } from '@/lib/sabflow/ports';
import type { Edge as EdgeType, PortType } from '@/lib/sabflow/types';

type Props = {
  edge: EdgeType;
  fromGroupId: string | undefined;
  onDelete?: (edgeId: string) => void;
  onInsertNode?: (edgeId: string, position: { x: number; y: number }) => void;
};

const TOOLBAR_SHOW_DELAY = 600;

export function Edge({ edge, fromGroupId, onDelete, onInsertNode }: Props) {
  const { previewingEdge, graphPosition, setPreviewingEdge, isReadOnly } = useGraph();
  const { sourceEndpointYOffsets, targetEndpointYOffsets } = useEndpoints();
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromGroupCoordinates = useSelectionStore(
    useShallow((s) =>
      fromGroupId && s.elementsCoordinates
        ? s.elementsCoordinates[fromGroupId]
        : undefined,
    ),
  );
  const toGroupCoordinates = useSelectionStore(
    useShallow((s) =>
      s.elementsCoordinates ? s.elementsCoordinates[edge.to.groupId] : undefined,
    ),
  );

  const isPreviewing = isMouseOver || previewingEdge?.id === edge.id;

  // Determine if this is a non-main port type (for dashed rendering)
  const portType = useMemo<PortType>(() => {
    const handle = edge.sourceHandle ?? 'outputs/main/0';
    const parsed = parsePortId(handle);
    return parsed?.type ?? 'main';
  }, [edge.sourceHandle]);

  const sourceTop = useMemo(() => {
    // For multi-pin blocks, MultiSourceEndpoints registers each pin under
    // the composite key `${blockId}:${pinId}`. Fall back to plain blockId
    // when the edge has no pinId (single-endpoint blocks).
    const pinKey =
      'blockId' in edge.from && edge.from.blockId && edge.from.pinId
        ? `${edge.from.blockId}:${edge.from.pinId}`
        : undefined;
    const endpointId =
      pinKey ??
      edge.from.eventId ??
      ('itemId' in edge.from ? edge.from.itemId : undefined) ??
      ('blockId' in edge.from ? edge.from.blockId : undefined);
    return endpointId ? sourceEndpointYOffsets.get(endpointId)?.y : undefined;
  }, [edge.from, sourceEndpointYOffsets]);

  const targetTop = useMemo(() => {
    if (!edge.to.blockId) return undefined;
    return targetEndpointYOffsets.get(edge.to.blockId)?.y;
  }, [edge.to.blockId, targetEndpointYOffsets]);

  const { path, midPoint } = useMemo(() => {
    if (!fromGroupCoordinates || !toGroupCoordinates || !sourceTop) {
      return { path: '', midPoint: null };
    }
    const sourceWidth = edge.from.eventId ? eventWidth : groupWidth;
    const anchorsPosition = getAnchorsPosition({
      sourceGroupCoordinates: fromGroupCoordinates,
      targetGroupCoordinates: toGroupCoordinates,
      elementWidth: sourceWidth,
      sourceTop,
      targetTop,
      graphScale: graphPosition.scale,
    });

    const result = computeEdgePathFull(
      anchorsPosition.sourcePosition.x,
      anchorsPosition.sourcePosition.y,
      anchorsPosition.targetPosition.x,
      anchorsPosition.targetPosition.y,
    );

    return { path: result.path, midPoint: result.midPoint };
  }, [fromGroupCoordinates, toGroupCoordinates, sourceTop, targetTop, graphPosition.scale, edge.from]);

  // Toolbar show/hide with delay
  useEffect(() => {
    if (isMouseOver && !isReadOnly) {
      toolbarTimerRef.current = setTimeout(() => setShowToolbar(true), TOOLBAR_SHOW_DELAY);
    } else {
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
      setShowToolbar(false);
    }
    return () => {
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    };
  }, [isMouseOver, isReadOnly]);

  // Close context menu on next outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Delete edge with Backspace / Delete when this edge is being previewed
  useEffect(() => {
    if (!isPreviewing || isReadOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        onDelete?.(edge.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPreviewing, isReadOnly, edge.id, onDelete]);

  if (!path) return null;

  const strokeColor = getEdgeStrokeColor(edge.status, isPreviewing);
  const markerEnd = getArrowMarkerId(edge.status, isPreviewing);
  const isNonMain = portType !== 'main';
  const isRunning = edge.status === 'running';

  const TOOLBAR_SIZE = 24;

  return (
    <>
      <g>
        {/* Wide invisible hit area */}
        <path
          data-testid="clickable-edge"
          d={path}
          strokeWidth={18}
          stroke="white"
          fill="none"
          pointerEvents="stroke"
          className="invisible cursor-pointer"
          onMouseEnter={() => setIsMouseOver(true)}
          onMouseLeave={() => setIsMouseOver(false)}
          onClick={() => setPreviewingEdge(edge)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        />

        {/* Visible edge path */}
        <path
          data-testid="edge"
          d={path}
          strokeWidth={isPreviewing ? 2.5 : 2}
          stroke={strokeColor}
          fill="none"
          markerEnd={markerEnd}
          pointerEvents="none"
          strokeDasharray={isRunning ? '8,4' : isNonMain ? '5,6' : 'none'}
          // Animated "flow" dashes are a runtime SVG animation referencing the
          // edgeFlowAnimation keyframe declared in Edges.tsx, no token equivalent.
          style={isRunning ? { animation: 'edgeFlowAnimation 1s linear infinite' } : undefined}
        />

        {/* Edge toolbar, appears at midpoint after hover delay */}
        {showToolbar && midPoint && !isReadOnly && (
          <foreignObject
            x={midPoint.x - TOOLBAR_SIZE}
            y={midPoint.y - TOOLBAR_SIZE / 2}
            width={TOOLBAR_SIZE * 2}
            height={TOOLBAR_SIZE}
            className="overflow-visible"
          >
            <div
              className="ui20 mx-auto w-fit rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-sm"
              onMouseEnter={() => setIsMouseOver(true)}
              onMouseLeave={() => setIsMouseOver(false)}
            >
              <ButtonGroup>
                {/* Add node button */}
                <IconButton
                  label="Insert node"
                  icon={Plus}
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertNode?.(edge.id, midPoint);
                  }}
                />

                {/* Delete edge button */}
                {onDelete && (
                  <IconButton
                    label="Delete edge"
                    icon={X}
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(edge.id);
                    }}
                  />
                )}
              </ButtonGroup>
            </div>
          </foreignObject>
        )}
      </g>

      {/* Right-click context menu */}
      {contextMenu &&
        createPortal(
          <div
            className="ui20 fixed z-[9999] min-w-[120px] rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              block
              iconLeft={X}
              className="justify-start"
              onClick={() => {
                onDelete?.(edge.id);
                setContextMenu(null);
              }}
            >
              Delete edge
            </Button>
          </div>,
          document.body,
        )}
    </>
  );
}
