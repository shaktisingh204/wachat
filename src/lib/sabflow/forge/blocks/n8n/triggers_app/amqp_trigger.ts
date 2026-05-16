/**
 * Forge block: AMQP Trigger (info shim).
 *
 * Registration-info shim. AMQP 1.0 is a long-running queue subscription
 * rather than a push webhook; the SabFlow receiver URL pattern still applies
 * for parity with the other trigger shims. The actual incoming queue
 * messages would be relayed through
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts` by a connector worker.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Amqp/AmqpTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['message.received'] as const;

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
      service: 'AMQP',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://www.amqp.org/specification/1.0/amqp-org-download',
      registrationInstructions:
        `Configure a worker to subscribe to the AMQP 1.0 queue/topic and POST each message to ${sabflowReceiverUrl}.`,
    },
    logs: [`AMQP trigger info → ${KNOWN_EVENTS.length} known event`],
  };
}

const block: ForgeBlock = {
  id: 'forge_amqp_trigger',
  name: 'AMQP Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern for an AMQP 1.0 queue/topic subscriber. Wire your AMQP worker to forward messages here.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL for forwarded AMQP messages.',
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
          placeholder: '["message.received"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
