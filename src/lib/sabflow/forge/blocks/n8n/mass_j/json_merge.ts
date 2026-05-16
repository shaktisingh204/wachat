/**
 * Forge block: JSON Merge
 *
 * Merge two objects with shallow or deep semantics. Arrays are replaced
 * (not concatenated) in deep mode — match Object.assign / Lodash merge
 * intuition for SabFlow authors who don't want array-concat surprises.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

function deepMerge(a: unknown, b: unknown): unknown {
  if (
    a != null &&
    b != null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
      out[k] = deepMerge(out[k], v);
    }
    return out;
  }
  return b === undefined ? a : b;
}

const block: ForgeBlock = {
  id: 'forge_json_merge',
  name: 'JSON: Merge',
  description: 'Merge two objects (shallow or deep).',
  iconName: 'LuGitMerge',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'merge',
      label: 'Merge',
      fields: [
        { id: 'left', label: 'Left object', type: 'variable', required: true },
        { id: 'right', label: 'Right object', type: 'variable', required: true },
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          defaultValue: 'shallow',
          options: [
            { value: 'shallow', label: 'Shallow' },
            { value: 'deep', label: 'Deep' },
          ],
        },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const mode = asString(ctx.options.mode) || 'shallow';
        const left = ctx.options.left;
        const right = ctx.options.right;
        if (typeof left !== 'object' || left == null) throw new Error('Left must be an object');
        if (typeof right !== 'object' || right == null) throw new Error('Right must be an object');
        const merged =
          mode === 'deep'
            ? deepMerge(left, right)
            : { ...(left as Record<string, unknown>), ...(right as Record<string, unknown>) };
        return { outputs: { merged }, logs: [`Merge (${mode})`] };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
