'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { useSelectionStore } from '../../hooks/useSelectionStore';
import { computeConnectingEdgePath } from '../../helpers/computeConnectingEdgePath';
import { computeEdgePathToMouse } from '../../helpers/computeEdgePathToMouse';
import { groupWidth, eventWidth } from '../../constants';
import type { ConnectingIds, Coordinates } from '@/lib/sabflow/types';

type Props = {
  connectingIds: ConnectingIds;
};

/** Delay before showing the drawing edge — prevents flicker on accidental clicks. */
const VISIBILITY_DELAY_MS = 300;

export function DrawingEdge({ connectingIds }: Props) {
  const { canvasPosition, graphPosition, setConnectingIds } = useGraph();
  const { sourceEndpointYOffsets, targetEndpointYOffsets } = useEndpoints();
  const elementsCoordinates = useSelectionStore.getState().elementsCoordinates;
  const [mousePosition, setMousePosition] = useState<Coordinates | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 300ms visibility delay to prevent flicker
  useEffect(() => {
    visibilityTimerRef.current = setTimeout(() => setIsVisible(true), VISIBILITY_DELAY_MS);
    return () => {
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, []);

  const sourceCoordKey = connectingIds.source.eventId ?? connectingIds.source.groupId;
  const sourceGroupCoordinates = sourceCoordKey ? elementsCoordinates?.[sourceCoordKey] : undefined;
  const targetGroupCoordinates = connectingIds.target?.groupId
    ? elementsCoordinates?.[connectingIds.target.groupId]
    : undefined;

  const sourceTop = useMemo(() => {
    const endpointId =
      connectingIds.source.eventId ??
      connectingIds.source.blockId ??
      connectingIds.source.groupId;
    return endpointId ? sourceEndpointYOffsets.get(endpointId)?.y : undefined;
  }, [connectingIds.source, sourceEndpointYOffsets]);

  const targetTop = useMemo(() => {
    const endpointId = connectingIds.target?.blockId;
    return endpointId ? targetEndpointYOffsets.get(endpointId)?.y : undefined;
  }, [connectingIds.target, targetEndpointYOffsets]);

  const sourceElementWidth = connectingIds.source.eventId ? eventWidth : groupWidth;

  const path = useMemo(() => {
    if (!sourceTop || !sourceGroupCoordinates || !mousePosition) return '';

    if (targetGroupCoordinates) {
      return computeConnectingEdgePath({
        sourceGroupCoordinates,
        targetGroupCoordinates,
        elementWidth: sourceElementWidth,
        sourceTop,
        targetTop,
        graphScale: graphPosition.scale,
      });
    }

    return computeEdgePathToMouse({
      sourceGroupCoordinates,
      mousePosition,
      sourceTop,
      elementWidth: sourceElementWidth,
    });
  }, [
    sourceTop,
    sourceGroupCoordinates,
    mousePosition,
    targetGroupCoordinates,
    targetTop,
    graphPosition.scale,
    sourceElementWidth,
  ]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX - canvasPosition.x) / canvasPosition.scale,
        y: (e.clientY - canvasPosition.y) / canvasPosition.scale,
      });
    };

    const onMouseUp = () => {
      setConnectingIds(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [canvasPosition, setConnectingIds]);

  if (!path || !isVisible) return null;

  return (
    <path
      d={path}
      strokeWidth="2px"
      markerEnd="url(#arrow-hover)"
      fill="none"
      stroke="var(--gray-9)"
      strokeDasharray="5,5"
      opacity={0.7}
      pointerEvents="none"
    />
  );
}
