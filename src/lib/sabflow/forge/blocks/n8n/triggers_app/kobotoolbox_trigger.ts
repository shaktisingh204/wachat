/**
 * Forge block: KoBoToolbox Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The flow author must
 * register the URL as a REST Service hook on the target KoBoToolbox asset.
 *
 * Source: n8n-master/packages/nodes-base/nodes/KoBoToolbox/KoBoToolboxTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['formSubmission'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const formId = asString(ctx.options.formId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'KoBoToolbox',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      formId,
      registrationDocs: 'https://support.kobotoolbox.org/rest_services.html',
      registrationInstructions:
        `In KoBoToolbox, open the form (asset id "${formId || '<asset-id>'}") → REST Services → "Register a new service" → set Endpoint URL to ${sabflowReceiverUrl} and mark Active.`,
    },
    logs: ['KoBoToolbox trigger info → formSubmission'],
  };
}

const block: ForgeBlock = {
  id: 'forge_kobotoolbox_trigger',
  name: 'KoBoToolbox Trigger (info)',
  description:
    'Returns the SabFlow webhook URL for a KoBoToolbox form (asset). Register it as a REST Service hook on the asset.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + KoBoToolbox asset id to bind it to.',
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
          label: 'KoBoToolbox asset (form) id',
          type: 'text',
          placeholder: 'a4cD…',
          helperText: 'The KoBoToolbox asset uid the hook should be attached to.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
