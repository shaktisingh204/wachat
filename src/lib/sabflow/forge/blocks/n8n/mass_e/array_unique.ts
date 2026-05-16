/**
 * Forge block: Array — Unique.
 * Pure-JS transform: dedupe array values (primitives by identity, objects by JSON).
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

const block: ForgeBlock = {
  id: 'forge_array_unique',
  name: 'Array: Unique',
  description: 'Remove duplicate values from an array.',
  iconName: 'LuFingerprint',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'unique',
      label: 'Unique',
      description: 'Dedupe — primitives by identity, objects by a JSON key (optionally by a field).',
      fields: [
        { id: 'items', label: 'Items (JSON array)', type: 'json', required: true, placeholder: '[1,1,2,3]' },
        {
          id: 'keyField',
          label: 'Key field',
          type: 'text',
          placeholder: 'id',
          helperText: 'Optional. For object items, dedupe on this field instead of full JSON.',
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const items = parseJsonArray<unknown>(ctx.options.items, 'items');
        const keyField = asString(ctx.options.keyField);
        const seen = new Set<string>();
        const result: unknown[] = [];
        for (const item of items) {
          let key: string;
          if (item && typeof item === 'object') {
            if (keyField) {
              const rec = item as Record<string, unknown>;
              key = `o:${JSON.stringify(rec[keyField] ?? null)}`;
            } else {
              key = `o:${JSON.stringify(item)}`;
            }
          } else {
            key = `p:${typeof item}:${String(item)}`;
          }
          if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
          }
        }
        return { outputs: { result, count: result.length } };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
