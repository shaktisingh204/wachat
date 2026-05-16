/**
 * Forge block: Formstack Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Formstack/FormstackTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://developers.formstack.com/reference/form-id-webhook-post';
const KNOWN_EVENTS = ['submission.created'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const formId = asString(ctx.options.formId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Formstack',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: KNOWN_EVENTS,
      formId,
      registrationDocs: DOCS_URL,
      registrationInstructions: `POST to /form/{formId}/webhook.json in the Formstack API with url=${sabflowReceiverUrl} and content_type=json.`,
    },
    logs: ['Formstack trigger info → submission.created'],
  };
}

const block: ForgeBlock = {
  id: 'forge_formstack_trigger',
  name: 'Formstack Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern for Formstack submissions.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Formstack form id to register.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'formId', label: 'Formstack form id', type: 'text', placeholder: '123456' },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
