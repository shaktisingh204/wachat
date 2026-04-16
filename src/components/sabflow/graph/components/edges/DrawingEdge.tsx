'use client';
import { useMemo, useState, useEffect } from 'react';
import { useGraph } from '../../providers/GraphProvider';
import { useEndpoints } from '../../providers/EndpointsProvider';
import { useSelectionStore } from '../../hooks/useSelectionStore';
import { computeConnectingEdgePath } from '../../helpers/computeConnectingEdgePath';
import { computeEdgePathToMouse } from '../../helpers/computeEdgePathToMouse';
import { groupWidth } from '../../constants';
import type { ConnectingIds } from '@/lib/sabflow/types';
import type { Coordinates } from '@/lib/sabflow/types';

type Props = {
  connectingIds: ConnectingIds;
};

export function DrawingEdge({ connectingIds }: Props) {
  const { canvasPosition, graphPosition, setConnectingIds } = useGraph();
  const { sourceEndpointYOffsets, targetEndpointYOffsets } = useEndpoints();
  const elementsCoordinates = useSelectionStore((s) => s.elementsCoordinates);
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
  }, [sourceTop, sourceGroupCoordinates, mousePosition, targetGroupCoordinates, targetTop, graphPosition.scale]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!connectingIds) {
        if (mousePosition) setMousePosition(null);
        return;
      }
      setMousePosition({
        x: (e.clientX - canvasPosition.x) / canvasPosition.scale,
        y: (e.clientY - canvasPosition.y) / canvasPosition.scale,
      });
    };

    const onMouseUp = () => {
      if (connectingIds?.target) {
        // Edge creation is handled by Edges.tsx via the onEdgeCreate callback
      }
      setConnectingIds(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [connectingIds, canvasPosition, mousePosition, setConnectingIds]);

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
