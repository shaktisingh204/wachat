/**
 * Forge block: Interval (port of n8n Interval trigger as a one-shot action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Interval/Interval.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. The action below is a bounded `sleep` returning a single
 * tick. Real interval-based scheduling lives in src/lib/sabflow/triggers/.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber } from '../_shared/http';

const MAX_SECONDS = 60; // sanity cap so we don't block a flow worker indefinitely.

async function tick(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const seconds = asNumber(ctx.options.seconds);
  if (seconds === undefined || seconds < 0) {
    throw new Error('Interval: seconds is required and must be >= 0');
  }
  if (seconds > MAX_SECONDS) {
    throw new Error(`Interval: seconds must be <= ${MAX_SECONDS} (use a real cron trigger for longer waits)`);
  }
  if (seconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
  const at = new Date().toISOString();
  return {
    outputs: { ticked: true, at, waitedSeconds: seconds },
    logs: [`Interval tick → waited ${seconds}s, at ${at}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_interval_n8n',
  name: 'Interval',
  description: 'Sleep for N seconds and return a tick. Real intervals live in the trigger system.',
  iconName: 'LuTimer',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'tick',
      label: 'Tick',
      description: 'Wait the given number of seconds (max 60) and return the wakeup timestamp.',
      fields: [
        {
          id: 'seconds',
          label: 'Seconds (0-60)',
          type: 'number',
          required: true,
          defaultValue: 1,
        },
      ],
      run: tick,
    },
  ],
};

registerForgeBlock(block);
export default block;
