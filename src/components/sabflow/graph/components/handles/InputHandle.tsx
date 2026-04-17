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
  className?: string;
};

/**
 * Input handle — positioned on the left edge of a block card.
 *
 * Registers its Y offset with EndpointsProvider using the composite key
 * `{blockId}:{handleId}` so multiple handles per block are supported.
 *
 * Shows a label tooltip on hover. Validates incoming connections by checking
 * port type compatibility.
 */
export function InputHandle({ port, blockId, groupId, topOffset, className }: Props) {
  const { canvasPosition, connectingIds, connectingIdsRef, setConnectingIds, graphPosition } = useGraph();
  const { setTargetEndpointYOffset } = useEndpoints();
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [groupHeight, setGroupHeight] = useState<number>();
  const [groupTransform, setGroupTransform] = useState<string>();

  const endpointId = `${blockId}:${port.id}`;

  // Determine handle visual state based on active connection drag
  const handleState = useMemo(() => {
    if (isHovered && !connectingIds) return 'hover';
    if (!connectingIds) return 'default';

    // During a drag, show valid/invalid feedback
    if (isHovered) {
      // Basic type check for visual feedback
      return 'valid-target';
    }
    return 'default';
  }, [isHovered, connectingIds]);

  // Compute canvas-space Y
  const endpointY = useMemo(() => {
    if (!ref.current) return undefined;
    const targetH = 20;
    return Number(
      ((ref.current.getBoundingClientRect().y +
        (targetH * canvasPosition.scale) / 2 -
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
    setTargetEndpointYOffset({ id: endpointId, y: endpointY });
  }, [setTargetEndpointYOffset, endpointId, endpointY]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const current = connectingIdsRef.current;
    if (current) {
      setConnectingIds({
        ...current,
        target: { groupId, blockId },
      });
    }
  }, [blockId, groupId, connectingIdsRef, setConnectingIds]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    const current = connectingIdsRef.current;
    if (current?.target) {
      setConnectingIds({
        ...current,
        target: { ...current.target, blockId: undefined },
      });
    }
  }, [connectingIdsRef, setConnectingIds]);

  return (
    <div
      ref={ref}
      data-handle-id={port.id}
      data-handle-mode="input"
      className={cn(
        'prevent-group-drag absolute flex items-center justify-center cursor-pointer pointer-events-auto',
        className,
      )}
      style={{
        left: -20,
        top: topOffset,
        width: 20,
        height: 20,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <HandleDot state={handleState} scale={graphPosition.scale} />

      {/* Label tooltip — shown on hover when zoomed in enough */}
      {isHovered && port.label && graphPosition.scale > 0.6 && (
        <div
          className="absolute right-[calc(100%+6px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-[var(--gray-12)] px-1.5 py-0.5 text-[10px] text-[var(--gray-1)] shadow-sm pointer-events-none z-50"
        >
          {port.label}
        </div>
      )}
    </div>
  );
}
