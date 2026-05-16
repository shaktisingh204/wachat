/**
 * Forge block: Data Table
 *
 * Source: n8n-master/packages/nodes-base/nodes/DataTable/DataTable.node.ts
 *
 * n8n's flow-scoped key-value store. In SabFlow we back this with the flow
 * `ctx.variables` map — the action returns the value (or the key/value
 * pair) as outputs, and the flow author wires the output back to a Set
 * Variable block to persist it. `ForgeActionResult` does not support
 * mutating variables directly.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function parseValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed === 'true' || trimmed === 'false' || trimmed === 'null' || /^-?\d+(\.\d+)?$/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

async function setEntry(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('DataTable: key is required');
  const value = parseValue(ctx.options.value);
  return {
    outputs: { key, value, entry: { [key]: value } },
    logs: [`DataTable set → ${key}`],
  };
}

async function getEntry(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = asString(ctx.options.key);
  if (!key) throw new Error('DataTable: key is required');
  const value = ctx.variables[key];
  return {
    outputs: { key, value, found: value !== undefined },
    logs: [`DataTable get → ${key} (${value === undefined ? 'miss' : 'hit'})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_data_table',
  name: 'Data Table',
  description: 'Flow-scoped key/value lookups. Reads from flow variables; writes return outputs to be persisted by Set Variable.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'set',
      label: 'Set value',
      description: 'Return a { [key]: value } pair to be merged into flow variables downstream.',
      fields: [
        { id: 'key', label: 'Key', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'textarea' },
      ],
      run: setEntry,
    },
    {
      id: 'get',
      label: 'Get value',
      description: 'Read a value from the current flow variables by key.',
      fields: [
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: getEntry,
    },
  ],
};

registerForgeBlock(block);
export default block;
