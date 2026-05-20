/**
 * Forge block: Telegram (Bot API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Telegram/Telegram.node.ts (+ GenericFunctions.ts)
 * Credential type: 'telegram' — { botToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered (selected from the resource matrix):
 *   - message.sendMessage      POST /sendMessage
 *   - message.editMessageText  POST /editMessageText
 *   - message.sendPhoto        POST /sendPhoto
 *   - message.sendAudio        POST /sendAudio
 *   - message.sendVideo        POST /sendVideo
 *   - message.sendDocument     POST /sendDocument
 *   - message.sendAnimation    POST /sendAnimation
 *   - message.sendSticker      POST /sendSticker
 *   - message.sendLocation     POST /sendLocation
 *   - message.sendChatAction   POST /sendChatAction
 *   - message.deleteMessage    POST /deleteMessage
 *   - message.pinChatMessage   POST /pinChatMessage
 *   - message.unpinChatMessage POST /unpinChatMessage
 *   - chat.get                 POST /getChat
 *   - chat.administrators      POST /getChatAdministrators
 *   - chat.leave               POST /leaveChat
 *   - chat.member              POST /getChatMember
 *   - chat.setDescription      POST /setChatDescription
 *   - chat.setTitle            POST /setChatTitle
 *   - file.get                 POST /getFile
 *   - callback.answerQuery     POST /answerCallbackQuery
 *   - callback.answerInlineQuery POST /answerInlineQuery
 *
 * Out of scope for the first port:
 *   - Binary file uploads (only URL/file_id passthrough supported); inline-keyboard reply_markup builder
 *   - sendMediaGroup (multi-attachment payload builder)
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

// Shared helper: builds a sendXxx body with file + common additional fields.
function buildSendFileBody(ctx: ForgeActionContext, fileField: string): Record<string, unknown> {
  const chatId = asString(ctx.options.chatId);
  const file = asString(ctx.options.file);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!file) throw new Error(`Telegram: ${fileField} URL or file_id is required`);
  const body: Record<string, unknown> = { chat_id: chatId, [fileField]: file };
  const caption = asString(ctx.options.caption);
  if (caption) body.caption = caption;
  const parseMode = asString(ctx.options.parseMode);
  if (parseMode) body.parse_mode = parseMode;
  const replyTo = asString(ctx.options.replyToMessageId);
  if (replyTo) body.reply_to_message_id = Number(replyTo);
  const disableNotification = ctx.options.disableNotification;
  if (disableNotification === true || disableNotification === 'true') {
    body.disable_notification = true;
  }
  return body;
}

async function messageSendAudio(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body = buildSendFileBody(ctx, 'audio');
  const duration = asString(ctx.options.duration);
  if (duration) body.duration = Number(duration);
  const performer = asString(ctx.options.performer);
  if (performer) body.performer = performer;
  const title = asString(ctx.options.title);
  if (title) body.title = title;
  const result = await tg(ctx, 'sendAudio', body);
  return { outputs: { message: result }, logs: [`Telegram sendAudio → ${body.chat_id}`] };
}

async function messageSendVideo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body = buildSendFileBody(ctx, 'video');
  const duration = asString(ctx.options.duration);
  if (duration) body.duration = Number(duration);
  const width = asString(ctx.options.width);
  if (width) body.width = Number(width);
  const height = asString(ctx.options.height);
  if (height) body.height = Number(height);
  const result = await tg(ctx, 'sendVideo', body);
  return { outputs: { message: result }, logs: [`Telegram sendVideo → ${body.chat_id}`] };
}

async function messageSendDocument(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body = buildSendFileBody(ctx, 'document');
  const result = await tg(ctx, 'sendDocument', body);
  return { outputs: { message: result }, logs: [`Telegram sendDocument → ${body.chat_id}`] };
}

async function messageSendAnimation(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body = buildSendFileBody(ctx, 'animation');
  const duration = asString(ctx.options.duration);
  if (duration) body.duration = Number(duration);
  const result = await tg(ctx, 'sendAnimation', body);
  return { outputs: { message: result }, logs: [`Telegram sendAnimation → ${body.chat_id}`] };
}

async function messageSendSticker(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const sticker = asString(ctx.options.file);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!sticker) throw new Error('Telegram: sticker URL or file_id is required');
  const body: Record<string, unknown> = { chat_id: chatId, sticker };
  const replyTo = asString(ctx.options.replyToMessageId);
  if (replyTo) body.reply_to_message_id = Number(replyTo);
  const result = await tg(ctx, 'sendSticker', body);
  return { outputs: { message: result }, logs: [`Telegram sendSticker → ${chatId}`] };
}

async function messageSendLocation(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const latitude = asString(ctx.options.latitude);
  const longitude = asString(ctx.options.longitude);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!latitude) throw new Error('Telegram: latitude is required');
  if (!longitude) throw new Error('Telegram: longitude is required');
  const body: Record<string, unknown> = {
    chat_id: chatId,
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  const replyTo = asString(ctx.options.replyToMessageId);
  if (replyTo) body.reply_to_message_id = Number(replyTo);
  const result = await tg(ctx, 'sendLocation', body);
  return { outputs: { message: result }, logs: [`Telegram sendLocation → ${chatId}`] };
}

async function messagePin(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const messageId = asString(ctx.options.messageId);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!messageId) throw new Error('Telegram: messageId is required');
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: Number(messageId),
  };
  const disable = ctx.options.disableNotification;
  if (disable === true || disable === 'true') body.disable_notification = true;
  const result = await tg(ctx, 'pinChatMessage', body);
  return { outputs: { ok: result }, logs: [`Telegram pinChatMessage → ${chatId}/${messageId}`] };
}

async function messageUnpin(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const messageId = asString(ctx.options.messageId);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!messageId) throw new Error('Telegram: messageId is required');
  const result = await tg(ctx, 'unpinChatMessage', {
    chat_id: chatId,
    message_id: Number(messageId),
  });
  return { outputs: { ok: result }, logs: [`Telegram unpinChatMessage → ${chatId}/${messageId}`] };
}

async function chatAdministrators(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  if (!chatId) throw new Error('Telegram: chatId is required');
  const result = await tg(ctx, 'getChatAdministrators', { chat_id: chatId });
  return { outputs: { administrators: result }, logs: [`Telegram getChatAdministrators → ${chatId}`] };
}

async function chatLeave(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  if (!chatId) throw new Error('Telegram: chatId is required');
  const result = await tg(ctx, 'leaveChat', { chat_id: chatId });
  return { outputs: { ok: result }, logs: [`Telegram leaveChat → ${chatId}`] };
}

async function chatMember(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const userId = asString(ctx.options.userId);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!userId) throw new Error('Telegram: userId is required');
  const result = await tg(ctx, 'getChatMember', { chat_id: chatId, user_id: Number(userId) });
  return { outputs: { member: result }, logs: [`Telegram getChatMember → ${chatId}/${userId}`] };
}

async function chatSetDescription(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const description = asString(ctx.options.description);
  if (!chatId) throw new Error('Telegram: chatId is required');
  const result = await tg(ctx, 'setChatDescription', { chat_id: chatId, description });
  return { outputs: { ok: result }, logs: [`Telegram setChatDescription → ${chatId}`] };
}

async function chatSetTitle(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const chatId = asString(ctx.options.chatId);
  const title = asString(ctx.options.title);
  if (!chatId) throw new Error('Telegram: chatId is required');
  if (!title) throw new Error('Telegram: title is required');
  const result = await tg(ctx, 'setChatTitle', { chat_id: chatId, title });
  return { outputs: { ok: result }, logs: [`Telegram setChatTitle → ${chatId}`] };
}

async function fileGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const fileId = asString(ctx.options.fileId);
  if (!fileId) throw new Error('Telegram: fileId is required');
  const result = await tg(ctx, 'getFile', { file_id: fileId });
  return { outputs: { file: result }, logs: [`Telegram getFile → ${fileId}`] };
}

async function callbackAnswerQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryId = asString(ctx.options.queryId);
  if (!queryId) throw new Error('Telegram: queryId is required');
  const body: Record<string, unknown> = { callback_query_id: queryId };
  const text = asString(ctx.options.text);
  if (text) body.text = text;
  const showAlert = ctx.options.showAlert;
  if (showAlert === true || showAlert === 'true') body.show_alert = true;
  const url = asString(ctx.options.url);
  if (url) body.url = url;
  const cacheTime = asString(ctx.options.cacheTime);
  if (cacheTime) body.cache_time = Number(cacheTime);
  const result = await tg(ctx, 'answerCallbackQuery', body);
  return { outputs: { ok: result }, logs: [`Telegram answerCallbackQuery → ${queryId}`] };
}

async function callbackAnswerInlineQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queryId = asString(ctx.options.queryId);
  const results = ctx.options.results;
  if (!queryId) throw new Error('Telegram: queryId is required');
  if (results === undefined || results === null || results === '') {
    throw new Error('Telegram: results (JSON array of InlineQueryResult) is required');
  }
  // n8n accepts a JSON string here; pass through as-is when it's already an object.
  const parsedResults = typeof results === 'string' ? JSON.parse(results) : results;
  const body: Record<string, unknown> = {
    inline_query_id: queryId,
    results: parsedResults,
  };
  const cacheTime = asString(ctx.options.cacheTime);
  if (cacheTime) body.cache_time = Number(cacheTime);
  const isPersonal = ctx.options.isPersonal;
  if (isPersonal === true || isPersonal === 'true') body.is_personal = true;
  const nextOffset = asString(ctx.options.nextOffset);
  if (nextOffset) body.next_offset = nextOffset;
  const result = await tg(ctx, 'answerInlineQuery', body);
  return { outputs: { ok: result }, logs: [`Telegram answerInlineQuery → ${queryId}`] };
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
    {
      id: 'message_send_audio',
      label: 'Send audio',
      description: 'Send an audio file by URL or file_id.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'file', label: 'Audio URL or file_id', type: 'text', required: true },
        { id: 'caption', label: 'Caption', type: 'textarea' },
        { id: 'duration', label: 'Duration (seconds)', type: 'number' },
        { id: 'performer', label: 'Performer', type: 'text' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'text' },
        { id: 'disableNotification', label: 'Disable notification', type: 'toggle' },
      ],
      run: messageSendAudio,
    },
    {
      id: 'message_send_video',
      label: 'Send video',
      description: 'Send a video by URL or file_id.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'file', label: 'Video URL or file_id', type: 'text', required: true },
        { id: 'caption', label: 'Caption', type: 'textarea' },
        { id: 'duration', label: 'Duration (seconds)', type: 'number' },
        { id: 'width', label: 'Width', type: 'number' },
        { id: 'height', label: 'Height', type: 'number' },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'text' },
        { id: 'disableNotification', label: 'Disable notification', type: 'toggle' },
      ],
      run: messageSendVideo,
    },
    {
      id: 'message_send_document',
      label: 'Send document',
      description: 'Send a document by URL or file_id.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'file', label: 'Document URL or file_id', type: 'text', required: true },
        { id: 'caption', label: 'Caption', type: 'textarea' },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'text' },
        { id: 'disableNotification', label: 'Disable notification', type: 'toggle' },
      ],
      run: messageSendDocument,
    },
    {
      id: 'message_send_animation',
      label: 'Send animation',
      description: 'Send a GIF/animation by URL or file_id.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'file', label: 'Animation URL or file_id', type: 'text', required: true },
        { id: 'caption', label: 'Caption', type: 'textarea' },
        { id: 'duration', label: 'Duration (seconds)', type: 'number' },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'text' },
        { id: 'disableNotification', label: 'Disable notification', type: 'toggle' },
      ],
      run: messageSendAnimation,
    },
    {
      id: 'message_send_sticker',
      label: 'Send sticker',
      description: 'Send a sticker by URL or file_id.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'file', label: 'Sticker URL or file_id', type: 'text', required: true },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'text' },
      ],
      run: messageSendSticker,
    },
    {
      id: 'message_send_location',
      label: 'Send location',
      description: 'Send a geographical location to a chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'latitude', label: 'Latitude', type: 'text', required: true },
        { id: 'longitude', label: 'Longitude', type: 'text', required: true },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'text' },
      ],
      run: messageSendLocation,
    },
    {
      id: 'message_pin',
      label: 'Pin chat message',
      description: 'Pin a message in a chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
        { id: 'disableNotification', label: 'Disable notification', type: 'toggle' },
      ],
      run: messagePin,
    },
    {
      id: 'message_unpin',
      label: 'Unpin chat message',
      description: 'Unpin a message in a chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
      ],
      run: messageUnpin,
    },
    {
      id: 'chat_administrators',
      label: 'Get chat administrators',
      description: 'List the administrators of a chat.',
      fields: [{ id: 'chatId', label: 'Chat ID', type: 'text', required: true }],
      run: chatAdministrators,
    },
    {
      id: 'chat_leave',
      label: 'Leave chat',
      description: 'Cause the bot to leave a group/channel/supergroup.',
      fields: [{ id: 'chatId', label: 'Chat ID', type: 'text', required: true }],
      run: chatLeave,
    },
    {
      id: 'chat_member',
      label: 'Get chat member',
      description: 'Fetch information about a specific member of a chat.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: chatMember,
    },
    {
      id: 'chat_set_description',
      label: 'Set chat description',
      description: 'Update a chat description.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
      ],
      run: chatSetDescription,
    },
    {
      id: 'chat_set_title',
      label: 'Set chat title',
      description: 'Update a chat title.',
      fields: [
        { id: 'chatId', label: 'Chat ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
      ],
      run: chatSetTitle,
    },
    {
      id: 'file_get',
      label: 'Get file',
      description: 'Resolve a Telegram file_id to a downloadable file_path.',
      fields: [{ id: 'fileId', label: 'File ID', type: 'text', required: true }],
      run: fileGet,
    },
    {
      id: 'callback_answer_query',
      label: 'Answer callback query',
      description: 'Reply to an inline-keyboard callback query.',
      fields: [
        { id: 'queryId', label: 'Query ID', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'textarea' },
        { id: 'showAlert', label: 'Show alert', type: 'toggle' },
        { id: 'url', label: 'URL', type: 'text' },
        { id: 'cacheTime', label: 'Cache time (seconds)', type: 'number' },
      ],
      run: callbackAnswerQuery,
    },
    {
      id: 'callback_answer_inline_query',
      label: 'Answer inline query',
      description: 'Send results to an inline query. `results` accepts a JSON array of InlineQueryResult objects.',
      fields: [
        { id: 'queryId', label: 'Query ID', type: 'text', required: true },
        {
          id: 'results',
          label: 'Results (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"type":"article","id":"1","title":"Hello","input_message_content":{"message_text":"Hi"}}]',
        },
        { id: 'cacheTime', label: 'Cache time (seconds)', type: 'number' },
        { id: 'isPersonal', label: 'Is personal', type: 'toggle' },
        { id: 'nextOffset', label: 'Next offset', type: 'text' },
      ],
      run: callbackAnswerInlineQuery,
    },
  ],
};

registerForgeBlock(block);
export default block;
