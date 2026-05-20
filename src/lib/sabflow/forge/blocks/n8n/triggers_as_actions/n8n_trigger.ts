/**
 * Forge block: n8n Trigger (port of N8nTrigger as a one-shot info action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/N8nTrigger/N8nTrigger.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. The original node listens for n8n lifecycle events
 * (`activate`, `init`, `update`); SabFlow has no equivalent runtime hook
 * exposed to flow blocks. See src/lib/sabflow/triggers/ for SabFlow's real
 * trigger registry. This action just reports the event surface.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const N8N_TRIGGER_EVENTS = ['activate', 'init', 'update'] as const;

async function info(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return {
    outputs: {
      events: [...N8N_TRIGGER_EVENTS],
      note: 'n8n lifecycle trigger events are out of scope in SabFlow.',
    },
    logs: ['n8n Trigger info → returned event list'],
  };
}

const block: ForgeBlock = {
  id: 'forge_n8n_trigger',
  name: 'SabFlow Trigger',
  description: 'Describe the workflow lifecycle trigger events. Not wired to a runtime in SabFlow.',
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
