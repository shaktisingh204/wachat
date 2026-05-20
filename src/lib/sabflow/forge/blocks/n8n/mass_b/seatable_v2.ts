/**
 * Forge block: SeaTable V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/SeaTable/v2/SeaTableV2.node.ts
 *
 * Compat-shim — preserves the `forge_seatable_v2` id so flow files that pinned
 * the SeaTable v2 node keep deserialising. Delegates to the modern
 * `forge_seatable` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_seatable_v2',
  name: 'SeaTable (v2)',
  description: 'Legacy SeaTable v2 shape. Delegates to forge_seatable.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'seatable' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern SeaTable block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText: 'Pick action id from forge_seatable.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_seatable');
        if (!modern) throw new Error('forge_seatable not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target) throw new Error(`SeaTable v2: unknown action "${targetId}"`);
        const inputsRaw = ctx.options.inputs;
        const inputs =
          typeof inputsRaw === 'string'
            ? (() => {
                try {
                  return JSON.parse(inputsRaw);
                } catch {
                  return {};
                }
              })()
            : inputsRaw && typeof inputsRaw === 'object'
              ? (inputsRaw as Record<string, unknown>)
              : {};
        return target.run({
          options: { ...(inputs as Record<string, unknown>) },
          variables: ctx.variables,
          credential: ctx.credential,
        });
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
