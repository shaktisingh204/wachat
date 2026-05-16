/**
 * Forge block: Telegram (Bot API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Telegram/Telegram.node.ts (+ GenericFunctions.ts)
 * Credential type: 'telegram' — { botToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered (selected from the resource matrix):
 *   - message.sendMessage     POST /sendMessage
 *   - message.editMessageText POST /editMessageText
 *   - message.sendPhoto       POST /sendPhoto
 *   - message.sendChatAction  POST /sendChatAction
 *   - message.deleteMessage   POST /deleteMessage
 *   - chat.get                POST /getChat
 *
 * Out of scope for the first port:
 *   - Binary file uploads (only URL/file_id passthrough supported)
 *   - sendMediaGroup, sendLocation, inline-keyboard reply_markup builder
 *   - answerCallbackQuery / answerInlineQuery (callback resource)
 *   - SEND_AND_WAIT_OPERATION (uses webhook trigger system)
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const TELEGRAM_BASE = 'https://api.telegram.org';

async function tg(
  ctx: ForgeActionContext,
  endpoint: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const cred = requireCredential('Telegram', ctx.credential);
  const token = cred.botToken ?? cred.accessToken;
  if (!token) throw new Error('Telegram: credential missing `botToken`');

  const res = await apiRequest({
    service: 'Telegram',
    method: 'POST',
    url: `${TELEGRAM_BASE}/bot${token}/${endpoint}`,
    json: body,
  });
  const data = res.data as { ok?: boolean; result?: unknown; description?: string };
  if (data && data.ok === false) {
    throw new Error(`Telegram ${endpoint} failed: ${data.description ?? 'unknown error'}`);
  }
  return data?.result ?? data;
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const text = asString(ctx.options.text);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!text) throw new Error('Telegram: text is required');

  const body: Record<string, unknown> = { chat_id: chatId, text };
  const parseMode = asString(ctx.options.parseMode);
  if (parseMode) body.parse_mode = parseMode;
  const disableWebPreview = ctx.options.disableWebPagePreview;
  if (disableWebPreview === true || disableWebPreview === 'true') {
    body.disable_web_page_preview = true;
  }
  const replyTo = asString(ctx.options.replyToMessageId);
  if (replyTo) body.reply_to_message_id = Number(replyTo);

  const result = await tg(ctx, 'sendMessage', body);
  return { outputs: { message: result }, logs: [`Telegram sendMessage → ${chatId}`] };
}

async function messageEdit(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const messageId = asString(ctx.options.messageId);
  const text = asString(ctx.options.text);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!messageId) throw new Error('Telegram: messageId is required');
  if (!text) throw new Error('Telegram: text is required');

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: Number(messageId),
    text,
  };
  const parseMode = asString(ctx.options.parseMode);
  if (parseMode) body.parse_mode = parseMode;

  const result = await tg(ctx, 'editMessageText', body);
  return { outputs: { message: result }, logs: [`Telegram editMessageText → ${chatId}/${messageId}`] };
}

async function messagePhoto(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const photo = asString(ctx.options.photo);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!photo) throw new Error('Telegram: photo (URL or file_id) is required');

  const body: Record<string, unknown> = { chat_id: chatId, photo };
  const caption = asString(ctx.options.caption);
  if (caption) body.caption = caption;
  const parseMode = asString(ctx.options.parseMode);
  if (parseMode) body.parse_mode = parseMode;

  const result = await tg(ctx, 'sendPhoto', body);
  return { outputs: { message: result }, logs: [`Telegram sendPhoto → ${chatId}`] };
}

async function chatAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const action = asString(ctx.options.action);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!action) throw new Error('Telegram: action is required');

  const result = await tg(ctx, 'sendChatAction', { chat_id: chatId, action });
  return { outputs: { ok: result }, logs: [`Telegram sendChatAction → ${chatId}:${action}`] };
}

async function messageDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const messageId = asString(ctx.options.messageId);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!messageId) throw new Error('Telegram: messageId is required');

  const result = await tg(ctx, 'deleteMessage', {
    chat_id: chatId,
    message_id: Number(messageId),
  });
  return { outputs: { ok: result }, logs: [`Telegram deleteMessage → ${chatId}/${messageId}`] };
}

async function chatGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  if (!chatId) throw new Error('Telegram: chatId is required');
  const result = await tg(ctx, 'getChat', { chat_id: chatId });
  return { outputs: { chat: result }, logs: [`Telegram getChat → ${chatId}`] };
}

const block: ForgeBlock = {
  id: 'forge_telegram',
  name: 'Telegram',
  description: 'Send Telegram messages, edit them and inspect chats via the Bot API.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'telegram' },
  actions: [
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Send a text message to a chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true, placeholder: '@channel or 123456789' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        {
          id: 'parseMode',
          label: 'Parse mode',
          type: 'select',
          options: [
            { label: 'None', value: '' },
            { label: 'Markdown', value: 'Markdown' },
            { label: 'MarkdownV2', value: 'MarkdownV2' },
            { label: 'HTML', value: 'HTML' },
          ],
        },
        { id: 'disableWebPagePreview', label: 'Disable web page preview', type: 'toggle' },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'text' },
      ],
      run: messageSend,
    },
    {
      id: 'message_edit_text',
      label: 'Edit message text',
      description: 'Edit an existing text message.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
        { id: 'text', label: 'New text', type: 'textarea', required: true },
        {
          id: 'parseMode',
          label: 'Parse mode',
          type: 'select',
          options: [
            { label: 'None', value: '' },
            { label: 'Markdown', value: 'Markdown' },
            { label: 'MarkdownV2', value: 'MarkdownV2' },
            { label: 'HTML', value: 'HTML' },
          ],
        },
      ],
      run: messageEdit,
    },
    {
      id: 'message_send_photo',
      label: 'Send photo',
      description: 'Send a photo by URL or file_id.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'photo', label: 'Photo URL or file_id', type: 'text', required: true },
        { id: 'caption', label: 'Caption', type: 'textarea' },
        {
          id: 'parseMode',
          label: 'Caption parse mode',
          type: 'select',
          options: [
            { label: 'None', value: '' },
            { label: 'Markdown', value: 'Markdown' },
            { label: 'HTML', value: 'HTML' },
          ],
        },
      ],
      run: messagePhoto,
    },
    {
      id: 'chat_send_chat_action',
      label: 'Send chat action',
      description: 'Indicate typing/uploading status in a chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        {
          id: 'action',
          label: 'Action',
          type: 'select',
          required: true,
          options: [
            { label: 'Typing', value: 'typing' },
            { label: 'Upload photo', value: 'upload_photo' },
            { label: 'Record video', value: 'record_video' },
            { label: 'Upload video', value: 'upload_video' },
            { label: 'Record voice', value: 'record_voice' },
            { label: 'Upload voice', value: 'upload_voice' },
            { label: 'Upload document', value: 'upload_document' },
            { label: 'Find location', value: 'find_location' },
          ],
        },
      ],
      run: chatAction,
    },
    {
      id: 'message_delete',
      label: 'Delete message',
      description: 'Delete a message from a chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
      ],
      run: messageDelete,
    },
    {
      id: 'chat_get',
      label: 'Get chat',
      description: 'Fetch up-to-date info about a chat.',
      fields: [{ id: 'chatId', label: 'Chat ID', type: 'text', required: true }],
      run: chatGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
