'use client';
import type { Edge as EdgeType, Group, SabFlowEvent } from '@/lib/sabflow/types';
import { useGraph } from '../../providers/GraphProvider';
import { ArrowMarkers } from './ArrowMarker';
import { DrawingEdge } from './DrawingEdge';
import { DropOffEdge } from './DropOffEdge';
import { Edge } from './Edge';

type Props = {
  edges: EdgeType[];
  groups: Group[];
  events: SabFlowEvent[];
  onEdgeDelete?: (edgeId: string) => void;
  onInsertNode?: (edgeId: string, position: { x: number; y: number }) => void;
};

export function Edges({ edges, groups, events, onEdgeDelete, onInsertNode }: Props) {
  const { connectingIds } = useGraph();

  // Build blockId -> groupId lookup for O(1) fromGroupId resolution per edge
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

  // Blocks that have no outgoing edge -> show a drop-off arc.
  const disconnectedBlocks = groups.flatMap((g) =>
    g.blocks.filter((b) => !connectedBlockIds.has(b.id)),
  );

  return (
    <svg
      className="absolute left-0 top-0 overflow-visible w-full h-full"
      style={{ zIndex: 0 }}
    >
      {/* All arrow marker definitions — one per status colour */}
      <ArrowMarkers />

      {/* Running edge animation keyframes */}
      <defs>
        <style>{`
          @keyframes edgeFlowAnimation {
            from { stroke-dashoffset: 24; }
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </defs>

      <g style={{ pointerEvents: 'all' }}>
        {connectingIds && <DrawingEdge connectingIds={connectingIds} />}
        {edges.map((edge) => {
          // Determine the "from" group ID for coordinate lookups.
          let fromGroupId: string | undefined;
          if (edge.from.eventId) {
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
              onInsertNode={onInsertNode}
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
