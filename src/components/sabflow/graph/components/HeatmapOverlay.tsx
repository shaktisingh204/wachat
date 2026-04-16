'use client';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Edge, Group, SabFlowEvent } from '@/lib/sabflow/types';
import { useAnalytics } from '../providers/AnalyticsProvider';
import { useSelectionStore } from '../hooks/useSelectionStore';
import { useGraph } from '../providers/GraphProvider';
import { useEndpoints } from '../providers/EndpointsProvider';
import { computeEdgePath } from '../helpers/computeEdgePath';
import { getAnchorsPosition } from '../helpers/getAnchorsPosition';
import { groupWidth, eventWidth } from '../constants';

type Props = {
  /** Whether the heatmap sub-toggle is on. When false the component renders nothing. */
  isHeatmapEnabled: boolean;
  edges: Edge[];
  groups: Group[];
  events: SabFlowEvent[];
};

/* ── Color interpolation (cold → hot) ─────────────────────── */
// Returns an rgb(...) string interpolating from blue (cold, t=0) to red (hot, t=1).
function heatColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  // Stop 0: #3b82f6 (blue-500)   -> (59, 130, 246)
  // Stop .5: #f59e0b (amber-500) -> (245, 158, 11)
  // Stop 1: #ef4444 (red-500)    -> (239, 68, 68)
  let r: number, g: number, b: number;
  if (clamped < 0.5) {
    const local = clamped / 0.5;
    r = Math.round(59 + (245 - 59) * local);
    g = Math.round(130 + (158 - 130) * local);
    b = Math.round(246 + (11 - 246) * local);
  } else {
    const local = (clamped - 0.5) / 0.5;
    r = Math.round(245 + (239 - 245) * local);
    g = Math.round(158 + (68 - 158) * local);
    b = Math.round(11 + (68 - 11) * local);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/* ── Main ─────────────────────────────────────────────────── */

export function HeatmapOverlay({ isHeatmapEnabled, edges, groups, events }: Props) {
  const { isEnabled, edgeTraversals } = useAnalytics();
  const { graphPosition } = useGraph();
  const { sourceEndpointYOffsets, targetEndpointYOffsets } = useEndpoints();
  const elementsCoordinates = useSelectionStore(
    useShallow((s) => s.elementsCoordinates),
  );

  // Precompute lookups even when disabled — cheap and kept outside early return
  // so hook order stays stable.
  const blockToGroup = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => g.blocks.forEach((b) => map.set(b.id, g.id)));
    return map;
  }, [groups]);

  const eventIds = useMemo(() => new Set(events.map((ev) => ev.id)), [events]);

  const maxTraversal = useMemo(() => {
    let max = 0;
    for (const count of edgeTraversals.values()) {
      if (count > max) max = count;
    }
    return max;
  }, [edgeTraversals]);

  const renderedEdges = useMemo(() => {
    if (!isEnabled || !isHeatmapEnabled) return [];

    return edges
      .map((edge) => {
        let fromGroupId: string | undefined;
        if (edge.from.eventId) {
          fromGroupId = eventIds.has(edge.from.eventId) ? edge.from.eventId : undefined;
        } else if (edge.from.blockId) {
          fromGroupId = blockToGroup.get(edge.from.blockId);
        } else {
          fromGroupId = edge.from.groupId;
        }

        if (!fromGroupId) return null;

        const fromCoords = elementsCoordinates?.[fromGroupId];
        const toCoords = elementsCoordinates?.[edge.to.groupId];
        if (!fromCoords || !toCoords) return null;

        const endpointId =
          edge.from.eventId ??
          ('itemId' in edge.from ? edge.from.itemId : undefined) ??
          ('blockId' in edge.from ? edge.from.blockId : undefined);
        const sourceTop = endpointId
          ? sourceEndpointYOffsets.get(endpointId)?.y
          : undefined;
        if (sourceTop == null) return null;

        const targetTop = edge.to.blockId
          ? targetEndpointYOffsets.get(edge.to.blockId)?.y
          : undefined;

        const sourceWidth = edge.from.eventId ? eventWidth : groupWidth;
        const anchors = getAnchorsPosition({
          sourceGroupCoordinates: fromCoords,
          targetGroupCoordinates: toCoords,
          elementWidth: sourceWidth,
          sourceTop,
          targetTop,
          graphScale: graphPosition.scale,
        });
        const path = computeEdgePath(anchors);

        const count = edgeTraversals.get(edge.id) ?? 0;
        const t = maxTraversal > 0 ? count / maxTraversal : 0;

        return { id: edge.id, path, count, t };
      })
      .filter((v): v is { id: string; path: string; count: number; t: number } => v !== null);
  }, [
    isEnabled,
    isHeatmapEnabled,
    edges,
    eventIds,
    blockToGroup,
    elementsCoordinates,
    sourceEndpointYOffsets,
    targetEndpointYOffsets,
    graphPosition.scale,
    edgeTraversals,
    maxTraversal,
  ]);

  if (!isEnabled || !isHeatmapEnabled) return null;

  return (
    <svg
      className="absolute left-0 top-0 overflow-visible w-full h-full pointer-events-none"
      style={{ zIndex: 0, mixBlendMode: 'multiply' }}
      aria-hidden
    >
      <g>
        {renderedEdges.map((e) => (
          <path
            key={e.id}
            d={e.path}
            strokeWidth={6}
            stroke={heatColor(e.t)}
            strokeOpacity={0.55}
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}
