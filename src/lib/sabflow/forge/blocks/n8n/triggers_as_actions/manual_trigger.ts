/**
 * Forge block: Manual Trigger (port of n8n ManualTrigger as a one-shot action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/ManualTrigger/ManualTrigger.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. SabFlow's `start` event in src/lib/sabflow/triggers/ is the
 * real equivalent. This action is a no-op marker block.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function start(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const label = asString(ctx.options.label) || 'Manual run';
  return {
    outputs: { started: true, at: new Date().toISOString(), label },
    logs: [`Manual trigger → ${label}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_manual_trigger',
  name: 'Manual Trigger',
  description: 'No-op start marker. SabFlow uses the start event for real manual runs.',
  iconName: 'LuPlay',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'start',
      label: 'Start',
      description: 'Emit a start marker into the flow.',
      fields: [
        {
          id: 'label',
          label: 'Label',
          type: 'text',
          placeholder: 'Manual run',
        },
      ],
      run: start,
    },
  ],
};

registerForgeBlock(block);
export default block;
