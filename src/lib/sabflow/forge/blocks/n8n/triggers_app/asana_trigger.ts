/**
 * Forge block: Asana Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Asana/AsanaTrigger.node.ts
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

const SERVICE = 'Asana';

// Asana webhooks fire on resource_type + action combinations.
const SUPPORTED_EVENTS = [
  'task.added',
  'task.changed',
  'task.removed',
  'task.deleted',
  'task.undeleted',
  'project.added',
  'project.changed',
  'project.removed',
  'project.deleted',
  'project.undeleted',
  'section.added',
  'section.changed',
  'section.removed',
  'story.added',
  'story.changed',
  'attachment.added',
  'tag.added',
  '*',
] as const;

const REGISTRATION_DOCS =
  'https://developers.asana.com/docs/webhooks';

const REGISTRATION_INSTRUCTIONS = [
  '1. POST https://app.asana.com/api/1.0/webhooks with { resource: <gid>, target: <SabFlow URL> }.',
  '2. Asana sends a handshake (X-Hook-Secret) — SabFlow must echo it back on first request. Configure this in the route if not already handled.',
  '3. Asana then POSTs `events[]` arrays. Each event has `resource.resource_type` and `action` you can match on.',
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
  id: 'forge_asana_trigger',
  name: 'Asana Trigger',
  description:
    'Registration-info shim for Asana webhooks. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Asana event surface so you can register the webhook against a resource.',
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
          placeholder: '["task.changed","story.added"] or comma-separated',
          helperText:
            'JSON array or comma-separated list of Asana resource.action slugs to filter for inside your flow.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
