/**
 * Forge block: Sort
 *
 * Source: n8n-master/packages/nodes-base/nodes/Transform/Sort/Sort.node.ts
 * Credential type: none.
 *
 * Runtime: sorts a JSON array — primitives or objects (with an optional
 * `key`) — in ascending or descending order. The SabFlow native equivalent
 * is the "Transform → Sort" data utility; this port keeps the n8n surface
 * available for imported flows.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function pluck(item: unknown, key: string): unknown {
  if (!key) return item;
  if (item && typeof item === 'object') {
    return (item as Record<string, unknown>)[key];
  }
  return undefined;
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

async function sortArray(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = ctx.options.items;
  if (!Array.isArray(items)) {
    throw new Error('Sort: items must be a JSON array');
  }
  const key = asString(ctx.options.key);
  const order = asString(ctx.options.order) || 'asc';
  const dir = order === 'desc' ? -1 : 1;
  const sorted = [...(items as unknown[])].sort(
    (a, b) => dir * compare(pluck(a, key), pluck(b, key)),
  );
  return {
    outputs: { items: sorted },
    logs: [`Sort sort_array → ${sorted.length} items (${order}${key ? ` by ${key}` : ''})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_transform_sort',
  name: 'Sort',
  description: 'Sort a JSON array in ascending or descending order.',
  iconName: 'LuArrowDownUp',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'sort_array',
      label: 'Sort array',
      description: 'Sort primitives or objects (with an optional key).',
      fields: [
        {
          id: 'items',
          label: 'Items',
          type: 'json',
          required: true,
          placeholder: '[3, 1, 2]',
        },
        {
          id: 'key',
          label: 'Key',
          type: 'text',
          placeholder: 'name',
          helperText: 'Optional. When sorting objects, pluck this field for comparison.',
        },
        {
          id: 'order',
          label: 'Order',
          type: 'select',
          defaultValue: 'asc',
          options: [
            { label: 'Ascending', value: 'asc' },
            { label: 'Descending', value: 'desc' },
          ],
        },
      ],
      run: sortArray,
    },
  ],
};

registerForgeBlock(block);
export default block;
