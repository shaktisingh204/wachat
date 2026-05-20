/**
 * Forge block: Notion Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Notion/NotionTrigger.node.ts
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

const SERVICE = 'Notion';

// n8n's NotionTrigger node uses polling (pageAddedToDatabase, pageUpdatedInDatabase).
// Notion's own webhook product (beta) supports the events below.
const SUPPORTED_EVENTS = [
  'page.created',
  'page.updated',
  'page.deleted',
  'page.moved',
  'page.locked',
  'page.unlocked',
  'database.created',
  'database.updated',
  'database.deleted',
  'database.schema_updated',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  // Polling-equivalents from the n8n trigger (use these when running via SabFlow's scheduler instead of webhooks)
  'pageAddedToDatabase',
  'pageUpdatedInDatabase',
] as const;

const REGISTRATION_DOCS = 'https://developers.notion.com/reference/webhooks';

const REGISTRATION_INSTRUCTIONS = [
  '1. In Notion: open your integration → Webhooks → Add subscription. Paste the SabFlow receiver URL below.',
  '2. Notion sends a verification token — copy it from the receiver logs and paste back into the Notion UI to activate.',
  '3. Once verified, Notion POSTs events as `{ type, entity, data }`. For polling mode, schedule a SabFlow cron trigger that lists DB pages instead.',
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
  id: 'forge_notion_trigger',
  name: 'Notion Trigger',
  description:
    'Registration-info shim for Notion webhooks / polling triggers. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Notion event surface so you can attach a webhook subscription to your integration.',
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
          placeholder: '["page.created","comment.created"] or comma-separated',
          helperText:
            'JSON array or comma-separated list of Notion webhook event slugs. Use pageAddedToDatabase / pageUpdatedInDatabase for the polling mode.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
