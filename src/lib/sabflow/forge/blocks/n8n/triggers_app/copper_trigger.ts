/**
 * Forge block: Copper Trigger (info shim).
 *
 * Source: n8n-master/packages/nodes-base/nodes/Copper/CopperTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'company.new',
  'company.update',
  'company.delete',
  'lead.new',
  'lead.update',
  'lead.delete',
  'opportunity.new',
  'opportunity.update',
  'opportunity.delete',
  'person.new',
  'person.update',
  'person.delete',
  'project.new',
  'project.update',
  'project.delete',
  'task.new',
  'task.update',
  'task.delete',
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
      service: 'Copper',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.copper.com/webhooks/general.html',
      registrationInstructions: `Create a Copper webhook subscription pointing at ${sabflowReceiverUrl} with chosen resource:event pair.`,
    },
    logs: [`Copper trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_copper_trigger',
  name: 'Copper Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Copper event slugs.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Copper event slugs.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'eventTypes', label: 'Event types (JSON array)', type: 'json', placeholder: '["lead.new"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
