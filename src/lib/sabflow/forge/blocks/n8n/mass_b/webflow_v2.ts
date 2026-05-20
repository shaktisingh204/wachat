/**
 * Forge block: Webflow V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Webflow/v2/WebflowV2.node.ts
 *
 * Compat-shim — preserves the `forge_webflow_v2` id so flow files that pinned
 * the Webflow v2 node keep deserialising. Delegates to the modern
 * `forge_webflow` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_webflow_v2',
  name: 'Webflow (v2)',
  description: 'Legacy Webflow v2 shape. Delegates to forge_webflow.',
  iconName: 'LuLayoutDashboard',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'webflow' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern Webflow block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText: 'Pick action id from forge_webflow.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_webflow');
        if (!modern) throw new Error('forge_webflow not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target) throw new Error(`Webflow v2: unknown action "${targetId}"`);
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
