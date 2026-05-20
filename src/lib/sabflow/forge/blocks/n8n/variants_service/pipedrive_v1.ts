/**
 * Forge block: Pipedrive V1 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pipedrive/v1/PipedriveV1.node.ts
 *
 * Compat-shim — preserves the `forge_pipedrive_v1` id so flow files that
 * pinned the Pipedrive v1 node keep deserialising. Delegates to the modern
 * `forge_pipedrive` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_pipedrive_v1',
  name: 'Pipedrive (v1)',
  description: 'Legacy Pipedrive v1 shape. Delegates to forge_pipedrive.',
  iconName: 'LuHandshake',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pipedrive' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern Pipedrive block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText: 'Pick action id from forge_pipedrive.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_pipedrive');
        if (!modern) throw new Error('forge_pipedrive not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target)
          throw new Error(`Pipedrive v1: unknown action "${targetId}"`);
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
