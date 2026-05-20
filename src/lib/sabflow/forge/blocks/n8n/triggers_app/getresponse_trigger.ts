/**
 * Forge block: GetResponse Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/GetResponse/GetResponseTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://apireference.getresponse.com/#operation/setCallbackUrl';
const KNOWN_EVENTS = ['subscribe', 'unsubscribe', 'click', 'open', 'survey'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventsRaw = ctx.options.events;
  const events = Array.isArray(eventsRaw) ? eventsRaw.map(asString).filter(Boolean) : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'GetResponse',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: events,
      registrationDocs: DOCS_URL,
      registrationInstructions: `POST /accounts/callbacks in the GetResponse API with url=${sabflowReceiverUrl} and actions toggled on for the supportedEvents you need.`,
    },
    logs: [`GetResponse trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_getresponse_trigger',
  name: 'GetResponse Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported GetResponse event types.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the GetResponse event slugs to subscribe to.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'events', label: 'Events (JSON array)', type: 'json', placeholder: '["subscribe", "open"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
