/**
 * Forge block: Microsoft Outlook Trigger (info shim).
 *
 * Outlook's n8n trigger is a *polling* trigger (no webhook
 * `webhookMethods`) — it calls `/me/mailFolders/Inbox/messages` on every
 * poll. SabFlow's webhook-receiver pattern doesn't apply directly; this
 * shim documents the Graph subscription path that *does* support push
 * (Microsoft Graph webhooks) for users who want push-based behaviour, and
 * surfaces the same `event=messageReceived` axis n8n exposes.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Outlook/MicrosoftOutlookTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['messageReceived'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const event = asString(ctx.options.event) || 'messageReceived';
  const resource = asString(ctx.options.resource) || "me/mailFolders('Inbox')/messages";
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Microsoft Outlook',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      event,
      resource,
      registrationDocs: 'https://learn.microsoft.com/graph/webhooks',
      registrationInstructions:
        `n8n's Outlook Trigger is a *polling* trigger. For push, POST /subscriptions on Microsoft Graph with { changeType: "created", notificationUrl: "${sabflowReceiverUrl}", resource: "${resource}", expirationDateTime, clientState }. Confirm the validationToken challenge on first POST. Renew before expiration.`,
    },
    logs: ['Microsoft Outlook trigger info → messageReceived (Graph push via /subscriptions)'],
  };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_outlook_trigger',
  name: 'Microsoft Outlook Trigger (info)',
  description:
    'Returns the SabFlow receiver URL for Microsoft Graph Outlook subscriptions (push). For polling, use the SabFlow scheduler.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Graph subscription resource to bind.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'event',
          label: 'Event',
          type: 'select',
          options: KNOWN_EVENTS.map((e) => ({ value: e, label: e })),
          helperText: 'Outlook event axis (n8n parity).',
        },
        {
          id: 'resource',
          label: 'Graph resource',
          type: 'text',
          placeholder: "me/mailFolders('Inbox')/messages",
          helperText: 'Microsoft Graph resource to subscribe to (for push mode).',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
