/**
 * Forge block: Gumroad Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Gumroad/GumroadTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://app.gumroad.com/api#resource-subscriptions';
const KNOWN_EVENTS = ['sale', 'refund', 'dispute', 'dispute_won', 'cancellation'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const resource = asString(ctx.options.resource);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Gumroad',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: resource ? [resource] : [],
      registrationDocs: DOCS_URL,
      registrationInstructions: `PUT /resource_subscriptions in the Gumroad API with post_url=${sabflowReceiverUrl} and resource_name one of supportedEvents.`,
    },
    logs: [`Gumroad trigger info → ${KNOWN_EVENTS.length} known resources`],
  };
}

const block: ForgeBlock = {
  id: 'forge_gumroad_trigger',
  name: 'Gumroad Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Gumroad resource subscriptions.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Gumroad resource to subscribe to.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'resource', label: 'Resource', type: 'text', placeholder: 'sale', helperText: `One of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
