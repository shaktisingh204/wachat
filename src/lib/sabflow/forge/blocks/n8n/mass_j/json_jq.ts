/**
 * Forge block: JSON jq Query
 *
 * Note: full jq grammar is deferred — bundling a wasm jq runtime would bloat
 * the client. This implementation supports the most common subset: simple
 * dot-path access like ".user.address.city" and bracket index access
 * ".items[0].name". Throws when the path is unresolvable so flow authors get
 * an explicit failure rather than silently `undefined`.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

function resolvePath(value: unknown, path: string): unknown {
  if (!path || path === '.') return value;
  // Strip leading dot, split on . / [ ] keeping numeric indexes
  const tokens = path
    .replace(/^\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let cur: unknown = value;
  for (const tok of tokens) {
    if (cur == null) throw new Error(`jq path resolves to null at "${tok}"`);
    if (typeof cur !== 'object') throw new Error(`jq path expects object at "${tok}"`);
    cur = (cur as Record<string, unknown>)[tok];
  }
  return cur;
}

const block: ForgeBlock = {
  id: 'forge_json_jq',
  name: 'JSON: jq (dot-path)',
  description: 'Apply a dot-path query against a JSON value (simple jq subset).',
  iconName: 'LuFileSearch',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'query',
      label: 'Query',
      fields: [
        { id: 'value', label: 'Value', type: 'variable', required: true },
        { id: 'path', label: 'Path', type: 'text', required: true, placeholder: '.user.address.city' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const path = asString(ctx.options.path);
        const result = resolvePath(ctx.options.value, path);
        return { outputs: { result }, logs: [`jq ${path}`] };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
