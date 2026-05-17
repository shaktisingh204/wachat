/**
 * Forge block: LangChain Manual Chat Trigger (info shim).
 *
 * Counterpart to `chat_trigger.ts` for testing/manual invocation: returns the
 * SabFlow webhook URL and an empty-default payload that the editor can post
 * directly from the test pane.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const SUPPORTED_EVENTS = ['manual.invoke'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const initialMessage = asString(ctx.options.initialMessage);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'LangChain Manual Chat Trigger',
      sabflowReceiverUrl,
      supportedEvents: SUPPORTED_EVENTS,
      initialMessage,
      registrationInstructions:
        `Use the SabFlow editor's Test pane to POST { "message": string } to ${sabflowReceiverUrl}.`,
    },
    logs: [`Manual Chat Trigger info → ${sabflowReceiverUrl}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_manual_chat_trigger',
  name: 'Manual Chat Trigger (info)',
  description: 'Returns the SabFlow URL used by the editor test pane to inject a manual chat message.',
  iconName: 'LuPlay',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the receiver URL + an initial message used for one-shot tests.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
        },
        {
          id: 'initialMessage',
          label: 'Initial test message',
          type: 'textarea',
          placeholder: 'Hello, this is a test.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
