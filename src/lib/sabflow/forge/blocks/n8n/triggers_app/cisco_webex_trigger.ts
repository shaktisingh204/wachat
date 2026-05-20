/**
 * Forge block: Cisco Webex Trigger (info shim).
 *
 * Source: n8n-master/packages/nodes-base/nodes/Cisco/Webex/CiscoWebexTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'attachmentAction.created',
  'meeting.created',
  'meeting.updated',
  'meeting.deleted',
  'membership.created',
  'membership.updated',
  'membership.deleted',
  'message.created',
  'message.deleted',
  'message.updated',
  'recording.created',
  'room.created',
  'room.updated',
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
      service: 'Cisco Webex',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.webex.com/docs/api/guides/webhooks',
      registrationInstructions: `Create a webhook in Webex (resource + event pair) pointing at ${sabflowReceiverUrl}.`,
    },
    logs: [`Cisco Webex trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_cisco_webex_trigger',
  name: 'Cisco Webex Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Cisco Webex resource:event slugs.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Cisco Webex event slugs.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'eventTypes', label: 'Event types (JSON array)', type: 'json', placeholder: '["message.created"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
