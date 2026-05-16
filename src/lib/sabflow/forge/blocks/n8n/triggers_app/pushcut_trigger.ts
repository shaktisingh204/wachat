/**
 * Forge block: Pushcut Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Pushcut's trigger is identified by an `actionName` (free text). The body
 * posted by Pushcut is opaque JSON; the flow consumes it as-is.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pushcut/PushcutTrigger.node.ts
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
  const actionName = asString(ctx.options.actionName);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Pushcut',
      sabflowReceiverUrl,
      actionName,
      registrationDocs: 'https://www.pushcut.io/support/api',
      registrationInstructions:
        `POST to https://api.pushcut.io/v1/subscriptions with { actionName: "${actionName || '<your action name>'}", url: "${sabflowReceiverUrl}" } using your Pushcut API key. The chosen actionName will appear as a server action inside the Pushcut iOS app.`,
    },
    logs: [`Pushcut trigger info → actionName=${actionName || '<unset>'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_pushcut_trigger',
  name: 'Pushcut Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + the Pushcut actionName n8n uses to register a subscription. Subscribe via the Pushcut API manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Pushcut actionName to register.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'actionName',
          label: 'Action name',
          type: 'text',
          placeholder: 'e.g. New order in SabFlow',
          helperText: 'Any name you like — appears as a server action in the Pushcut app.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
