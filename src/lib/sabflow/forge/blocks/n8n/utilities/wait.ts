/**
 * Forge block: Wait
 *
 * Source: n8n-master/packages/nodes-base/nodes/Wait/Wait.node.ts
 *
 * Pauses the flow for a configurable number of seconds. The original n8n
 * node also supports webhook resumption — that path is deferred until the
 * SabFlow engine surfaces a durable wait primitive.
 *
 * Operations covered:
 *   - wait   await setTimeout(seconds * 1000)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber } from '../_shared/http';

const MAX_SECONDS = 60 * 60; // 1h — soft cap to avoid runaway flows.

async function wait(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const seconds = asNumber(ctx.options.seconds) ?? 1;
  if (seconds < 0) throw new Error('Wait: seconds must be ≥ 0');
  if (seconds > MAX_SECONDS) {
    throw new Error(`Wait: seconds must be ≤ ${MAX_SECONDS} (got ${seconds})`);
  }
  const start = Date.now();
  await new Promise((resolve) => {
    setTimeout(resolve, Math.round(seconds * 1000));
  });
  const elapsedMs = Date.now() - start;
  return {
    outputs: { waitedSeconds: seconds, elapsedMs },
    logs: [`Wait → ${seconds}s`],
  };
}

const block: ForgeBlock = {
  id: 'forge_wait_n8n',
  name: 'Wait',
  description: 'Pause the flow for a fixed number of seconds.',
  iconName: 'LuClock',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'wait',
      label: 'Wait',
      description: 'Pause execution for N seconds (max 3600).',
      fields: [
        { id: 'seconds', label: 'Seconds', type: 'number', required: true, defaultValue: 1 },
      ],
      run: wait,
    },
  ],
};

registerForgeBlock(block);
export default block;
