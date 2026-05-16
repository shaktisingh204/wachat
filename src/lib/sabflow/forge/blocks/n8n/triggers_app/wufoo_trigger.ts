/**
 * Forge block: Wufoo Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * Wufoo PUT /forms/{formHash}/webhooks API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Wufoo/WufooTrigger.node.ts
 *
 * Wufoo only delivers one event ('entry_created') per registered form.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['entry_created'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const formHash = asString(ctx.options.formHash);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Wufoo',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      formHash: formHash || null,
      registrationDocs: 'https://wufoo.github.io/docs/#webhooks',
      registrationInstructions:
        `PUT /forms/{formHash}/webhooks.json on Wufoo with url=${sabflowReceiverUrl}, handshakeKey=<shared secret>, and metadata=true. Wufoo POSTs every new entry — there is only one event type.`,
    },
    logs: [`Wufoo trigger info → ${KNOWN_EVENTS.length} known event`],
  };
}

const block: ForgeBlock = {
  id: 'forge_wufoo_trigger',
  name: 'Wufoo Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + the Wufoo entry_created event metadata. Register the URL per-form via the Wufoo webhooks API.',
  iconName: 'LuClipboardList',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Wufoo entry_created event metadata.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'formHash',
          label: 'Wufoo form hash',
          type: 'text',
          placeholder: 'z1abcde0',
          helperText: 'Optional — echoed back so the caller can build the registration URL.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["entry_created"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
