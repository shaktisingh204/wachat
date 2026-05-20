/**
 * Forge block: Trello Trigger (registration-info shim)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Trello/TrelloTrigger.node.ts
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

const SERVICE = 'Trello';

// Trello uses a single webhook subscribed to a model (board/list/card/member);
// the webhook fires for ALL actions on that model. Common action types below.
const SUPPORTED_EVENTS = [
  'createCard',
  'updateCard',
  'deleteCard',
  'commentCard',
  'addMemberToCard',
  'removeMemberFromCard',
  'addAttachmentToCard',
  'createList',
  'updateList',
  'createBoard',
  'updateBoard',
  'addMemberToBoard',
  'moveCardFromBoard',
  'moveCardToBoard',
  '*',
] as const;

const REGISTRATION_DOCS =
  'https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/';

const REGISTRATION_INSTRUCTIONS = [
  '1. POST to https://api.trello.com/1/tokens/{token}/webhooks with the SabFlow receiver URL as callbackURL, plus the idModel (board / list / card / member) you want to watch.',
  '2. Trello will validate the callbackURL by sending a HEAD request — SabFlow returns 200 on /api/sabflow/webhook/<id>.',
  '3. Once registered, Trello POSTs action payloads. Filter by `action.type` inside your flow.',
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
  id: 'forge_trello_trigger',
  name: 'Trello Trigger',
  description:
    'Registration-info shim for Trello webhooks. The actual incoming webhook is handled by SabFlow’s webhook receiver.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Register trigger info',
      description:
        'Return the SabFlow receiver URL + Trello action surface so you can register the webhook against your model.',
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
          label: 'Action types to filter for',
          type: 'json',
          placeholder: '["createCard","commentCard"] or comma-separated',
          helperText:
            'Trello sends every action on the watched model — use this to document which `action.type` your flow consumes.',
        },
      ],
      run: registerTriggerInfo,
    },
  ],
};

registerForgeBlock(block);
export default block;
