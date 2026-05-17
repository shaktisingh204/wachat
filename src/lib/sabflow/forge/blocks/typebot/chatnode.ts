/**
 * Forge block: ChatNode.ai (knowledge-base chat product)
 *
 * Source: typebot.io-main/packages/forge/blocks/chatNode/src/actions/sendMessage.ts
 *
 * Endpoint:
 *   POST https://www.chatnode.ai/api/v2/bot/<botId>/chat
 *   Headers: Authorization: Bearer <apiKey>
 *   Body: { message, sessionId? }
 *   Returns: { reply, source_documents? }
 *
 * Auth is `none` at the forge layer — apiKey is taken inline. Cross-port to
 * a Connections credential later if multiple actions are added.
 */

import { registerForgeBlock } from '../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../types';
import { apiRequest, asString } from '../n8n/_shared/http';

async function sendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const botId = asString(ctx.options.botId);
  const message = asString(ctx.options.message);
  const sessionId = asString(ctx.options.sessionId);
  if (!apiKey) throw new Error('ChatNode: apiKey is required');
  if (!botId) throw new Error('ChatNode: botId is required');
  if (!message) throw new Error('ChatNode: message is required');

  const body: Record<string, unknown> = { message };
  if (sessionId) body.sessionId = sessionId;

  const res = await apiRequest({
    service: 'ChatNode',
    method: 'POST',
    url: `https://www.chatnode.ai/api/v2/bot/${encodeURIComponent(botId)}/chat`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: body,
  });

  const data = (res.data ?? {}) as { reply?: unknown; source_documents?: unknown };
  return {
    outputs: { reply: data.reply, source_documents: data.source_documents },
    logs: [`ChatNode send_message → bot ${botId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_typebot_chatnode',
  name: 'ChatNode (typebot)',
  description: 'Send a message to a ChatNode.ai bot and read the reply (with optional source documents).',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'POST a message to /api/v2/bot/<botId>/chat and return the reply.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'botId', label: 'Bot ID', type: 'text', required: true, placeholder: '68c052c5c3680f63' },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'sessionId', label: 'Session ID', type: 'text', helperText: 'Optional — pass to keep the conversation context.' },
      ],
      run: sendMessage,
    },
  ],
};

registerForgeBlock(block);
export default block;
