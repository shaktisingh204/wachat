/**
 * Forge block: ClickUp Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/ClickUp/ClickUpTrigger.node.ts
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

const SERVICE = 'ClickUp';

const SUPPORTED_EVENTS = [
  'taskCreated',
  'taskUpdated',
  'taskDeleted',
  'taskAssigneeUpdated',
  'taskStatusUpdated',
  'taskMoved',
  'taskCommentPosted',
  'taskCommentUpdated',
  'taskTimeEstimateUpdated',
  'taskTimeTrackedUpdated',
  'listCreated',
  'listUpdated',
  'listDeleted',
  'folderCreated',
  'folderUpdated',
  'folderDeleted',
  'spaceCreated',
  'spaceUpdated',
  'spaceDeleted',
  'goalCreated',
  'goalUpdated',
  'goalDeleted',
  '*',
] as const;

const REGISTRATION_DOCS =
  'https://clickup.com/api/developer-portal/authentication/#oauth-app';

const REGISTRATION_INSTRUCTIONS = [
  '1. POST https://api.clickup.com/api/v2/team/{team_id}/webhook with body { endpoint: <SabFlow URL>, events: [...] }.',
  '2. ClickUp will return a webhook id + secret. Store the secret if you want to verify the X-Signature header in SabFlow.',
  '3. Events arrive as POSTs to the SabFlow receiver. Use `event` and `task_id` in the body to route.',
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
  id: 'forge_clickup_trigger',
  name: 'ClickUp Trigger',
  description:
    'Registration-info shim for ClickUp webhooks. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + ClickUp event surface so you can POST it into the ClickUp webhooks API.',
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
          label: 'Event types',
          type: 'json',
          placeholder: '["taskCreated","taskUpdated"] or comma-separated',
          helperText:
            'JSON array or comma-separated list of ClickUp event slugs to subscribe to.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
