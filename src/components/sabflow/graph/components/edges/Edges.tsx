'use client';
import type { Edge as EdgeType, Group } from '@/lib/sabflow/types';
import { Edge } from './Edge';
import { DrawingEdge } from './DrawingEdge';
import { useGraph } from '../../providers/GraphProvider';

type Props = {
  edges: EdgeType[];
  groups: Group[];
  onEdgeDelete?: (edgeId: string) => void;
};

export function Edges({ edges, groups, onEdgeDelete }: Props) {
  const { connectingIds } = useGraph();

  // Map blockId → groupId for fast lookup
  const blockToGroup = new Map<string, string>();
  groups.forEach((g) => {
    g.blocks.forEach((b) => blockToGroup.set(b.id, g.id));
  });

  return (
    <svg
      className="absolute left-0 top-0 overflow-visible pointer-events-none w-full h-full"
      style={{ zIndex: 0 }}
    >
      {/* Arrow markers */}
      <defs>
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
            fill="#f76808"
          />
        </marker>
      </defs>

      <g style={{ pointerEvents: 'all' }}>
        {connectingIds && <DrawingEdge connectingIds={connectingIds} />}
        {edges.map((edge) => {
          const fromGroupId = edge.from.blockId
            ? blockToGroup.get(edge.from.blockId)
            : edge.from.groupId;
          return (
            <Edge
              key={edge.id}
              edge={edge}
              fromGroupId={fromGroupId}
              onDelete={onEdgeDelete}
            />
          );
        })}
      </g>
    </svg>
  );
}
