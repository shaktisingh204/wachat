'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { HandleDot } from './HandleDot';
import { cn } from '@/lib/utils';
import type { NodePort } from '@/lib/sabflow/types';

type Props = {
  port: NodePort;
  blockId: string;
  groupId: string;
  /** Vertical offset from top of the block (px). */
  topOffset: number;
  /** Whether an edge already starts from this handle. */
  hasOutgoingEdge?: boolean;
  className?: string;
};

/**
 * Output handle — positioned on the right edge of a block card.
 *
 * Registers its Y offset with EndpointsProvider using the composite key
 * `{blockId}:{handleId}`. Starting a connection drag on this handle sets
 * `connectingIds` with the source info including the handle ID.
 */
export function OutputHandle({
  port,
  blockId,
  groupId,
  topOffset,
  hasOutgoingEdge = false,
  className,
}: Props) {
  const { canvasPosition, connectingIds, setConnectingIds, previewingEdge, graphPosition } = useGraph();
  const { setSourceEndpointYOffset, deleteSourceEndpointYOffset } = useEndpoints();
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [groupHeight, setGroupHeight] = useState<number>();
  const [groupTransform, setGroupTransform] = useState<string>();

  const endpointId = `${blockId}:${port.id}`;

  const isPreviewing =
    previewingEdge &&
    'blockId' in previewingEdge.from &&
    previewingEdge.from.blockId === blockId;

  const isDraggingFromHere =
    connectingIds?.source.blockId === blockId;

  const handleState = useMemo(() => {
    if (isHovered || isDraggingFromHere || isPreviewing) return 'hover';
    if (hasOutgoingEdge) return 'connected';
    return 'default';
  }, [isHovered, isDraggingFromHere, isPreviewing, hasOutgoingEdge]);

  // Compute canvas-space Y
  const endpointY = useMemo(() => {
    if (!ref.current) return undefined;
    const sourceH = 32;
    return Number(
      ((ref.current.getBoundingClientRect().y +
        (sourceH * canvasPosition.scale) / 2 -
        canvasPosition.y) /
        canvasPosition.scale).toFixed(2),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasPosition.scale, canvasPosition.y, groupHeight, groupTransform]);

  useLayoutEffect(() => {
    const el = document.getElementById(`group-${groupId}`);
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setGroupHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [groupId]);

  useLayoutEffect(() => {
    const el = document.getElementById(`group-${groupId}`);
    if (!el) return;
    const mo = new MutationObserver((entries) => {
      setGroupTransform((entries[0].target as HTMLElement).style.transform);
    });
    mo.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => mo.disconnect();
  }, [groupId]);

  useEffect(() => {
    if (endpointY === undefined) return;
    setSourceEndpointYOffset({ id: endpointId, y: endpointY });
  }, [setSourceEndpointYOffset, endpointId, endpointY]);

  useEffect(() => {
    return () => deleteSourceEndpointYOffset(endpointId);
  }, [deleteSourceEndpointYOffset, endpointId]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      setConnectingIds({
        source: { groupId, blockId },
      });
    },
    [groupId, blockId, setConnectingIds],
  );

  return (
    <div
      ref={ref}
      data-handle-id={port.id}
      data-handle-mode="output"
      className={cn(
        'prevent-group-drag absolute flex items-center justify-center cursor-copy pointer-events-auto',
        className,
      )}
      style={{
        right: -20,
        top: topOffset,
        width: 20,
        height: 20,
      }}
      onPointerDown={handlePointerDown}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <HandleDot state={handleState} scale={graphPosition.scale} />

      {/* Label tooltip */}
      {isHovered && port.label && graphPosition.scale > 0.6 && (
        <div
          className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-[var(--gray-12)] px-1.5 py-0.5 text-[10px] text-[var(--gray-1)] shadow-sm pointer-events-none z-50"
        >
          {port.label}
        </div>
      )}
    </div>
  );
}
