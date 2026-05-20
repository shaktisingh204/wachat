/**
 * Forge block: Form.io Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/FormIo/FormIoTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://help.form.io/userguide/forms/actions/webhook';
const KNOWN_EVENTS = ['create', 'update'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventsRaw = ctx.options.events;
  const events = Array.isArray(eventsRaw) ? eventsRaw.map(asString).filter(Boolean) : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Form.io',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: events,
      registrationDocs: DOCS_URL,
      registrationInstructions: `Add a Webhook action on your Form.io form targeting ${sabflowReceiverUrl} with method one or more of supportedEvents.`,
    },
    logs: [`Form.io trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_formio_trigger',
  name: 'Form.io Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Form.io submission events.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Form.io event slugs to subscribe to.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'events', label: 'Events (JSON array)', type: 'json', placeholder: '["create", "update"]', helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
