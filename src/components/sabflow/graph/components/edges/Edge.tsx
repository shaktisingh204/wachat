'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { LuX } from 'react-icons/lu';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { useSelectionStore } from '../../hooks/useSelectionStore';
import { computeEdgePath } from '../../helpers/computeEdgePath';
import { getAnchorsPosition } from '../../helpers/getAnchorsPosition';
import { groupWidth, eventWidth } from '../../constants';
import type { Edge as EdgeType } from '@/lib/sabflow/types';

type Props = {
  edge: EdgeType;
  fromGroupId: string | undefined;
  onDelete?: (edgeId: string) => void;
};

export function Edge({ edge, fromGroupId, onDelete }: Props) {
  const { previewingEdge, graphPosition, setPreviewingEdge, isReadOnly } = useGraph();
  const { sourceEndpointYOffsets, targetEndpointYOffsets } = useEndpoints();
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  const sourceTop = useMemo(() => {
    // Event-sourced edges register under eventId.
    // Block-sourced edges use itemId (for choice items) then blockId, mirroring
    // Typebot's pathId ?? itemId ?? blockId lookup order.
    const endpointId =
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
    // Use eventWidth for event-sourced edges so path exits at the correct right edge
    const sourceWidth = edge.from.eventId ? eventWidth : groupWidth;
    const anchorsPosition = getAnchorsPosition({
      sourceGroupCoordinates: fromGroupCoordinates,
      targetGroupCoordinates: toGroupCoordinates,
      elementWidth: sourceWidth,
      sourceTop,
      targetTop,
      graphScale: graphPosition.scale,
    });
    const computedPath = computeEdgePath(anchorsPosition);

    // Approximate the visual midpoint of the bezier so the delete button can be
    // placed on top of the curve where it is most visible.
    const sx = anchorsPosition.sourcePosition.x;
    const sy = anchorsPosition.sourcePosition.y;
    const tx = anchorsPosition.targetPosition.x;
    const ty = anchorsPosition.targetPosition.y;
    const midPoint = { x: (sx + tx) / 2, y: (sy + ty) / 2 };

    return { path: computedPath, midPoint };
  }, [fromGroupCoordinates, toGroupCoordinates, sourceTop, targetTop, graphPosition.scale, edge.from]);

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

  // The delete button is a small circle rendered as a foreignObject so we can
  // use normal DOM/React event handling. It appears at the approximate visual
  // midpoint of the bezier curve whenever the edge is hovered.
  const DELETE_BTN_R = 10; // radius in SVG user-units

  return (
    <>
      <g>
        {/* Wide invisible hit area — 18 px stroke so the edge is easy to click/hover */}
        <path
          data-testid="clickable-edge"
          d={path}
          strokeWidth={18}
          stroke="white"
          fill="none"
          pointerEvents="stroke"
          style={{ cursor: 'pointer', visibility: 'hidden' }}
          onMouseEnter={() => setIsMouseOver(true)}
          onMouseLeave={() => setIsMouseOver(false)}
          onClick={() => setPreviewingEdge(edge)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        />
        {/* Visible 2 px path — uses CSS variable colors so dark-mode overrides apply */}
        <path
          data-testid="edge"
          d={path}
          strokeWidth={2}
          stroke={isPreviewing ? 'var(--orange-8)' : 'var(--gray-8)'}
          fill="none"
          markerEnd={isPreviewing ? 'url(#orange-arrow)' : 'url(#arrow)'}
          pointerEvents="none"
        />

        {/* Delete button — shown at the midpoint when the edge is hovered */}
        {isPreviewing && midPoint && onDelete && !isReadOnly && (
          <foreignObject
            x={midPoint.x - DELETE_BTN_R}
            y={midPoint.y - DELETE_BTN_R}
            width={DELETE_BTN_R * 2}
            height={DELETE_BTN_R * 2}
            style={{ overflow: 'visible' }}
          >
            <button
              type="button"
              aria-label="Delete edge"
              title="Delete edge"
              style={{
                width: DELETE_BTN_R * 2,
                height: DELETE_BTN_R * 2,
                borderRadius: '50%',
                background: 'var(--orange-8)',
                border: '2px solid #fff',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              }}
              onMouseEnter={() => setIsMouseOver(true)}
              onMouseLeave={() => setIsMouseOver(false)}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(edge.id);
              }}
            >
              <LuX size={10} strokeWidth={3} />
            </button>
          </foreignObject>
        )}
      </g>

      {/* Right-click context menu — rendered into document.body via portal */}
      {contextMenu &&
        createPortal(
          <div
            className="fixed z-[9999] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-md py-1 min-w-[120px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-red-500 hover:bg-[var(--gray-3)]"
              onClick={() => {
                onDelete?.(edge.id);
                setContextMenu(null);
              }}
            >
              Delete edge
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
