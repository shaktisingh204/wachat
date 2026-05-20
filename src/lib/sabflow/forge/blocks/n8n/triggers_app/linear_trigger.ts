/**
 * Forge block: Linear Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Linear/LinearTrigger.node.ts
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const SERVICE = 'Linear';

const SUPPORTED_EVENTS = [
  'Issue',
  'Comment',
  'IssueLabel',
  'Project',
  'ProjectUpdate',
  'Cycle',
  'Reaction',
  'Attachment',
] as const;

const REGISTRATION_DOCS =
  'https://developers.linear.app/docs/graphql/webhooks';

const REGISTRATION_INSTRUCTIONS = [
  '1. In Linear: Settings → API → Webhooks → New webhook.',
  '2. Paste the SabFlow receiver URL below into "URL" and tick the resource types you want events for.',
  '3. Save. Linear POSTs JSON with `action` (create/update/remove) + `type` (Issue/Comment/etc) + `data` — branch on these inside your flow.',
].join('\n');

async function registerTriggerInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId).trim();
  const eventTypes = parseEvents(ctx.options.eventTypes);

  const base = asString(ctx.variables.SABFLOW_PUBLIC_URL) || 'https://app.sabnode.com';
  const sabflowReceiverUrl = webhookId
    ? `${base.replace(/\/+$/, '')}/api/sabflow/webhook/${webhookId}`
    : `${base.replace(/\/+$/, '')}/api/sabflow/webhook/<webhookId>`;

  return {
    outputs: {
      service: SERVICE,
      sabflowReceiverUrl,
      supportedEvents: [...SUPPORTED_EVENTS],
      selectedEvents: eventTypes,
      registrationDocs: REGISTRATION_DOCS,
      registrationInstructions: REGISTRATION_INSTRUCTIONS,
    },
    logs: [`${SERVICE} Trigger info → receiver=${sabflowReceiverUrl}`],
  };
}

function parseEvents(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => asString(v)).filter(Boolean);
  const s = asString(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) return parsed.map((v) => asString(v)).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return s.split(',').map((v) => v.trim()).filter(Boolean);
}

const block: ForgeBlock = {
  id: 'forge_linear_trigger',
  name: 'Linear Trigger',
  description:
    'Registration-info shim for Linear webhooks. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Linear resource types so you can configure the webhook in Linear settings.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook ID',
          type: 'text',
          required: false,
          placeholder: 'mint via flow.events + upsertFlowWebhooks',
          helperText:
            'The `webhookId` minted by `upsertFlowWebhooks` for this flow. Leave blank to preview a placeholder URL.',
        },
        {
          id: 'eventTypes',
          label: 'Resource types',
          type: 'json',
          placeholder: '["Issue","Comment"] or comma-separated',
          helperText:
            'Resource types Linear should send events for (Issue, Comment, Project, Cycle, etc).',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
