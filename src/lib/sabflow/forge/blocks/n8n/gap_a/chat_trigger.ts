/**
 * Forge block: LangChain Chat Trigger (info shim).
 *
 * The actual chat trigger receiver is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. This block returns the
 * SabFlow URL pattern + the expected payload shape so authors can wire an
 * external chat UI (or a custom chat embed).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const SUPPORTED_EVENTS = ['message.received'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'LangChain Chat Trigger',
      sabflowReceiverUrl,
      supportedEvents: SUPPORTED_EVENTS,
      registrationInstructions:
        `POST chat messages to ${sabflowReceiverUrl} with a JSON body of the form { "sessionId": string, "message": string }.`,
      payloadShape: { sessionId: 'string', message: 'string' },
    },
    logs: [`LangChain Chat Trigger info → ${sabflowReceiverUrl}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_chat_trigger',
  name: 'Chat Trigger (info)',
  description: 'Returns the SabFlow webhook URL that accepts incoming chat messages for LangChain flows.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + expected payload shape for incoming chat.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
