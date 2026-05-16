/**
 * Forge block: Mautic Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The flow author must
 * create a Webhook in Mautic and select the desired triggers.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mautic/MauticTrigger.node.ts
 * Note: Mautic exposes the available triggers dynamically at
 *       `GET /api/hooks/triggers`. The list below is the well-known core
 *       set — the live list can be fetched at flow-design time.
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
  'mautic.lead_post_save_new',
  'mautic.lead_post_save_update',
  'mautic.lead_post_delete',
  'mautic.lead_points_change',
  'mautic.lead_post_status_change',
  'mautic.lead_post_dnc_change',
  'mautic.lead_post_company_change',
  'mautic.lead_channel_subscription_changed',
  'mautic.lead_company_change',
  'mautic.company_post_save',
  'mautic.company_post_delete',
  'mautic.email_on_open',
  'mautic.email_on_send',
  'mautic.form_on_submit',
  'mautic.page_on_hit',
  'mautic.point_on_action_trigger',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const eventsOrder = asString(ctx.options.eventsOrder) || 'ASC';
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Mautic',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      eventsOrder,
      registrationDocs: 'https://developer.mautic.org/#webhooks',
      registrationInstructions:
        `POST /api/hooks/new with { name, webhookUrl: "${sabflowReceiverUrl}", triggers: [<selectedEvents>], eventsOrderbyDir: "${eventsOrder}", isPublished: true } using OAuth2 or basic auth.`,
    },
    logs: [`Mautic trigger info → ${KNOWN_EVENTS.length} known triggers`],
  };
}

const block: ForgeBlock = {
  id: 'forge_mautic_trigger',
  name: 'Mautic Trigger (info)',
  description:
    'Returns the SabFlow receiver URL + Mautic trigger ids. Register via POST /api/hooks/new.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Mautic trigger ids to subscribe to.',
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
          label: 'Triggers (JSON array)',
          type: 'json',
          placeholder: '["mautic.lead_post_save_new", "mautic.form_on_submit"]',
          helperText: `One or more of (representative): ${KNOWN_EVENTS.join(', ')}. Fetch the live list at GET /api/hooks/triggers.`,
        },
        {
          id: 'eventsOrder',
          label: 'Events order',
          type: 'select',
          options: [
            { value: 'ASC', label: 'ASC' },
            { value: 'DESC', label: 'DESC' },
          ],
          helperText: 'Order direction for queued events in one webhook.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
