'use client';
import { useMemo, useState, useEffect } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { useSelectionStore } from '../../hooks/useSelectionStore';
import { computeConnectingEdgePath } from '../../helpers/computeConnectingEdgePath';
import { computeEdgePathToMouse } from '../../helpers/computeEdgePathToMouse';
import { groupWidth } from '../../constants';
import type { ConnectingIds, Coordinates } from '@/lib/sabflow/types';

type Props = {
  connectingIds: ConnectingIds;
};

export function DrawingEdge({ connectingIds }: Props) {
  const { canvasPosition, graphPosition, setConnectingIds } = useGraph();
  const { sourceEndpointYOffsets, targetEndpointYOffsets } = useEndpoints();
  // Read coordinates directly from the store without subscribing — this avoids
  // re-renders caused by group coordinate updates while the edge is being drawn.
  // The component will re-render only when connectingIds or mousePosition changes.
  const elementsCoordinates = useSelectionStore.getState().elementsCoordinates;
  const [mousePosition, setMousePosition] = useState<Coordinates | null>(null);

  const sourceGroupCoordinates = elementsCoordinates?.[connectingIds.source.groupId];
  const targetGroupCoordinates = connectingIds.target?.groupId
    ? elementsCoordinates?.[connectingIds.target.groupId]
    : undefined;

  const sourceTop = useMemo(() => {
    const endpointId = connectingIds.source.blockId ?? connectingIds.source.groupId;
    return sourceEndpointYOffsets.get(endpointId)?.y;
  }, [connectingIds.source, sourceEndpointYOffsets]);

  const targetTop = useMemo(() => {
    const endpointId = connectingIds.target?.blockId;
    return endpointId ? targetEndpointYOffsets.get(endpointId)?.y : undefined;
  }, [connectingIds.target, targetEndpointYOffsets]);

  const path = useMemo(() => {
    if (!sourceTop || !sourceGroupCoordinates || !mousePosition) return '';

    if (targetGroupCoordinates) {
      return computeConnectingEdgePath({
        sourceGroupCoordinates,
        targetGroupCoordinates,
        elementWidth: groupWidth,
        sourceTop,
        targetTop,
        graphScale: graphPosition.scale,
      });
    }

    return computeEdgePathToMouse({
      sourceGroupCoordinates,
      mousePosition,
      sourceTop,
      elementWidth: groupWidth,
    });
  }, [
    sourceTop,
    sourceGroupCoordinates,
    mousePosition,
    targetGroupCoordinates,
    targetTop,
    graphPosition.scale,
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

  if (!path) return null;

  return (
    <path
      d={path}
      strokeWidth="2px"
      markerEnd="url(#orange-arrow)"
      fill="none"
      className="stroke-[#f76808] pointer-events-none"
    />
  );
}
