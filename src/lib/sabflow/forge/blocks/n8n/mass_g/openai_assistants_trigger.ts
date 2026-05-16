/**
 * Forge block: OpenAI Assistants Trigger (info shim).
 *
 * Registration-info shim. OpenAI Assistants don't expose first-class webhooks
 * — n8n's trigger polls runs / threads / messages. This shim returns the
 * SabFlow receiver URL + the polling event slugs n8n supports.
 *
 * Source: OpenAI Assistants v2 API (threads, runs, messages, vector stores).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'thread.created',
  'thread.message.created',
  'thread.message.completed',
  'thread.run.created',
  'thread.run.queued',
  'thread.run.in_progress',
  'thread.run.requires_action',
  'thread.run.completed',
  'thread.run.failed',
  'thread.run.cancelled',
  'thread.run.expired',
  'thread.run.step.created',
  'thread.run.step.completed',
  'thread.run.step.failed',
  'assistant.created',
  'assistant.updated',
  'assistant.deleted',
  'vector_store.created',
  'vector_store.file.completed',
  'vector_store.file.failed',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'OpenAI Assistants',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://platform.openai.com/docs/assistants/overview',
      registrationInstructions:
        `OpenAI Assistants have no native webhooks — use a poller / cron block to call the Assistants API and POST events from supportedEvents to ${sabflowReceiverUrl}.`,
    },
    logs: [`OpenAI Assistants trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_openai_assistants_trigger',
  name: 'OpenAI Assistants Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + OpenAI Assistants run/message event slugs (poll-only — no native webhooks).',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + OpenAI Assistants event slugs.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["thread.run.completed", "thread.message.completed"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
