/**
 * Forge block: Discord V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Discord/v2/DiscordV2.node.ts
 *
 * Compat-shim — preserves the `forge_discord_v2` id so flow files that pinned
 * the Discord v2 node keep deserialising. Delegates to the modern
 * `forge_discord` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_discord_v2',
  name: 'Discord (v2)',
  description: 'Legacy Discord v2 shape. Delegates to forge_discord.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'discord' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern Discord block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText: 'Pick action id from forge_discord.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_discord');
        if (!modern) throw new Error('forge_discord not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target) throw new Error(`Discord v2: unknown action "${targetId}"`);
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
