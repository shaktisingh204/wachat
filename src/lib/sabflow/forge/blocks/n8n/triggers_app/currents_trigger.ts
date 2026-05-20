/**
 * Forge block: Currents Trigger (info shim).
 *
 * Source: n8n-master/packages/nodes-base/nodes/Currents/CurrentsTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['RUN_START', 'RUN_FINISH', 'RUN_CANCELED', 'RUN_TIMEOUT'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw) ? eventTypesRaw.map(asString).filter(Boolean) : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Currents',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://docs.currents.dev/integrations-with-3rd-parties/webhooks',
      registrationInstructions: `Create a Currents webhook pointing at ${sabflowReceiverUrl} subscribed to chosen RUN_* events.`,
    },
    logs: [`Currents trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_currents_trigger',
  name: 'Currents Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Currents RUN_* event slugs.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Currents event slugs.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'eventTypes', label: 'Event types (JSON array)', type: 'json', placeholder: '["RUN_FINISH"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
