/**
 * Forge block: Pipedrive Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pipedrive/PipedriveTrigger.node.ts
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. This action exposes the
 * SabFlow receiver URL plus the n8n event surface so flow authors can copy the
 * URL into the upstream service's webhook configuration UI.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const SERVICE = 'Pipedrive';

const SUPPORTED_EVENTS = [
  'activity.added',
  'activity.updated',
  'activity.deleted',
  'deal.added',
  'deal.updated',
  'deal.deleted',
  'deal.merged',
  'note.added',
  'note.updated',
  'note.deleted',
  'organization.added',
  'organization.updated',
  'organization.deleted',
  'person.added',
  'person.updated',
  'person.deleted',
  'pipeline.added',
  'pipeline.updated',
  'pipeline.deleted',
  'product.added',
  'product.updated',
  'product.deleted',
  'stage.added',
  'stage.updated',
  'stage.deleted',
  'user.added',
  'user.updated',
  '*.*',
] as const;

const REGISTRATION_DOCS =
  'https://developers.pipedrive.com/docs/api/v1/Webhooks';

const REGISTRATION_INSTRUCTIONS = [
  '1. In Pipedrive, open Tools and apps → Webhooks → Create new webhook.',
  '2. Set Event action + Event object (or use the *.* wildcard) and paste the SabFlow receiver URL below as the Endpoint URL.',
  '3. Save the webhook. Pipedrive will POST events to SabFlow which will route them into this flow.',
].join('\n');

async function registerTriggerInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId).trim();
  const eventsRaw = ctx.options.eventTypes;
  const eventTypes = parseEvents(eventsRaw);

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
      /* fall through to CSV */
    }
  }
  return s.split(',').map((v) => v.trim()).filter(Boolean);
}

const block: ForgeBlock = {
  id: 'forge_pipedrive_trigger',
  name: 'Pipedrive Trigger',
  description:
    'Registration-info shim for Pipedrive webhooks. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Pipedrive event surface so you can wire the upstream webhook by hand.',
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
          placeholder: '["deal.added","person.updated"] or comma-separated',
          helperText:
            'JSON array or comma-separated list of event slugs to subscribe to upstream.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
