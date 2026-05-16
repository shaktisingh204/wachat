/**
 * Forge block: TheHive Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/TheHive/TheHiveTrigger.node.ts
 *
 * TheHive emits a payload with `objectType` + `operation` which n8n folds into
 * a single `${objectType}_${operation}` event slug.
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
  'alert_create',
  'alert_update',
  'alert_delete',
  'case_create',
  'case_update',
  'case_delete',
  'case_task_create',
  'case_task_update',
  'case_task_delete',
  'case_task_log_create',
  'case_task_log_update',
  'case_task_log_delete',
  'case_artifact_create',
  'case_artifact_update',
  'case_artifact_delete',
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
      service: 'TheHive',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://docs.strangebee.com/thehive/administration/webhooks/',
      registrationInstructions:
        `Configure a webhook in TheHive's application.conf (notification.webhook.endpoints) pointing at ${sabflowReceiverUrl}. TheHive emits every objectType_operation pair — filter inside the flow.`,
    },
    logs: [`TheHive trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_thehive_trigger',
  name: 'TheHive Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + TheHive objectType_operation slugs n8n supports. Configure the webhook in TheHive manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the TheHive event slugs to expect.',
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
          placeholder: '["case_create", "alert_update"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
