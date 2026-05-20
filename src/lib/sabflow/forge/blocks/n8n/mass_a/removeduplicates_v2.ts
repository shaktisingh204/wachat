/**
 * Forge block: RemoveDuplicates V2 (legacy n8n shape)
 *
 * Compat-shim — delegates to the modern `forge_remove_duplicates` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_removeduplicates_v2',
  name: 'Remove Duplicates (v2)',
  description:
    'Legacy RemoveDuplicates v2 shape. Delegates to forge_remove_duplicates.',
  iconName: 'LuCopyMinus',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description:
        'Forwards to modern Remove Duplicates block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          helperText: 'Pick action id from forge_remove_duplicates.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_remove_duplicates');
        if (!modern) throw new Error('forge_remove_duplicates not registered');
        const targetId = String(
          ctx.options.targetActionId ?? modern.actions?.[0]?.id ?? '',
        );
        const target =
          modern.actions?.find((a) => a.id === targetId) ?? modern.actions?.[0];
        if (!target) throw new Error('removeduplicates v2: no action available');
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
