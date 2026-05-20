/**
 * Forge block: Todoist V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Todoist/v2/TodoistV2.node.ts
 *
 * Compat-shim — preserves the `forge_todoist_v2` id so flow files that pinned
 * the Todoist v2 node keep deserialising. Delegates to the modern
 * `forge_todoist` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_todoist_v2',
  name: 'Todoist (v2)',
  description: 'Legacy Todoist v2 shape. Delegates to forge_todoist.',
  iconName: 'LuCheckSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'todoist' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern Todoist block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText: 'Pick action id from forge_todoist.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_todoist');
        if (!modern) throw new Error('forge_todoist not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target) throw new Error(`Todoist v2: unknown action "${targetId}"`);
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
