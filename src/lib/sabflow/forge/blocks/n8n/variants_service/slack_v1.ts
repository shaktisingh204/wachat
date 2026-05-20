/**
 * Forge block: Slack V1 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Slack/V1/SlackV1.node.ts
 *
 * Compat-shim — preserves the `forge_slack_v1` id so flow files that pinned the
 * Slack v1 node keep deserialising. Delegates to the modern `forge_slack`
 * block. Action ids are passed through so callers pick which modern action to
 * invoke (e.g. `send_message`, `send_dm`).
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const block: ForgeBlock = {
  id: 'forge_slack_v1',
  name: 'Slack (v1)',
  description: 'Legacy Slack v1 shape. Delegates to forge_slack.',
  iconName: 'LuSlack',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'slack' },
  actions: [
    {
      id: 'legacy_action',
      label: 'Legacy action',
      description: 'Forwards to modern Slack block. Action ids preserved.',
      fields: [
        {
          id: 'targetActionId',
          label: 'Action',
          type: 'text',
          required: true,
          helperText:
            'Pick action id from forge_slack — e.g. send_message, send_dm',
        },
        { id: 'inputs', label: 'Inputs (JSON)', type: 'json' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const modern = getForgeBlock('forge_slack');
        if (!modern) throw new Error('forge_slack not registered');
        const targetId = String(ctx.options.targetActionId ?? '');
        const target = modern.actions?.find((a) => a.id === targetId);
        if (!target) throw new Error(`Slack v1: unknown action "${targetId}"`);
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
