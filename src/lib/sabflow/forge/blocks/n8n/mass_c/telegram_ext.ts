/**
 * Forge block: Telegram (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Telegram/Telegram.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function url(ctx: ForgeActionContext, method: string): string {
  const token = asString(ctx.options.botToken);
  if (!token) throw new Error('Telegram: botToken is required');
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function sendChatAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const action = asString(ctx.options.action) || 'typing';
  if (!chatId) throw new Error('Telegram: chatId is required');
  const res = await apiRequest({
    service: 'Telegram',
    method: 'POST',
    url: url(ctx, 'sendChatAction'),
    json: { chat_id: chatId, action },
  });
  return { outputs: { result: res.data }, logs: [`Telegram chat action → ${action}`] };
}

async function getFile(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fileId = asString(ctx.options.fileId);
  if (!fileId) throw new Error('Telegram: fileId is required');
  const res = await apiRequest({
    service: 'Telegram',
    method: 'POST',
    url: url(ctx, 'getFile'),
    json: { file_id: fileId },
  });
  return { outputs: { file: res.data }, logs: [`Telegram getFile → ${fileId}`] };
}

async function pinMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const messageId = asString(ctx.options.messageId);
  if (!chatId || !messageId) throw new Error('Telegram: chatId and messageId are required');
  const res = await apiRequest({
    service: 'Telegram',
    method: 'POST',
    url: url(ctx, 'pinChatMessage'),
    json: { chat_id: chatId, message_id: Number(messageId) },
  });
  return { outputs: { result: res.data }, logs: [`Telegram pin → ${messageId}`] };
}

async function answerCallbackQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const callbackQueryId = asString(ctx.options.callbackQueryId);
  const text = asString(ctx.options.text);
  if (!callbackQueryId) throw new Error('Telegram: callbackQueryId is required');
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text) body.text = text;
  const res = await apiRequest({
    service: 'Telegram',
    method: 'POST',
    url: url(ctx, 'answerCallbackQuery'),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Telegram answerCallback → ${callbackQueryId}`] };
}

const CHAT_ACTIONS = [
  { label: 'Typing', value: 'typing' },
  { label: 'Upload photo', value: 'upload_photo' },
  { label: 'Record video', value: 'record_video' },
  { label: 'Upload video', value: 'upload_video' },
  { label: 'Record voice', value: 'record_voice' },
  { label: 'Upload voice', value: 'upload_voice' },
  { label: 'Upload document', value: 'upload_document' },
  { label: 'Find location', value: 'find_location' },
];

const block: ForgeBlock = {
  id: 'forge_telegram_ext',
  name: 'Telegram (extended)',
  description: 'Telegram ops (chat action, getFile, pin, answer callback).',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_chat_action',
      label: 'Send chat action',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'action', label: 'Action', type: 'select', options: CHAT_ACTIONS, defaultValue: 'typing' },
      ],
      run: sendChatAction,
    },
    {
      id: 'get_file',
      label: 'Get file metadata',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'fileId', label: 'File ID', type: 'text', required: true },
      ],
      run: getFile,
    },
    {
      id: 'pin_message',
      label: 'Pin message',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
      ],
      run: pinMessage,
    },
    {
      id: 'answer_callback_query',
      label: 'Answer callback query',
      fields: [
        { id: 'botToken', label: 'Bot token', type: 'password', required: true },
        { id: 'callbackQueryId', label: 'Callback query ID', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'text' },
      ],
      run: answerCallbackQuery,
    },
  ],
};

registerForgeBlock(block);
export default block;
