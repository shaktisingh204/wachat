'use client';
import { memo } from 'react';
import type { SabFlowDoc, SabFlowEvent, Group } from '@/lib/sabflow/types';
import { EndpointsProvider } from '../providers/EndpointsProvider';
import { Edges } from './edges/Edges';
import { GroupNode } from './nodes/group/GroupNode';
import { StartNode } from './nodes/event/StartNode';

type Props = {
  flow: Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>;
  onGroupUpdate?: (id: string, changes: Partial<Group>) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onGroupBlocksChange?: (groupId: string, blocks: Group['blocks']) => void;
  onEventUpdate?: (id: string, changes: Partial<SabFlowEvent>) => void;
};

function GraphElements({
  flow,
  onGroupUpdate,
  onEdgeDelete,
  onGroupBlocksChange,
  onEventUpdate,
}: Props) {
  return (
    <EndpointsProvider>
      <Edges
        edges={flow.edges}
        groups={flow.groups}
        events={flow.events}
        onEdgeDelete={onEdgeDelete}
      />
      {flow.events.map((event) => (
        <StartNode
          key={event.id}
          event={event}
          onEventUpdate={onEventUpdate}
        />
      ))}
      {flow.groups.map((group, i) => (
        <GroupNode
          key={group.id}
          group={group}
          groupIndex={i}
          edges={flow.edges}
          onGroupUpdate={onGroupUpdate}
          onGroupBlocksChange={onGroupBlocksChange}
          onPlayClick={() => {}}
        />
      ))}
    </EndpointsProvider>
  );
}

export default memo(GraphElements);
