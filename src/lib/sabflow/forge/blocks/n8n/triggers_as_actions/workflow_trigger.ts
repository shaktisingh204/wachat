/**
 * Forge block: Workflow Trigger (port of WorkflowTrigger as a one-shot info action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/WorkflowTrigger/WorkflowTrigger.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. The original node fires on workflow lifecycle events
 * (`activate`, `update`). SabFlow doesn't expose those to flow blocks; see
 * src/lib/sabflow/triggers/ for the real trigger registry.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const WORKFLOW_TRIGGER_EVENTS = ['activate', 'update'] as const;

async function info(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return {
    outputs: {
      events: [...WORKFLOW_TRIGGER_EVENTS],
      note: 'Workflow lifecycle trigger events are not wired into SabFlow runtime.',
    },
    logs: ['Workflow Trigger info → returned event list'],
  };
}

const block: ForgeBlock = {
  id: 'forge_workflow_trigger',
  name: 'Workflow Trigger',
  description: 'Describe the workflow lifecycle events. Not wired to a runtime in SabFlow.',
  iconName: 'LuInfo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'info',
      label: 'Info',
      description: 'Return the workflow lifecycle event surface for documentation.',
      fields: [],
      run: info,
    },
  ],
};

registerForgeBlock(block);
export default block;
