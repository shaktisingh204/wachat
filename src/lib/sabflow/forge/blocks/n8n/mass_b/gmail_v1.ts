/**
 * Forge block: Gmail V1 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Gmail/v1/GmailV1.node.ts
 *
 * Compat-shim — preserves the `forge_gmail_v1` id so flow files that pinned
 * the Gmail v1 node keep deserialising. Delegates to the modern
 * `forge_gmail` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_gmail_v1',
  name: 'Gmail (v1)',
  description: 'Legacy Gmail v1 shape. Delegates to forge_gmail.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern Gmail block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText: 'Pick action id from forge_gmail.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_gmail');
        if (!modern) throw new Error('forge_gmail not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target) throw new Error(`Gmail v1: unknown action "${targetId}"`);
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
