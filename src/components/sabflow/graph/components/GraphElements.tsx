'use client';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { GroupNode } from './nodes/group/GroupNode';
import { Edges } from './edges/Edges';

export default function GraphElements({
  flow,
}: {
  flow: Pick<SabFlowDoc, 'groups' | 'edges'>;
}) {
  return (
    <>
      <Edges edges={flow.edges} groups={flow.groups} />
      {flow.groups.map((group, i) => (
        <GroupNode key={group.id} group={group} groupIndex={i} />
      ))}
    </>
  );
}
