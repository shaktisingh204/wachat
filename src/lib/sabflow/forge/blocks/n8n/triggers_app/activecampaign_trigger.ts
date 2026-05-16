/**
 * Forge block: ActiveCampaign Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/ActiveCampaign/ActiveCampaignTrigger.node.ts
 *
 * Note: n8n loads the live event list from `GET /api/3/webhook/events` at
 * dropdown time. KNOWN_EVENTS below is the canonical list from
 * https://developers.activecampaign.com/reference/webhooks — flow authors can
 * still pass any string the AC API accepts; the shim doesn't enforce.
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
  'subscribe',
  'unsubscribe',
  'subscribe_unconfirmed',
  'sent',
  'open',
  'forward',
  'share',
  'click',
  'reply',
  'bounce',
  'unsub',
  'update',
  'contact_add',
  'contact_update',
  'contact_tag_added',
  'contact_tag_removed',
  'contact_note_added',
  'contact_task_add',
  'contact_task_complete',
  'list_add',
  'deal_add',
  'deal_update',
  'deal_note_add',
  'deal_pipeline_add',
  'deal_stage_add',
  'deal_task_add',
  'deal_task_complete',
  'campaign_status',
  'task_reminder',
] as const;

const KNOWN_SOURCES = ['public', 'admin', 'api', 'system'] as const;

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
      service: 'ActiveCampaign',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      supportedSources: KNOWN_SOURCES,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.activecampaign.com/reference/webhooks',
      registrationInstructions:
        `POST to https://YOUR-ACCOUNT.api-us1.com/api/3/webhooks with url=${sabflowReceiverUrl} and the events/sources from supportedEvents + supportedSources.`,
    },
    logs: [`ActiveCampaign trigger info → ${KNOWN_EVENTS.length} canonical events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_activecampaign_trigger',
  name: 'ActiveCampaign Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + canonical ActiveCampaign webhook events. Register via the AC API manually.',
  iconName: 'LuMegaphone',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the ActiveCampaign events/sources to subscribe to.',
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
          placeholder: '["subscribe", "deal_add"]',
          helperText: 'See supportedEvents in the output for the canonical list (AC accepts any registered event slug).',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
