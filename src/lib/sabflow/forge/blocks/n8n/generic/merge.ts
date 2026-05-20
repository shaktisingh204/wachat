/**
 * Forge block: Merge (combine arrays)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Merge/Merge.node.ts (+ v1..v3)
 * Credential type: none — pure data transform.
 *
 * Operations covered:
 *   - append      — concatenate left + right
 *   - mergeByKey  — outer-join two arrays of objects on a shared key
 *
 * Out of scope:
 *   - chooseBranch, multiplex, combine-with-positions: all require multiple
 *     distinct upstream input ports (n8n's two-input merge). Blocked on
 *     sabflow Phase 8 multi-input port support; today every block has a
 *     single upstream output channel exposed via `ctx.input`, so the two
 *     arrays in this port arrive as `left` / `right` JSON fields instead.
 *   - paired-item tracking (n8n preserves item-index lineage across the
 *     merge). Blocked on sabflow Phase 9 lineage propagation.
 * The native SabFlow Merge block covers most flow-author needs; this port
 * exists for n8n parity on the two compositional modes we can express.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function toArray(raw: unknown, side: 'left' | 'right'): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      throw new Error(`Merge: ${side} is not a JSON array — ${(err as Error).message}`);
    }
  }
  if (raw == null) return [];
  return [raw];
}

async function append(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const left = toArray(ctx.options.left, 'left');
  const right = toArray(ctx.options.right, 'right');
  const result = [...left, ...right];
  return {
    outputs: { result, count: result.length },
    logs: [`Merge append → ${left.length} + ${right.length}`],
  };
}

async function mergeByKey(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const left = toArray(ctx.options.left, 'left') as Array<Record<string, unknown>>;
  const right = toArray(ctx.options.right, 'right') as Array<Record<string, unknown>>;
  const leftKey = asString(ctx.options.leftKey);
  const rightKey = asString(ctx.options.rightKey) || leftKey;
  if (!leftKey) throw new Error('Merge: leftKey is required');

  const index = new Map<string, Record<string, unknown>>();
  for (const item of right) {
    const k = item && typeof item === 'object' ? String((item as Record<string, unknown>)[rightKey] ?? '') : '';
    if (k) index.set(k, item);
  }

  const result: Array<Record<string, unknown>> = [];
  for (const item of left) {
    const k = item && typeof item === 'object' ? String((item as Record<string, unknown>)[leftKey] ?? '') : '';
    const match = k ? index.get(k) : undefined;
    result.push({ ...(item as Record<string, unknown>), ...(match ?? {}) });
  }

  return {
    outputs: { result, count: result.length },
    logs: [`Merge by key → ${result.length}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_merge',
  name: 'Merge',
  description: 'Combine two arrays — append or join by key.',
  iconName: 'LuMerge',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'append',
      label: 'Append',
      description: 'Concatenate left + right into a single array.',
      fields: [
        { id: 'left', label: 'Left array', type: 'json', required: true },
        { id: 'right', label: 'Right array', type: 'json', required: true },
      ],
      run: append,
    },
    {
      id: 'merge_by_key',
      label: 'Merge by key',
      description: 'Outer-join two arrays of objects on a shared key.',
      fields: [
        { id: 'left', label: 'Left array', type: 'json', required: true },
        { id: 'right', label: 'Right array', type: 'json', required: true },
        { id: 'leftKey', label: 'Left key', type: 'text', required: true, placeholder: 'id' },
        {
          id: 'rightKey',
          label: 'Right key (defaults to left key)',
          type: 'text',
          placeholder: 'id',
        },
      ],
      run: mergeByKey,
    },
  ],
};

registerForgeBlock(block);
export default block;
