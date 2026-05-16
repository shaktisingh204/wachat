/**
 * Forge block: Workable Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via Workable's
 * subscriptions API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Workable/WorkableTrigger.node.ts
 *
 * n8n exposes friendly slugs (candidateCreated / candidateMoved) and converts
 * them to snake_case (candidate_created / candidate_moved) for the API.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['candidateCreated', 'candidateMoved'] as const;
const KNOWN_API_EVENTS = ['candidate_created', 'candidate_moved'] as const;

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
      service: 'Workable',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      apiEventNames: KNOWN_API_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://workable.readme.io/reference/subscriptions',
      registrationInstructions:
        `POST /spi/v3/subscriptions on Workable with target=${sabflowReceiverUrl}, event set to one of apiEventNames, and args.account_id=<subdomain> (optionally job_shortcode, stage_slug).`,
    },
    logs: [`Workable trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_workable_trigger',
  name: 'Workable Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Workable subscription event slugs n8n supports. Register the URL via the Workable subscriptions API.',
  iconName: 'LuUserPlus',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Workable event slugs to subscribe to.',
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
          placeholder: '["candidateCreated"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
