/**
 * Forge block: JotForm Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/JotForm/JotFormTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://api.jotform.com/docs/#post-form-id-webhooks';
const KNOWN_EVENTS = ['form.submitted'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const formId = asString(ctx.options.form);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Jotform',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: KNOWN_EVENTS,
      formId,
      registrationDocs: DOCS_URL,
      registrationInstructions: `POST /form/{formId}/webhooks in the Jotform API with webhookURL=${sabflowReceiverUrl}.`,
    },
    logs: ['Jotform trigger info → form.submitted'],
  };
}

const block: ForgeBlock = {
  id: 'forge_jotform_trigger',
  name: 'Jotform Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern for Jotform submissions.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Jotform form id to register.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'form', label: 'Jotform form id', type: 'text', placeholder: '212345678901234' },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
