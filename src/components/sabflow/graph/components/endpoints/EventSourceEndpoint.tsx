'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { cn } from '@/lib/utils';
import { endpointSourceHeight } from '../../constants';

type Props = {
  eventId: string;
  isHidden?: boolean;
  className?: string;
};

export function EventSourceEndpoint({ eventId, isHidden, className }: Props) {
  const { canvasPosition, connectingIds, setConnectingIds, previewingEdge } = useGraph();
  const { setSourceEndpointYOffset, deleteSourceEndpointYOffset } = useEndpoints();
  const ref = useRef<HTMLDivElement>(null);
  const [eventHeight, setEventHeight] = useState<number>();
  const [eventTransform, setEventTransform] = useState<string>();

  // Recompute canvas-space Y whenever the event node resizes or moves
  const endpointY = useMemo(() => {
    if (!ref.current) return undefined;
    return Number(
      (
        (ref.current.getBoundingClientRect().y +
          (endpointSourceHeight * canvasPosition.scale) / 2 -
          canvasPosition.y) /
        canvasPosition.scale
      ).toFixed(2),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasPosition.scale, canvasPosition.y, eventHeight, eventTransform]);

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-moving-element="event-${eventId}"]`);
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setEventHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [eventId]);

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-moving-element="event-${eventId}"]`);
    if (!el) return;
    const mo = new MutationObserver((entries) => {
      setEventTransform((entries[0].target as HTMLElement).style.transform);
    });
    mo.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => mo.disconnect();
  }, [eventId]);

  useEffect(() => {
    if (endpointY === undefined) return;
    setSourceEndpointYOffset({ id: eventId, y: endpointY });
  }, [setSourceEndpointYOffset, eventId, endpointY]);

  useEffect(() => {
    return () => deleteSourceEndpointYOffset(eventId);
  }, [deleteSourceEndpointYOffset, eventId]);

  const isPreviewing =
    previewingEdge &&
    'eventId' in previewingEdge.from &&
    previewingEdge.from.eventId === eventId;

  return (
    <div
      ref={ref}
      data-testid="event-source-endpoint"
      className={cn(
        'prevent-group-drag flex h-[32px] w-[32px] items-center justify-center rounded-full cursor-copy pointer-events-auto',
        isHidden ? 'invisible' : 'visible',
        className,
      )}
      onPointerDown={(e) => {
        e.stopPropagation();
        setConnectingIds({ source: { eventId } });
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
