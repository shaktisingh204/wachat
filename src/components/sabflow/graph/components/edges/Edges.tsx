'use client';
import type { Edge as EdgeType, Group } from '@/lib/sabflow/types';
import { Edge } from './Edge';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';

type EdgeCoords = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  isActive: boolean;
};

function getGroupCenter(group: Group, offsetKey: 'right' | 'left' = 'right') {
  const { x, y } = group.graphCoordinates;
  if (offsetKey === 'right') return { x: x + 300, y: y + 20 };
  return { x, y: y + 20 };
}

function getBlockPort(group: Group, blockId: string, side: 'source' | 'target') {
  const blockIndex = group.blocks.findIndex((b) => b.id === blockId);
  const approxY = group.graphCoordinates.y + 50 + blockIndex * 48;
  if (side === 'source') return { x: group.graphCoordinates.x + 300, y: approxY };
  return { x: group.graphCoordinates.x, y: approxY };
}

type Props = {
  edges: EdgeType[];
  groups: Group[];
};

export function Edges({ edges, groups }: Props) {
  const { connectingIds, previewingEdge } = useGraph();

  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));

  const computedEdges = edges
    .map((edge) => {
      const fromGroup = groupMap[edge.from.groupId];
      const toGroup = groupMap[edge.to.groupId];
      if (!fromGroup || !toGroup) return null;

      const from = edge.from.blockId
        ? getBlockPort(fromGroup, edge.from.blockId, 'source')
        : getGroupCenter(fromGroup, 'right');

      const to = edge.to.blockId
        ? getBlockPort(toGroup, edge.to.blockId, 'target')
        : getGroupCenter(toGroup, 'left');

      return { id: edge.id, from, to, isActive: false };
    })
    .filter(Boolean) as EdgeCoords[];

  const maxX = Math.max(2000, ...groups.map((g) => g.graphCoordinates.x + 400));
  const maxY = Math.max(2000, ...groups.map((g) => g.graphCoordinates.y + 400));

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none overflow-visible"
      width={maxX}
      height={maxY}
      style={{ zIndex: 0 }}
    >
      {computedEdges.map((edge) => (
        <Edge
          key={edge.id}
          id={edge.id}
          from={edge.from}
          to={edge.to}
          isActive={edge.isActive}
        />
      ))}
    </svg>
  );
}
