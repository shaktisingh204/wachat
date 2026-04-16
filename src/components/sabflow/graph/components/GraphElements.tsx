'use client';
import type { SabFlowDoc, Group } from '@/lib/sabflow/types';
import { GroupNode } from './nodes/group/GroupNode';
import { Edges } from './edges/Edges';
import { EndpointsProvider } from '../providers/EndpointsProvider';

type Props = {
  flow: Pick<SabFlowDoc, 'groups' | 'edges'>;
  onGroupUpdate?: (id: string, changes: Partial<Group>) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onGroupBlocksChange?: (groupId: string, blocks: Group['blocks']) => void;
};

export default function GraphElements({ flow, onGroupUpdate, onEdgeDelete, onGroupBlocksChange }: Props) {
  return (
    <EndpointsProvider>
      <Edges
        edges={flow.edges}
        groups={flow.groups}
        onEdgeDelete={onEdgeDelete}
      />
      {flow.groups.map((group, i) => (
        <GroupNode
          key={group.id}
          group={group}
          groupIndex={i}
          edges={flow.edges}
          onGroupUpdate={onGroupUpdate}
          onGroupBlocksChange={onGroupBlocksChange}
        />
      ))}
    </EndpointsProvider>
  );
}
