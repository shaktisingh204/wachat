/**
 * Forge block: Wise Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via Wise's
 * subscriptions API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Wise/WiseTrigger.node.ts
 *
 * Wise events follow the `${resource}#${state}` shape on the API side; the
 * n8n node uses friendly slugs that map to API trigger_on names.
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
  'balanceCredit',
  'balanceUpdate',
  'transferActiveCases',
  'tranferStateChange',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const profileId = asString(ctx.options.profileId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Wise',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      profileId: profileId || null,
      registrationDocs: 'https://docs.wise.com/api-docs/api-reference/subscription',
      registrationInstructions:
        `POST /v3/profiles/{profileId}/subscriptions on Wise with delivery.url=${sabflowReceiverUrl} and trigger_on set to one of supportedEvents (Wise maps these to balances#credit, balances#update, transfers#active-cases, transfers#state-change).`,
    },
    logs: [`Wise trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_wise_trigger',
  name: 'Wise Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Wise subscription event slugs n8n supports. Register the URL via the Wise subscriptions API.',
  iconName: 'LuBanknote',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Wise event slugs to subscribe to.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'profileId',
          label: 'Wise profile ID',
          type: 'text',
          placeholder: '12345',
          helperText: 'Optional — echoed back so the caller can build the registration URL.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["balanceCredit"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
