'use client';
import type { Edge as EdgeType, Group, SabFlowEvent } from '@/lib/sabflow/types';
import { useGraph } from '../../providers/GraphProvider';
import { DrawingEdge } from './DrawingEdge';
import { DropOffEdge } from './DropOffEdge';
import { Edge } from './Edge';

type Props = {
  edges: EdgeType[];
  groups: Group[];
  events: SabFlowEvent[];
  onEdgeDelete?: (edgeId: string) => void;
};

export function Edges({ edges, groups, events, onEdgeDelete }: Props) {
  const { connectingIds } = useGraph();

  // Build blockId → groupId lookup for O(1) fromGroupId resolution per edge
  const blockToGroup = new Map<string, string>();
  groups.forEach((g) => {
    g.blocks.forEach((b) => blockToGroup.set(b.id, g.id));
  });

  // Build eventId lookup for event-sourced edges
  const eventIds = new Set(events.map((ev) => ev.id));

  // Collect all block IDs that already have an outgoing edge so we can skip
  // rendering a drop-off indicator for them.
  const connectedBlockIds = new Set<string>();
  edges.forEach((edge) => {
    if (edge.from.blockId) connectedBlockIds.add(edge.from.blockId);
  });

  // Blocks that have no outgoing edge → show a drop-off arc.
  const disconnectedBlocks = groups.flatMap((g) =>
    g.blocks.filter((b) => !connectedBlockIds.has(b.id)),
  );

  return (
    <svg
      className="absolute left-0 top-0 overflow-visible w-full h-full"
      style={{ zIndex: 0 }}
    >
      <defs>
        {/* Arrowhead markers — path shape matches Typebot exactly.
            Colors use CSS variables so dark-mode overrides apply automatically. */}
        <marker
          id="arrow"
          refX="8"
          refY="4"
          orient="auto"
          viewBox="0 0 20 20"
          markerUnits="userSpaceOnUse"
          markerWidth="20"
          markerHeight="20"
        >
          <path
            d="M7.07138888,5.50174526 L2.43017246,7.82235347 C1.60067988,8.23709976 0.592024983,7.90088146 0.177278692,7.07138888 C0.0606951226,6.83822174 0,6.58111307 0,6.32042429 L0,1.67920787 C0,0.751806973 0.751806973,0 1.67920787,0 C1.93989666,0 2.19700532,0.0606951226 2.43017246,0.177278692 L7,3 C7.82949258,3.41474629 8.23709976,3.92128809 7.82235347,4.75078067 C7.6598671,5.07575341 7.39636161,5.33925889 7.07138888,5.50174526 Z"
            fill="var(--gray-8)"
          />
        </marker>
        <marker
          id="orange-arrow"
          refX="8"
          refY="4"
          orient="auto"
          viewBox="0 0 20 20"
          markerUnits="userSpaceOnUse"
          markerWidth="20"
          markerHeight="20"
        >
          <path
            d="M7.07138888,5.50174526 L2.43017246,7.82235347 C1.60067988,8.23709976 0.592024983,7.90088146 0.177278692,7.07138888 C0.0606951226,6.83822174 0,6.58111307 0,6.32042429 L0,1.67920787 C0,0.751806973 0.751806973,0 1.67920787,0 C1.93989666,0 2.19700532,0.0606951226 2.43017246,0.177278692 L7,3 C7.82949258,3.41474629 8.23709976,3.92128809 7.82235347,4.75078067 C7.6598671,5.07575341 7.39636161,5.33925889 7.07138888,5.50174526 Z"
            fill="var(--orange-8)"
          />
        </marker>
      </defs>

      <g style={{ pointerEvents: 'all' }}>
        {connectingIds && <DrawingEdge connectingIds={connectingIds} />}
        {edges.map((edge) => {
          // Determine the "from" group ID for coordinate lookups.
          // Event-sourced edges use the eventId as the source coordinate key.
          let fromGroupId: string | undefined;
          if (edge.from.eventId) {
            // Event-sourced edge: use eventId as coordinate key (seeded in store by StartNode)
            fromGroupId = eventIds.has(edge.from.eventId) ? edge.from.eventId : undefined;
          } else if (edge.from.blockId) {
            fromGroupId = blockToGroup.get(edge.from.blockId);
          } else {
            fromGroupId = edge.from.groupId;
          }
          return (
            <Edge
              key={edge.id}
              edge={edge}
              fromGroupId={fromGroupId}
              onDelete={onEdgeDelete}
            />
          );
        })}

        {/* Drop-off arcs for every block that has no outgoing connection */}
        {disconnectedBlocks.map((block) => (
          <DropOffEdge key={`dropoff-${block.id}`} blockId={block.id} groups={groups} />
        ))}
      </g>
    </svg>
  );
}
