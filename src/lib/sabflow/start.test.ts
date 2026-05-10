import assert from 'node:assert/strict';
import test from 'node:test';

import { findStartGroup } from './start';
import type { SabFlowDoc } from './types';

function makeFlow(overrides: Partial<SabFlowDoc>): SabFlowDoc {
  return {
    userId: 'user-1',
    name: 'Test flow',
    events: [],
    groups: [],
    edges: [],
    variables: [],
    theme: {},
    settings: {},
    status: 'DRAFT',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

test('findStartGroup resolves canvas-created Start connections from edges', () => {
  const flow = makeFlow({
    events: [{ id: 'start-1', type: 'start', graphCoordinates: { x: 0, y: 0 } }],
    groups: [
      {
        id: 'group-1',
        title: 'First group',
        graphCoordinates: { x: 240, y: 0 },
        blocks: [],
      },
    ],
    edges: [
      {
        id: 'edge-1',
        from: { eventId: 'start-1' },
        to: { groupId: 'group-1' },
      },
    ],
  });

  assert.equal(findStartGroup(flow)?.id, 'group-1');
});
