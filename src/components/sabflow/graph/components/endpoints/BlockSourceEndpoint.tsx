'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useBlockDnd } from '../../providers/GraphDndProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { cn } from '@/lib/utils';
import { endpointSourceHeight } from '../../constants';

type Props = {
  blockId: string;
  groupId: string;
  /** When set, this endpoint belongs to an item (not the block itself). */
  itemId?: string;
  /**
   * When true the outer wrapper remains invisible — used by ItemNode to
   * hide the endpoint unless the parent item is hovered or connected.
   */
  isHidden?: boolean;
  /**
   * Pass `true` when an edge already starts from this source so the endpoint
   * shows a persistent small gray dot even when the parent block is not hovered.
   */
  hasOutgoingEdge?: boolean;
  className?: string;
};

export function BlockSourceEndpoint({
  blockId,
  groupId,
  itemId,
  isHidden,
  hasOutgoingEdge = false,
  className,
}: Props) {
  const { canvasPosition, connectingIds, setConnectingIds, previewingEdge } = useGraph();
  const { mouseOverBlock } = useBlockDnd();
  const { setSourceEndpointYOffset, deleteSourceEndpointYOffset } = useEndpoints();
  const ref = useRef<HTMLDivElement>(null);
  const [groupHeight, setGroupHeight] = useState<number>();
  const [groupTransform, setGroupTransform] = useState<string>();

  /** The registry key: items use their own id; blocks use blockId. */
  const endpointId = itemId ?? blockId;

  /** True when the parent block is currently hovered (tracked via GraphDndProvider). */
  const isParentHovered = mouseOverBlock?.id === blockId;

  // Recompute canvas-space Y whenever group resizes or moves
  const endpointY = useMemo(
    () => {
      if (!ref.current) return undefined;
      return Number(
        ((ref.current.getBoundingClientRect().y +
          (endpointSourceHeight * canvasPosition.scale) / 2 -
          canvasPosition.y) /
          canvasPosition.scale).toFixed(2),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasPosition.scale, canvasPosition.y, groupHeight, groupTransform],
  );

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

  const isPreviewing = itemId
    ? previewingEdge &&
      'itemId' in previewingEdge.from &&
      previewingEdge.from.itemId === itemId
    : previewingEdge &&
      'blockId' in previewingEdge.from &&
      !('itemId' in previewingEdge.from && previewingEdge.from.itemId) &&
      previewingEdge.from.blockId === blockId;

  /** The drag from this endpoint is currently in-flight. */
  const isDraggingFromHere = itemId
    ? connectingIds?.source.itemId === itemId
    : connectingIds?.source.blockId === blockId && !connectingIds.source.itemId;

  /**
   * Visibility logic (independent of `isHidden` which is used by ItemNode):
   * - Always shown when hovered, previewing, dragging from here, or has an outgoing edge
   * - Otherwise hidden (but the wrapper div still occupies space for layout / Y offset)
   */
  const isDotVisible = isParentHovered || !!isPreviewing || isDraggingFromHere || hasOutgoingEdge;

  /**
   * Highlight (orange) when:
   * - The cursor is over the parent block, or
   * - This edge is currently being previewed/dragged
   * Persistent (gray, smaller) when:
   * - An edge already starts here but we are not hovering
   */
  const isHighlighted = isParentHovered || !!isPreviewing || isDraggingFromHere;

  return (
    <div
      ref={ref}
      data-testid="source-endpoint"
      className={cn(
        'prevent-group-drag flex h-[32px] w-[32px] items-center justify-center rounded-full cursor-copy pointer-events-auto',
        isHidden ? 'invisible' : 'visible',
        className,
      )}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (itemId) {
          setConnectingIds({ source: { groupId, blockId, itemId } });
        } else {
          setConnectingIds({ source: { groupId, blockId } });
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Outer ring — fades in when dot is visible */}
      <div
        className={cn(
          'flex h-[20px] w-[20px] items-center justify-center rounded-full border transition-all duration-150',
          isDotVisible
            ? 'border-[var(--gray-5)] bg-[var(--gray-1)] opacity-100 scale-100'
            : 'border-transparent bg-transparent opacity-0 scale-75',
        )}
      >
        {/* Inner dot — orange when highlighted, gray when just connected */}
        <div
          className={cn(
            'rounded-full border-[3.5px] shadow-sm transition-all duration-150',
            isHighlighted
              ? 'h-[13px] w-[13px] border-[#f76808] scale-125'
              : hasOutgoingEdge
                ? 'h-[10px] w-[10px] border-[var(--gray-8)] scale-100'
                : 'h-[13px] w-[13px] border-[#f7a868] scale-100',
          )}
        />
      </div>
    </div>
  );
}
