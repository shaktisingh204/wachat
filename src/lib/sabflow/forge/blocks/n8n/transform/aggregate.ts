/**
 * Forge block: Aggregate
 *
 * Source: n8n-master/packages/nodes-base/nodes/Transform/Aggregate/Aggregate.node.ts
 *
 * Rolls a sequence of items into a single payload. n8n's Aggregate node has
 * three modes:
 *   - aggregateAllItemData      → wrap all items into one outgoing item
 *   - aggregateIndividualFields → emit each field as an array under that name
 *   - (effectively "into_field") → store everything under a single field
 *
 * Here we expose the same three semantics as a single `aggregate_items`
 * action. Input is JSON array, output is a single rolled-up object/array.
 *
 * Limitations:
 *   - n8n's per-field "include/exclude" column picker is collapsed into a
 *     single `fieldName` knob for `individual` mode. If you need fan-out
 *     of multiple fields, run the action once per field.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

type Mode = 'all' | 'individual' | 'into_field';

async function aggregateItems(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = parseJsonArray<Record<string, unknown>>(ctx.options.items, 'items');
  const mode = (asString(ctx.options.mode) || 'all') as Mode;
  const fieldName = asString(ctx.options.fieldName);

  let result: unknown;
  switch (mode) {
    case 'all':
      // Single outgoing item whose `data` field is the full array.
      result = { data: items };
      break;
    case 'individual': {
      if (!fieldName) {
        throw new Error('Aggregate: fieldName is required for mode "individual"');
      }
      const values = items.map((it) => (it && typeof it === 'object' ? it[fieldName] : undefined));
      result = { [fieldName]: values };
      break;
    }
    case 'into_field': {
      const key = fieldName || 'data';
      result = { [key]: items };
      break;
    }
    default:
      throw new Error(`Aggregate: unknown mode "${mode}"`);
  }

  return {
    outputs: { result, count: items.length },
    logs: [`Aggregate ${mode} → rolled up ${items.length} item(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_aggregate',
  name: 'Aggregate',
  description: 'Roll a list of items into a single aggregated payload.',
  iconName: 'LuLayers',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'aggregate_items',
      label: 'Aggregate items',
      description: 'Combine an array of items into one rolled-up object.',
      fields: [
        {
          id: 'items',
          label: 'Items (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"name": "Ada"}, {"name": "Grace"}]',
        },
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          required: true,
          defaultValue: 'all',
          options: [
            { label: 'All item data → single item', value: 'all' },
            { label: 'Individual field → array of values', value: 'individual' },
            { label: 'All items into named field', value: 'into_field' },
          ],
        },
        {
          id: 'fieldName',
          label: 'Field name',
          type: 'text',
          placeholder: 'data',
          helperText: 'Required for "individual"; defaults to "data" for "into_field".',
        },
      ],
      run: aggregateItems,
    },
  ],
};

registerForgeBlock(block);
export default block;
