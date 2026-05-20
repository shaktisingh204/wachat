/**
 * Forge block: SpreadsheetFile V1 (legacy n8n shape)
 *
 * Compat-shim — delegates to the modern `forge_spreadsheet_file` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_spreadsheetfile_v1',
  name: 'Spreadsheet File (v1)',
  description:
    'Legacy SpreadsheetFile v1 shape. Delegates to forge_spreadsheet_file.',
  iconName: 'LuFileSpreadsheet',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description:
        'Forwards to modern Spreadsheet File block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          helperText: 'Pick action id from forge_spreadsheet_file.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_spreadsheet_file');
        if (!modern) throw new Error('forge_spreadsheet_file not registered');
        const targetId = String(
          ctx.options.targetActionId ?? modern.actions?.[0]?.id ?? '',
        );
        const target =
          modern.actions?.find((a) => a.id === targetId) ?? modern.actions?.[0];
        if (!target) throw new Error('spreadsheetfile v1: no action available');
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
