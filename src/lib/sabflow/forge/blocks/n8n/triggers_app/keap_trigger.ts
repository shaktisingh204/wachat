/**
 * Forge block: Keap Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Keap/KeapTrigger.node.ts
 * Note: Keap exposes the available event keys dynamically at
 *       `GET /hooks/event_keys`. The list below is a representative
 *       subset of the common REST-Hooks event ids — the live list can be
 *       fetched at flow-design time.
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
  'contact.add',
  'contact.edit',
  'contact.delete',
  'contactGroup.applied',
  'contactGroup.removed',
  'invoice.add',
  'invoice.edit',
  'invoice.delete',
  'order.add',
  'order.edit',
  'order.delete',
  'subscription.add',
  'subscription.edit',
  'subscription.delete',
  'opportunity.add',
  'opportunity.edit',
  'opportunity.delete',
  'product.add',
  'product.edit',
  'product.delete',
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
      service: 'Keap',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.infusionsoft.com/docs/rest/#!/REST_Hooks',
      registrationInstructions:
        `POST /hooks to https://api.infusionsoft.com/crm/rest/v1/hooks with { eventKey, hookUrl: "${sabflowReceiverUrl}" } and confirm using the x-hook-secret challenge.`,
    },
    logs: [`Keap trigger info → ${KNOWN_EVENTS.length} known event keys`],
  };
}

const block: ForgeBlock = {
  id: 'forge_keap_trigger',
  name: 'Keap Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + Keap event keys. Subscribe via Keap REST Hooks API; confirm with x-hook-secret.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Keap event keys to subscribe to.',
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
          label: 'Event keys (JSON array)',
          type: 'json',
          placeholder: '["contact.add", "order.add"]',
          helperText: `One or more of (representative): ${KNOWN_EVENTS.join(', ')}. Fetch the live list at GET /hooks/event_keys.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
