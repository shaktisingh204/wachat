/**
 * Forge block: Flow Trigger (info shim).
 *
 * Registration-info shim. Actual incoming webhook handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Flow/FlowTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://developer.getflow.com/api/#webhooks';
const KNOWN_EVENTS = ['list', 'task'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const resource = asString(ctx.options.resource);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Flow',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: resource ? [resource] : [],
      registrationDocs: DOCS_URL,
      registrationInstructions: `Create an integration_webhooks POST in Flow API pointing at ${sabflowReceiverUrl} with resource_type one of supportedEvents and a resource_id.`,
    },
    logs: [`Flow trigger info → ${KNOWN_EVENTS.length} known resources`],
  };
}

const block: ForgeBlock = {
  id: 'forge_flow_trigger',
  name: 'Flow Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + supported Flow resource types.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Flow resource types to subscribe to.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'resource', label: 'Resource', type: 'text', placeholder: 'list', helperText: `One of: ${KNOWN_EVENTS.join(', ')}.` },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
