'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { cn } from '@/lib/utils';
import { endpointSourceHeight } from '../../constants';

type Props = {
  blockId: string;
  groupId: string;
  isHidden?: boolean;
  className?: string;
};

export function BlockSourceEndpoint({ blockId, groupId, isHidden, className }: Props) {
  const { canvasPosition, connectingIds, setConnectingIds, previewingEdge } = useGraph();
  const { setSourceEndpointYOffset, deleteSourceEndpointYOffset } = useEndpoints();
  const ref = useRef<HTMLDivElement>(null);
  const [groupHeight, setGroupHeight] = useState<number>();
  const [groupTransform, setGroupTransform] = useState<string>();

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
    setSourceEndpointYOffset({ id: blockId, y: endpointY });
  }, [setSourceEndpointYOffset, blockId, endpointY]);

  useEffect(() => {
    return () => deleteSourceEndpointYOffset(blockId);
  }, [deleteSourceEndpointYOffset, blockId]);

  const isPreviewing =
    previewingEdge &&
    'blockId' in previewingEdge.from &&
    previewingEdge.from.blockId === blockId;

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
        setConnectingIds({ source: { groupId, blockId } });
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[var(--gray-5)] bg-[var(--gray-1)]">
        <div
          className={cn(
            'h-[13px] w-[13px] rounded-full border-[3.5px] shadow-sm transition-colors',
            isPreviewing ? 'border-[#f76808]' : 'border-[#f7a868]',
          )}
        />
      </div>
    </div>
  );
}
