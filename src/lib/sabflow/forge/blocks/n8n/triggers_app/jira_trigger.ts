/**
 * Forge block: Jira Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Jira/JiraTrigger.node.ts
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

const SERVICE = 'Jira';

const SUPPORTED_EVENTS = [
  'jira:issue_created',
  'jira:issue_updated',
  'jira:issue_deleted',
  'comment_created',
  'comment_updated',
  'comment_deleted',
  'worklog_created',
  'worklog_updated',
  'worklog_deleted',
  'attachment_created',
  'attachment_deleted',
  'project_created',
  'project_updated',
  'project_deleted',
  'version_released',
  'version_unreleased',
  'sprint_created',
  'sprint_started',
  'sprint_closed',
  'user_created',
  'user_updated',
  'user_deleted',
  '*',
] as const;

const REGISTRATION_DOCS =
  'https://developer.atlassian.com/cloud/jira/platform/webhooks/';

const REGISTRATION_INSTRUCTIONS = [
  '1. In Jira: Settings → System → WebHooks → Create a webhook. Or POST via the REST API: /rest/api/3/webhook.',
  '2. Set the URL to the SabFlow receiver URL below and tick the events you need (use JQL to scope to relevant projects).',
  '3. Jira POSTs JSON payloads with `webhookEvent` and `issue` fields — branch on these inside your flow.',
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
  id: 'forge_jira_trigger',
  name: 'Jira Trigger',
  description:
    'Registration-info shim for Jira webhooks. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Jira webhook event surface so you can configure the webhook in Jira.',
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
          placeholder: '["jira:issue_created","comment_created"] or comma-separated',
          helperText:
            'JSON array or comma-separated list of Jira webhook event names.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
