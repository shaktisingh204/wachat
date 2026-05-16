/**
 * Forge block: LoneScale Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The flow author must
 * register the URL via the LoneScale workflows hook API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/LoneScale/LoneScaleTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const workflowId = asString(ctx.options.workflowId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'LoneScale',
      sabflowReceiverUrl,
      workflowId,
      registrationDocs: 'https://docs.lonescale.com/',
      registrationInstructions:
        `POST to https://api.lonescale.com/workflows/${workflowId || '<workflow-id>'}/hook with { type: "n8n", target_url: "${sabflowReceiverUrl}" } to subscribe. The webhook fires per item produced by the LoneScale workflow.`,
    },
    logs: ['LoneScale trigger info → per-workflow hook'],
  };
}

const block: ForgeBlock = {
  id: 'forge_lonescale_trigger',
  name: 'LoneScale Trigger (info)',
  description:
    'Returns the SabFlow webhook URL to attach to a LoneScale workflow hook. Subscribe via POST /workflows/{id}/hook.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + LoneScale workflow id binding.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'workflowId',
          label: 'LoneScale workflow id',
          type: 'text',
          placeholder: 'ws_...',
          helperText: 'The LoneScale workflow id the hook should be attached to.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
