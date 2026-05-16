/**
 * Forge block: n8n Form Trigger (info shim).
 *
 * Registration-info shim. n8n's Form Trigger hosts an in-product webform; in
 * SabFlow the equivalent inbound HTTP is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts` — point a form provider
 * there or use SabFlow Forms.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Form/FormTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.formtrigger/';
const KNOWN_EVENTS = ['form.submitted'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'n8n Form',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: KNOWN_EVENTS,
      registrationDocs: DOCS_URL,
      registrationInstructions: `Configure your form provider (or SabFlow Forms) to POST submissions to ${sabflowReceiverUrl}.`,
    },
    logs: ['n8n Form trigger info → form.submitted'],
  };
}

const block: ForgeBlock = {
  id: 'forge_form_trigger',
  name: 'Form Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern for inbound form submissions.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL for inbound form submissions.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
