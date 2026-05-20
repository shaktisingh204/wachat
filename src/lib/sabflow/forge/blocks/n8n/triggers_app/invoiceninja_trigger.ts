/**
 * Forge block: Invoice Ninja Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/InvoiceNinja/InvoiceNinjaTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://invoiceninja.github.io/docs/api/#tag/webhooks';
const KNOWN_EVENTS = [
  'create_client',
  'create_invoice',
  'create_payment',
  'create_quote',
  'create_vendor',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const event = asString(ctx.options.event);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Invoice Ninja',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: event ? [event] : [],
      registrationDocs: DOCS_URL,
      registrationInstructions: `POST /webhooks (v5) or /hooks (v4) in the Invoice Ninja API with target_url=${sabflowReceiverUrl} and event one of supportedEvents.`,
    },
    logs: [`Invoice Ninja trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_invoiceninja_trigger',
  name: 'Invoice Ninja Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Invoice Ninja event types.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Invoice Ninja event to subscribe to.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'event', label: 'Event', type: 'text', placeholder: 'create_invoice', helperText: `One of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
