/**
 * Forge block: Email Read IMAP V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/EmailReadImap/v2/EmailReadImapV2.node.ts
 *
 * Compat-shim — preserves the `forge_emailimap_v2` id so flow files that pinned
 * the Email Read IMAP v2 node keep deserialising. Delegates to the modern
 * `forge_email_read_imap` block.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_emailimap_v2',
  name: 'Email Read IMAP (v2)',
  description:
    'Legacy Email Read IMAP v2 shape. Delegates to forge_email_read_imap.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern Email Read IMAP block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText: 'Pick action id from forge_email_read_imap.',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_email_read_imap');
        if (!modern) throw new Error('forge_email_read_imap not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target)
          throw new Error(`Email Read IMAP v2: unknown action "${targetId}"`);
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
