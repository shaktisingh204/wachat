/**
 * Forge block: Facebook Trigger (info shim).
 *
 * Source: n8n-master/packages/nodes-base/nodes/Facebook/FacebookTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'adAccount',
  'application',
  'certificateTransparency',
  'group',
  'instagram',
  'link',
  'page',
  'permissions',
  'user',
  'whatsappBusinessAccount',
  'workplaceSecurity',
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
      service: 'Facebook',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.facebook.com/docs/graph-api/webhooks',
      registrationInstructions: `Create a Graph API webhook subscription in your Meta app pointing at ${sabflowReceiverUrl} for the chosen object.`,
    },
    logs: [`Facebook trigger info → ${KNOWN_EVENTS.length} known objects`],
  };
}

const block: ForgeBlock = {
  id: 'forge_facebook_trigger',
  name: 'Facebook Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Facebook Graph API webhook objects.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Facebook webhook object slugs.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'eventTypes', label: 'Object types (JSON array)', type: 'json', placeholder: '["page"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
