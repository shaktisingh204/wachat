'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { useSelectionStore } from '../../hooks/useSelectionStore';
import { computeEdgePath } from '../../helpers/computeEdgePath';
import { getAnchorsPosition } from '../../helpers/getAnchorsPosition';
import { groupWidth } from '../../constants';
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
    const endpointId = edge.from.blockId ?? edge.from.groupId;
    return sourceEndpointYOffsets.get(endpointId)?.y;
  }, [edge.from, sourceEndpointYOffsets]);

  const targetTop = useMemo(() => {
    if (!edge.to.blockId) return undefined;
    return targetEndpointYOffsets.get(edge.to.blockId)?.y;
  }, [edge.to.blockId, targetEndpointYOffsets]);

  const path = useMemo(() => {
    if (!fromGroupCoordinates || !toGroupCoordinates || !sourceTop) return '';
    const anchorsPosition = getAnchorsPosition({
      sourceGroupCoordinates: fromGroupCoordinates,
      targetGroupCoordinates: toGroupCoordinates,
      elementWidth: groupWidth,
      sourceTop,
      targetTop,
      graphScale: graphPosition.scale,
    });
    return computeEdgePath(anchorsPosition);
  }, [fromGroupCoordinates, toGroupCoordinates, sourceTop, targetTop, graphPosition.scale]);

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
        {/* Visible 2 px path */}
        <path
          data-testid="edge"
          d={path}
          strokeWidth={2}
          stroke={isPreviewing ? '#f76808' : 'var(--gray-8)'}
          fill="none"
          markerEnd={isPreviewing ? 'url(#orange-arrow)' : 'url(#arrow)'}
          pointerEvents="none"
        />
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
