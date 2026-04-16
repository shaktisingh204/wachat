'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { cn } from '@/lib/utils';
import { endpointTargetHeight } from '../../constants';

type Props = {
  blockId: string;
  groupId?: string;
  className?: string;
};

export function TargetEndpoint({ blockId, groupId, className }: Props) {
  const { canvasPosition, connectingIds } = useGraph();
  const { setTargetEndpointYOffset } = useEndpoints();
  const ref = useRef<HTMLDivElement>(null);
  const [groupHeight, setGroupHeight] = useState<number>();
  const [groupTransform, setGroupTransform] = useState<string>();

  /** True when a connection drag is in progress AND this endpoint is the active target. */
  const isActiveTarget =
    !!connectingIds &&
    connectingIds.target?.blockId === blockId;

  const endpointY = useMemo(
    () => {
      if (!ref.current) return undefined;
      return Number(
        ((ref.current.getBoundingClientRect().y +
          (endpointTargetHeight * canvasPosition.scale) / 2 -
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
    setTargetEndpointYOffset({ id: blockId, y: endpointY });
  }, [setTargetEndpointYOffset, blockId, endpointY]);

  return (
    <div
      ref={ref}
      className={cn('relative h-[20px] w-[20px] rounded-full cursor-pointer', className)}
    >
      {/* Invisible hit area always present; visible dot only when actively targeted */}
      {isActiveTarget && (
        <span
          className={cn(
            'absolute inset-0 rounded-full',
            'bg-[#f76808] opacity-30',
            'animate-ping',
          )}
        />
      )}
      <span
        className={cn(
          'absolute inset-0 rounded-full transition-all duration-150',
          isActiveTarget
            ? 'bg-[#f76808] scale-100 opacity-100'
            : 'bg-transparent scale-75 opacity-0',
        )}
      />
    </div>
  );
}
