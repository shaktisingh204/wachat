/**
 * Forge block: Airtable Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Airtable/AirtableTrigger.node.ts
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

const SERVICE = 'Airtable';

// n8n's AirtableTrigger node polls; Airtable's webhook API (v0) supports change types below.
const SUPPORTED_EVENTS = [
  'tableData',
  'tableFields',
  'tableMetadata',
  'add',
  'update',
  'remove',
  // Polling-equivalent (records changed since last poll)
  'recordChanged',
  'recordCreated',
] as const;

const REGISTRATION_DOCS = 'https://airtable.com/developers/web/api/webhooks-overview';

const REGISTRATION_INSTRUCTIONS = [
  '1. POST https://api.airtable.com/v0/bases/{baseId}/webhooks with body { notificationUrl: <SabFlow URL>, specification: { options: { filters: { dataTypes: [...] } } } }.',
  '2. Airtable returns `id` + `macSecretBase64`. Store the MAC secret if you want to verify the X-Airtable-Content-MAC header.',
  '3. Airtable sends ping notifications — your flow then GETs /webhooks/{id}/payloads to pull the change cursor.',
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
  id: 'forge_airtable_trigger',
  name: 'Airtable Trigger',
  description:
    'Registration-info shim for Airtable webhooks / polling triggers. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Airtable change types so you can register the webhook against a base.',
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
          label: 'Change types',
          type: 'json',
          placeholder: '["tableData","add","update"] or comma-separated',
          helperText:
            'Airtable change types or polling-style slugs. See the Airtable webhooks docs.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
