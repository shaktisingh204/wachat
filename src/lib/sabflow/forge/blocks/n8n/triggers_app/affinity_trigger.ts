/**
 * Forge block: Affinity Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Affinity/AffinityTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'field_value.created',
  'field_value.deleted',
  'field_value.updated',
  'field.created',
  'field.deleted',
  'field.updated',
  'file.created',
  'file.deleted',
  'list_entry.created',
  'list_entry.deleted',
  'list.created',
  'list.deleted',
  'list.updated',
  'note.created',
  'note.deleted',
  'note.updated',
  'opportunity.created',
  'opportunity.deleted',
  'opportunity.updated',
  'organization.created',
  'organization.deleted',
  'organization.updated',
  'person.created',
  'person.deleted',
  'person.updated',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Affinity',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://api-docs.affinity.co/#webhooks',
      registrationInstructions:
        `POST to https://api.affinity.co/webhook/subscribe with webhook_url=${sabflowReceiverUrl} and subscriptions=[...one or more of supportedEvents].`,
    },
    logs: [`Affinity trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_affinity_trigger',
  name: 'Affinity Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Affinity event types n8n supports. Register via the Affinity API manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Affinity events to subscribe to.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["opportunity.created"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
