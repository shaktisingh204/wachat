'use client';
import type { SabFlowDoc, Group } from '@/lib/sabflow/types';
import { GroupNode } from './nodes/group/GroupNode';
import { Edges } from './edges/Edges';

type Props = {
  flow: Pick<SabFlowDoc, 'groups' | 'edges'>;
  onGroupUpdate?: (id: string, changes: Partial<Group>) => void;
};

export default function GraphElements({ flow, onGroupUpdate }: Props) {
  return (
    <>
      <Edges edges={flow.edges} groups={flow.groups} />
      {flow.groups.map((group, i) => (
        <GroupNode
          key={group.id}
          group={group}
          groupIndex={i}
          onGroupUpdate={onGroupUpdate}
        />
      ))}
    </>
  );
}
