import type { Group, SabFlowDoc, SabFlowEvent } from './types';

export function findStartEvent(flow: Pick<SabFlowDoc, 'events'>): SabFlowEvent | undefined {
  return flow.events.find((event) => event.type === 'start') ?? flow.events[0];
}

export function findStartGroup(flow: Pick<SabFlowDoc, 'events' | 'edges' | 'groups'>): Group | undefined {
  const startEvent = findStartEvent(flow);
  if (!startEvent) return undefined;

  const edge = startEvent.outgoingEdgeId
    ? flow.edges.find((candidate) => candidate.id === startEvent.outgoingEdgeId)
    : flow.edges.find(
        (candidate) => 'eventId' in candidate.from && candidate.from.eventId === startEvent.id,
      );
  if (!edge?.to.groupId) return undefined;

  return flow.groups.find((group) => group.id === edge.to.groupId);
}
