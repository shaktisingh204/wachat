/**
 * Forge block: Help Scout Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/HelpScout/HelpScoutTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://developer.helpscout.com/webhooks/';
const KNOWN_EVENTS = [
  'convo.assigned',
  'convo.created',
  'convo.deleted',
  'convo.merged',
  'convo.moved',
  'convo.status',
  'convo.tags',
  'convo.agent.reply.created',
  'convo.customer.reply.created',
  'convo.note.created',
  'customer.created',
  'satisfaction.ratings',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventsRaw = ctx.options.events;
  const events = Array.isArray(eventsRaw) ? eventsRaw.map(asString).filter(Boolean) : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Help Scout',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: events,
      registrationDocs: DOCS_URL,
      registrationInstructions: `POST /v2/webhooks in the Help Scout API with url=${sabflowReceiverUrl} and events array drawn from supportedEvents. Store the HMAC secret for X-HelpScout-Signature verification.`,
    },
    logs: [`Help Scout trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_helpscout_trigger',
  name: 'Help Scout Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Help Scout event types.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Help Scout event slugs to subscribe to.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'events', label: 'Events (JSON array)', type: 'json', placeholder: '["convo.created", "customer.created"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
