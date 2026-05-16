/**
 * Forge block: Strava Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Strava/StravaTrigger.node.ts
 *
 * Strava webhook events are encoded as `${object_type}.${aspect_type}` pairs.
 * The official endpoint returns one of `activity` or `athlete` with an aspect
 * of `create`, `update`, or `delete`. See:
 *   https://developers.strava.com/docs/webhooks/
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_OBJECT_TYPES = ['activity', 'athlete'] as const;
const KNOWN_ASPECT_TYPES = ['create', 'update', 'delete'] as const;

const KNOWN_EVENTS = [
  'activity.create',
  'activity.update',
  'activity.delete',
  'athlete.create',
  'athlete.update',
  'athlete.delete',
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
      service: 'Strava',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      supportedObjectTypes: KNOWN_OBJECT_TYPES,
      supportedAspectTypes: KNOWN_ASPECT_TYPES,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developers.strava.com/docs/webhooks/',
      registrationInstructions:
        `POST to https://www.strava.com/api/v3/push_subscriptions with callback_url=${sabflowReceiverUrl} (and your verify_token). Strava streams every athlete.* + activity.* aspect by default — filter inside the flow.`,
    },
    logs: [`Strava trigger info → ${KNOWN_EVENTS.length} known event pairs`],
  };
}

const block: ForgeBlock = {
  id: 'forge_strava_trigger',
  name: 'Strava Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Strava webhook object/aspect pairs n8n supports. Subscribe via the Strava API manually.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Strava object/aspect pairs to expect.',
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
          placeholder: '["activity.create"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
