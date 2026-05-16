/**
 * Forge block: Simulate
 *
 * Source: n8n-master/packages/nodes-base/nodes/Simulate/Simulate.node.ts
 *
 * Test utility — emits N copies of a JSON payload, optionally after a delay.
 * Useful for prototyping fan-out logic without hitting an upstream API.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber } from '../_shared/http';

function parsePayload(raw: unknown): unknown {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

async function emitItems(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const count = Math.max(0, Math.min(asNumber(ctx.options.itemCount) ?? 1, 10_000));
  const payload = parsePayload(ctx.options.payload);
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(payload);
  }
  return {
    outputs: { items, count },
    logs: [`Simulate emit_items → ${count} items`],
  };
}

async function waitAndEmit(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ms = Math.max(0, Math.min(asNumber(ctx.options.ms) ?? 0, 60_000));
  const payload = parsePayload(ctx.options.payload);
  if (ms > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
  return {
    outputs: { payload, waitedMs: ms },
    logs: [`Simulate wait_and_emit → ${ms}ms`],
  };
}

const block: ForgeBlock = {
  id: 'forge_simulate',
  name: 'Simulate',
  description: 'Emit fake items for testing fan-out and delay logic.',
  iconName: 'LuFlaskConical',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'emit_items',
      label: 'Emit items',
      description: 'Emit N copies of a payload.',
      fields: [
        { id: 'itemCount', label: 'Item count', type: 'number', defaultValue: 1 },
        { id: 'payload', label: 'Payload (JSON)', type: 'json' },
      ],
      run: emitItems,
    },
    {
      id: 'wait_and_emit',
      label: 'Wait then emit',
      description: 'Sleep for `ms` milliseconds, then return the payload.',
      fields: [
        { id: 'ms', label: 'Wait (ms)', type: 'number', defaultValue: 0, helperText: 'Capped at 60000 ms.' },
        { id: 'payload', label: 'Payload (JSON)', type: 'json' },
      ],
      run: waitAndEmit,
    },
  ],
};

registerForgeBlock(block);
export default block;
