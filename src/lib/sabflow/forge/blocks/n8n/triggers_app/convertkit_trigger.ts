/**
 * Forge block: ConvertKit Trigger (info shim).
 *
 * Source: n8n-master/packages/nodes-base/nodes/ConvertKit/ConvertKitTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'subscriber.form_subscribe',
  'subscriber.course_subscribe',
  'subscriber.course_complete',
  'subscriber.link_click',
  'subscriber.product_purchase',
  'purchase.purchase_create',
  'subscriber.subscriber_activate',
  'subscriber.subscriber_unsubscribe',
  'subscriber.tag_add',
  'subscriber.tag_remove',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw) ? eventTypesRaw.map(asString).filter(Boolean) : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'ConvertKit',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.convertkit.com/#webhooks',
      registrationInstructions: `Create an automation webhook in ConvertKit pointing at ${sabflowReceiverUrl}.`,
    },
    logs: [`ConvertKit trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_convertkit_trigger',
  name: 'ConvertKit Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported ConvertKit event slugs.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + ConvertKit event slugs.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'eventTypes', label: 'Event types (JSON array)', type: 'json', placeholder: '["subscriber.form_subscribe"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
