/**
 * Forge block: DebugHelper
 *
 * Source: n8n-master/packages/nodes-base/nodes/DebugHelper/DebugHelper.node.ts
 * Credential type: none.
 *
 * Runtime: logs values to the run transcript and/or emits sample data. The
 * SabFlow native equivalent is the run log panel itself — this block is a
 * convenient way to seed test data and tag log lines from within a flow.
 *
 * Actions:
 *   - log         — append a labelled message at info/warn/error level.
 *   - random_data — emit a sample payload of the requested shape.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString } from '../_shared/http';

async function log(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const message = asString(ctx.options.message);
  const level = asString(ctx.options.level) || 'info';
  if (!message) throw new Error('DebugHelper: message is required');
  const line = `[${level.toUpperCase()}] ${message}`;
  return { outputs: { logged: true }, logs: [line] };
}

function sampleUser(i: number): Record<string, unknown> {
  return {
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: 20 + (i % 40),
  };
}

function sampleAddress(i: number): Record<string, unknown> {
  return {
    id: i + 1,
    street: `${100 + i} Main St`,
    city: 'Springfield',
    zip: `0${1000 + i}`,
  };
}

async function randomData(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const shape = asString(ctx.options.shape) || 'user';
  const count = Math.max(1, Math.min(asNumber(ctx.options.count) ?? 3, 100));
  const generators: Record<string, (i: number) => Record<string, unknown>> = {
    user: sampleUser,
    address: sampleAddress,
  };
  const gen = generators[shape] ?? sampleUser;
  const items = Array.from({ length: count }, (_, i) => gen(i));
  return { outputs: { items }, logs: [`DebugHelper random_data → ${shape} x${count}`] };
}

const block: ForgeBlock = {
  id: 'forge_debug_helper',
  name: 'Debug Helper',
  description: 'Log messages to the run transcript or seed test data.',
  iconName: 'LuBug',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'log',
      label: 'Log message',
      description: 'Append a labelled line to the run transcript.',
      fields: [
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        {
          id: 'level',
          label: 'Level',
          type: 'select',
          defaultValue: 'info',
          options: [
            { label: 'Info', value: 'info' },
            { label: 'Warn', value: 'warn' },
            { label: 'Error', value: 'error' },
          ],
        },
      ],
      run: log,
    },
    {
      id: 'random_data',
      label: 'Random data',
      description: 'Emit a small sample payload for testing.',
      fields: [
        {
          id: 'shape',
          label: 'Shape',
          type: 'select',
          defaultValue: 'user',
          options: [
            { label: 'User', value: 'user' },
            { label: 'Address', value: 'address' },
          ],
        },
        { id: 'count', label: 'Count', type: 'number', defaultValue: 3 },
      ],
      run: randomData,
    },
  ],
};

registerForgeBlock(block);
export default block;
