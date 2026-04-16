'use client';
import { memo } from 'react';
import type { SabFlowDoc, SabFlowEvent, Group } from '@/lib/sabflow/types';
import { EndpointsProvider } from '../providers/EndpointsProvider';
import { Edges } from './edges/Edges';
import { GroupNode } from './nodes/group/GroupNode';
import { StartNode } from './nodes/event/StartNode';
import { HeatmapOverlay } from './HeatmapOverlay';

type Props = {
  flow: Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>;
  onGroupUpdate?: (id: string, changes: Partial<Group>) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onGroupBlocksChange?: (groupId: string, blocks: Group['blocks']) => void;
  onEventUpdate?: (id: string, changes: Partial<SabFlowEvent>) => void;
  onFlowChange?: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges'>>) => void;
  /** Analytics edge-traversal heatmap overlay toggle. */
  isHeatmapEnabled?: boolean;
};

function GraphElements({
  flow,
  onGroupUpdate,
  onEdgeDelete,
  onGroupBlocksChange,
  onEventUpdate,
  onFlowChange,
  isHeatmapEnabled = false,
}: Props) {
  return (
    <EndpointsProvider>
      <Edges
        edges={flow.edges}
        groups={flow.groups}
        events={flow.events}
        onEdgeDelete={onEdgeDelete}
      />
      {/* Heatmap overlay — rendered inside EndpointsProvider so it can read
          endpoint offsets; visually painted on top of the base edges but below
          interactive elements via z-index on the svg path. */}
      <HeatmapOverlay
        isHeatmapEnabled={isHeatmapEnabled}
        edges={flow.edges}
        groups={flow.groups}
        events={flow.events}
      />
      {flow.events.map((event) => (
        <StartNode
          key={event.id}
          event={event}
          onEventUpdate={onEventUpdate}
          flow={flow}
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
          flow={flow}
          onFlowChange={onFlowChange}
        />
      ))}
    </EndpointsProvider>
  );
}

export default memo(GraphElements);
