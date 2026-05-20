/**
 * Forge block: Emelia Trigger (info shim).
 *
 * Source: n8n-master/packages/nodes-base/nodes/Emelia/EmeliaTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['BOUNCED', 'OPENED', 'REPLIED', 'SENT', 'CLICKED', 'UNSUBSCRIBED'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw) ? eventTypesRaw.map(asString).filter(Boolean) : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Emelia',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://emelia.io/hub/api',
      registrationInstructions: `Create an Emelia campaign webhook pointing at ${sabflowReceiverUrl} for the selected events.`,
    },
    logs: [`Emelia trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_emelia_trigger',
  name: 'Emelia Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Emelia campaign event slugs.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Emelia event slugs.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'eventTypes', label: 'Event types (JSON array)', type: 'json', placeholder: '["OPENED"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
