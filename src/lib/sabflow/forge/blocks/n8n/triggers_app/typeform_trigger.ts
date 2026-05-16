/**
 * Forge block: Typeform Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via Typeform's
 * webhooks API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Typeform/TypeformTrigger.node.ts
 *
 * Typeform only delivers one event ('form_response') per registered form.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['form_response'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const formId = asString(ctx.options.formId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Typeform',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      formId: formId || null,
      registrationDocs: 'https://www.typeform.com/developers/webhooks/',
      registrationInstructions:
        `PUT /forms/{formId}/webhooks/{tag} on Typeform with url=${sabflowReceiverUrl} and enabled=true. Typeform sends event_type=form_response on every submission.`,
    },
    logs: [`Typeform trigger info → ${KNOWN_EVENTS.length} known event`],
  };
}

const block: ForgeBlock = {
  id: 'forge_typeform_trigger',
  name: 'Typeform Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Typeform form_response event metadata. Register the URL per-form via the Typeform API.',
  iconName: 'LuClipboardList',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Typeform form_response event metadata.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'formId',
          label: 'Typeform form ID',
          type: 'text',
          placeholder: 'AbCdEf',
          helperText: 'Optional — echoed back so the caller can build the registration URL.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["form_response"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
