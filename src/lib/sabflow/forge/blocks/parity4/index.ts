/**
 * Step parity-4 — twenty net-new forge integrations focused on real-time
 * media, transcription, KYC, and developer chat infra that the earlier
 * parity batches missed.  Each block ships its primary action (the 80/20
 * cut); broader API surface is reachable via the generic HTTP block.
 *
 *    1.  Mux Video             — create_asset
 *    2.  Stream Chat           — send_message
 *    3.  Pusher Channels       — trigger_event
 *    4.  Ably                  — publish_message
 *    5.  Crisp                 — send_message
 *    6.  Front                 — create_message
 *    7.  Help Scout            — create_conversation
 *    8.  Hopin                 — list_events
 *    9.  Tally                 — list_forms
 *   10.  Typeform-Ext          — get_responses
 *   11.  Algolia Search        — save_object
 *   12.  Sendbird              — send_message
 *   13.  Customer.io-Ext       — track_event
 *   14.  Persona               — create_inquiry
 *   15.  Stripe Identity       — create_verification_session
 *   16.  Mux Live              — create_live_stream
 *   17.  Cloudflare Stream     — create_video_upload
 *   18.  Replicate Predictions — create_prediction
 *   19.  AssemblyAI            — transcribe
 *   20.  Deepgram              — transcribe_url
 */

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

/* ── helpers ──────────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

async function jsonRequest(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  rawBody?: string;
}): Promise<unknown> {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: { Accept: 'application/json', ...opts.headers },
    body:
      opts.rawBody !== undefined
        ? opts.rawBody
        : opts.body === undefined
          ? undefined
          : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  const data: unknown = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const detail =
      typeof data === 'string' ? data : data ? JSON.stringify(data).slice(0, 400) : '';
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail}`);
  }
  return data;
}

function writeOutput(ctx: ForgeActionContext, value: unknown): Record<string, unknown> {
  const key = str(ctx.options.outputVariable);
  return key ? { [key]: value, result: value } : { result: value };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function basicAuth(username: string, password: string): string {
  const b64 = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${b64}`;
}

/* ── 1. Mux Video — create asset ──────────────────────────────────────── */

async function muxCreateAsset(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tokenId = ctx.credential?.tokenId ?? ctx.credential?.apiKey ?? ctx.credential?.username;
  const tokenSecret = ctx.credential?.tokenSecret ?? ctx.credential?.apiSecret ?? ctx.credential?.password;
  if (!tokenId || !tokenSecret) throw new Error('Mux: select a credential (tokenId + tokenSecret)');

  const inputUrl = str(ctx.options.inputUrl);
  if (!inputUrl) throw new Error('Mux: inputUrl is required');

  const body: Record<string, unknown> = {
    input: [{ url: inputUrl }],
    playback_policy: [str(ctx.options.playbackPolicy) || 'public'],
  };
  const mp4Support = str(ctx.options.mp4Support);
  if (mp4Support) body.mp4_support = mp4Support;
  const normalizeAudio = ctx.options.normalizeAudio;
  if (typeof normalizeAudio === 'boolean') body.normalize_audio = normalizeAudio;
  const extra = asRecord(ctx.options.extra);
  if (extra) Object.assign(body, extra);

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.mux.com/video/v1/assets',
    headers: {
      Authorization: basicAuth(tokenId, tokenSecret),
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Mux: created asset from ${inputUrl}`],
  };
}

registerForgeBlock({
  id: 'forge_mux_video',
  name: 'Mux Video',
  description: 'Create a Mux video asset from a source URL.',
  iconName: 'LuFilm',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mux' as never },
  actions: [
    {
      id: 'create_asset',
      label: 'Create asset',
      description: 'POST https://api.mux.com/video/v1/assets (basic auth tokenId:tokenSecret).',
      fields: [
        { id: 'inputUrl',       label: 'Input URL (mp4 / hls / mov / …)', type: 'text', required: true },
        { id: 'playbackPolicy', label: 'Playback policy (public / signed)', type: 'text', placeholder: 'public' },
        { id: 'mp4Support',     label: 'MP4 support (standard / none)', type: 'text' },
        { id: 'normalizeAudio', label: 'Normalize audio', type: 'toggle' },
        { id: 'extra',          label: 'Extra body fields (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: muxCreateAsset,
    },
  ],
} satisfies ForgeBlock);

/* ── 2. Stream Chat — send message ────────────────────────────────────── */

async function streamChatSendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.key;
  const apiSecret = ctx.credential?.apiSecret ?? ctx.credential?.secret;
  const serverToken = ctx.credential?.serverToken ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Stream Chat: select a credential (apiKey required)');

  const channelType = str(ctx.options.channelType) || 'messaging';
  const channelId = str(ctx.options.channelId);
  const text = str(ctx.options.text);
  const userId = str(ctx.options.userId);
  if (!channelId) throw new Error('Stream Chat: channelId is required');
  if (!text && !ctx.options.attachments) throw new Error('Stream Chat: text or attachments required');
  if (!userId) throw new Error('Stream Chat: userId is required');

  const message: Record<string, unknown> = { text };
  const attachments = ctx.options.attachments;
  if (Array.isArray(attachments)) message.attachments = attachments;
  const extra = asRecord(ctx.options.extra);
  if (extra) Object.assign(message, extra);

  const body: Record<string, unknown> = { message, user_id: userId };

  if (!serverToken && !apiSecret) {
    throw new Error('Stream Chat: provide serverToken (preferred) or apiSecret on the credential');
  }
  const token = serverToken ?? '';

  const url =
    `https://chat.stream-io-api.com/channels/${encodeURIComponent(channelType)}/${encodeURIComponent(channelId)}` +
    `/message?api_key=${encodeURIComponent(apiKey)}`;

  const data = await jsonRequest({
    method: 'POST',
    url,
    headers: {
      Authorization: token,
      'Stream-Auth-Type': 'jwt',
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Stream Chat: posted message to ${channelType}:${channelId}`],
  };
}

registerForgeBlock({
  id: 'forge_stream_chat',
  name: 'Stream Chat',
  description: 'Send a chat message to a Stream channel.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'stream' as never },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'POST https://chat.stream-io-api.com/channels/{type}/{id}/message.',
      fields: [
        { id: 'channelType',  label: 'Channel type', type: 'text', required: true, placeholder: 'messaging' },
        { id: 'channelId',    label: 'Channel id', type: 'text', required: true },
        { id: 'userId',       label: 'User id (sender)', type: 'text', required: true },
        { id: 'text',         label: 'Text', type: 'textarea' },
        { id: 'attachments',  label: 'Attachments (JSON array)', type: 'json' },
        { id: 'extra',        label: 'Extra message fields (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: streamChatSendMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 3. Pusher Channels — trigger event ───────────────────────────────── */

function pusherHmacMd5Sha256(key: string, data: string): string {
  /* Use Node crypto when available — falls back to error otherwise. */
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto: typeof import('crypto') = require('crypto');
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function md5(data: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto: typeof import('crypto') = require('crypto');
  return crypto.createHash('md5').update(data, 'utf8').digest('hex');
}

async function pusherTriggerEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const appId = ctx.credential?.appId ?? str(ctx.options.appId);
  const key = ctx.credential?.appKey ?? ctx.credential?.key ?? ctx.credential?.apiKey;
  const secret = ctx.credential?.appSecret ?? ctx.credential?.secret ?? ctx.credential?.apiSecret;
  const cluster = ctx.credential?.cluster ?? str(ctx.options.cluster) ?? 'mt1';
  if (!appId || !key || !secret) throw new Error('Pusher: appId + key + secret are required');

  const channel = str(ctx.options.channel);
  const eventName = str(ctx.options.eventName);
  if (!channel) throw new Error('Pusher: channel is required');
  if (!eventName) throw new Error('Pusher: eventName is required');

  const dataField = ctx.options.data;
  const dataStr =
    typeof dataField === 'string' ? dataField : JSON.stringify(dataField ?? {});

  const bodyObj: Record<string, unknown> = {
    name: eventName,
    channels: [channel],
    data: dataStr,
  };
  const socketId = str(ctx.options.socketId);
  if (socketId) bodyObj.socket_id = socketId;
  const bodyStr = JSON.stringify(bodyObj);

  const bodyMd5 = md5(bodyStr);
  const authTimestamp = Math.floor(Date.now() / 1000);
  const path = `/apps/${appId}/events`;
  const stringToSign =
    `POST\n${path}\nauth_key=${key}&auth_timestamp=${authTimestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
  const signature = pusherHmacMd5Sha256(secret, stringToSign);

  const url =
    `https://api-${cluster}.pusher.com${path}` +
    `?auth_key=${encodeURIComponent(key)}&auth_timestamp=${authTimestamp}` +
    `&auth_version=1.0&body_md5=${bodyMd5}&auth_signature=${signature}`;

  const data = await jsonRequest({
    method: 'POST',
    url,
    headers: { 'Content-Type': 'application/json' },
    rawBody: bodyStr,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Pusher: triggered ${eventName} on ${channel}`],
  };
}

registerForgeBlock({
  id: 'forge_pusher',
  name: 'Pusher Channels',
  description: 'Trigger a Pusher Channels event on a channel.',
  iconName: 'LuRadio',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pusher' as never },
  actions: [
    {
      id: 'trigger_event',
      label: 'Trigger event',
      description: 'POST /apps/{app_id}/events (HMAC-SHA256 signature).',
      fields: [
        { id: 'appId',     label: 'App ID (overrides credential)', type: 'text' },
        { id: 'cluster',   label: 'Cluster (overrides credential)', type: 'text', placeholder: 'mt1' },
        { id: 'channel',   label: 'Channel', type: 'text', required: true },
        { id: 'eventName', label: 'Event name', type: 'text', required: true },
        { id: 'data',      label: 'Event data (string or JSON)', type: 'json' },
        { id: 'socketId',  label: 'Socket id to exclude (optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: pusherTriggerEvent,
    },
  ],
} satisfies ForgeBlock);

/* ── 4. Ably — publish message ────────────────────────────────────────── */

async function ablyPublishMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey =
    ctx.credential?.apiKey ?? ctx.credential?.key ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Ably: select a credential (apiKey: keyId.keyValue)');

  const channel = str(ctx.options.channel);
  const eventName = str(ctx.options.eventName) || 'message';
  if (!channel) throw new Error('Ably: channel is required');

  const data = ctx.options.data;
  const body: Record<string, unknown> = {
    name: eventName,
    data: typeof data === 'string' ? data : (data ?? null),
  };
  const clientId = str(ctx.options.clientId);
  if (clientId) body.clientId = clientId;

  const [keyId, keyValue] = String(apiKey).split(':');
  if (!keyId || !keyValue) throw new Error('Ably: apiKey must be in keyId:keyValue format');

  const resp = await jsonRequest({
    method: 'POST',
    url: `https://rest.ably.io/channels/${encodeURIComponent(channel)}/messages`,
    headers: {
      Authorization: basicAuth(keyId, keyValue),
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, resp),
    logs: [`Ably: published ${eventName} on ${channel}`],
  };
}

registerForgeBlock({
  id: 'forge_ably',
  name: 'Ably',
  description: 'Publish a message to an Ably channel.',
  iconName: 'LuWaves',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'ably' as never },
  actions: [
    {
      id: 'publish_message',
      label: 'Publish message',
      description: 'POST https://rest.ably.io/channels/{channel}/messages (basic auth).',
      fields: [
        { id: 'channel',   label: 'Channel', type: 'text', required: true },
        { id: 'eventName', label: 'Event name', type: 'text', placeholder: 'message' },
        { id: 'data',      label: 'Data (string or JSON)', type: 'json' },
        { id: 'clientId',  label: 'Client id (optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: ablyPublishMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 5. Crisp — send message ──────────────────────────────────────────── */

async function crispSendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const identifier = ctx.credential?.identifier ?? ctx.credential?.apiKey ?? ctx.credential?.username;
  const key = ctx.credential?.key ?? ctx.credential?.apiSecret ?? ctx.credential?.password;
  const tier = ctx.credential?.tier ?? 'plugin';
  if (!identifier || !key) throw new Error('Crisp: select a credential (identifier + key)');

  const websiteId = ctx.credential?.websiteId ?? str(ctx.options.websiteId);
  const sessionId = str(ctx.options.sessionId);
  if (!websiteId) throw new Error('Crisp: websiteId is required');
  if (!sessionId) throw new Error('Crisp: sessionId is required');

  const body: Record<string, unknown> = {
    type: str(ctx.options.type) || 'text',
    from: str(ctx.options.from) || 'operator',
    origin: str(ctx.options.origin) || 'chat',
    content: ctx.options.content,
  };
  const user = asRecord(ctx.options.user);
  if (user) body.user = user;

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.crisp.chat/v1/website/${encodeURIComponent(websiteId)}/conversation/${encodeURIComponent(sessionId)}/message`,
    headers: {
      Authorization: basicAuth(String(identifier), String(key)),
      'X-Crisp-Tier': String(tier),
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Crisp: sent message to ${websiteId}/${sessionId}`],
  };
}

registerForgeBlock({
  id: 'forge_crisp',
  name: 'Crisp',
  description: 'Send a message into a Crisp conversation.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'crisp' as never },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'POST /v1/website/{website_id}/conversation/{session_id}/message.',
      fields: [
        { id: 'websiteId', label: 'Website id (overrides credential)', type: 'text' },
        { id: 'sessionId', label: 'Conversation session id', type: 'text', required: true },
        { id: 'type',      label: 'Type (text / picker / file / note / …)', type: 'text', placeholder: 'text' },
        { id: 'from',      label: 'From (operator / user)', type: 'text', placeholder: 'operator' },
        { id: 'origin',    label: 'Origin', type: 'text', placeholder: 'chat' },
        { id: 'content',   label: 'Content (string or JSON)', type: 'json' },
        { id: 'user',      label: 'User (JSON object, optional)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: crispSendMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 6. Front — create message ────────────────────────────────────────── */

async function frontCreateMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Front: select a credential (bearer token)');

  const channelId = str(ctx.options.channelId);
  if (!channelId) throw new Error('Front: channelId is required');

  const body: Record<string, unknown> = {
    to: Array.isArray(ctx.options.to) ? ctx.options.to : [str(ctx.options.to)],
    body: str(ctx.options.bodyText),
  };
  const subject = str(ctx.options.subject);
  if (subject) body.subject = subject;
  const senderName = str(ctx.options.senderName);
  if (senderName) body.sender_name = senderName;
  const optionsObj = asRecord(ctx.options.fronOptions);
  if (optionsObj) body.options = optionsObj;

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api2.frontapp.com/channels/${encodeURIComponent(channelId)}/messages`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Front: created outbound message via channel ${channelId}`],
  };
}

registerForgeBlock({
  id: 'forge_front',
  name: 'Front',
  description: 'Send an outbound Front message via a channel.',
  iconName: 'LuInbox',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'front' as never },
  actions: [
    {
      id: 'create_message',
      label: 'Create message',
      description: 'POST https://api2.frontapp.com/channels/{channel_id}/messages.',
      fields: [
        { id: 'channelId',  label: 'Channel id', type: 'text', required: true },
        { id: 'to',         label: 'Recipients (comma-list or JSON array)', type: 'json' },
        { id: 'subject',    label: 'Subject (optional, email only)', type: 'text' },
        { id: 'bodyText',   label: 'Body', type: 'textarea' },
        { id: 'senderName', label: 'Sender name (optional)', type: 'text' },
        { id: 'fronOptions', label: 'Options (JSON object, e.g. archive, tags)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: frontCreateMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 7. Help Scout — create conversation ──────────────────────────────── */

async function helpScoutCreateConversation(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Help Scout: select a credential (bearer token)');

  const subject = str(ctx.options.subject);
  const type = str(ctx.options.type) || 'email';
  const mailboxId = Number(ctx.options.mailboxId);
  const customerEmail = str(ctx.options.customerEmail);
  const text = str(ctx.options.text);
  if (!subject) throw new Error('Help Scout: subject is required');
  if (!Number.isFinite(mailboxId) || mailboxId <= 0) throw new Error('Help Scout: mailboxId is required');
  if (!customerEmail) throw new Error('Help Scout: customerEmail is required');
  if (!text) throw new Error('Help Scout: thread text is required');

  const body: Record<string, unknown> = {
    subject,
    type,
    mailboxId,
    status: str(ctx.options.status) || 'active',
    customer: { email: customerEmail },
    threads: [
      { type: 'reply', customer: { email: customerEmail }, text },
    ],
  };
  const tags = ctx.options.tags;
  if (Array.isArray(tags)) body.tags = tags;
  const extra = asRecord(ctx.options.extra);
  if (extra) Object.assign(body, extra);

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.helpscout.net/v2/conversations',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Help Scout: created ${type} conversation in mailbox ${mailboxId}`],
  };
}

registerForgeBlock({
  id: 'forge_helpscout',
  name: 'Help Scout',
  description: 'Create a Help Scout conversation in a mailbox.',
  iconName: 'LuLifeBuoy',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'helpscout' as never },
  actions: [
    {
      id: 'create_conversation',
      label: 'Create conversation',
      description: 'POST https://api.helpscout.net/v2/conversations.',
      fields: [
        { id: 'mailboxId',     label: 'Mailbox id', type: 'number', required: true },
        { id: 'subject',       label: 'Subject', type: 'text', required: true },
        { id: 'type',          label: 'Type (email / chat / phone)', type: 'text', placeholder: 'email' },
        { id: 'status',        label: 'Status (active / pending / closed)', type: 'text', placeholder: 'active' },
        { id: 'customerEmail', label: 'Customer email', type: 'text', required: true },
        { id: 'text',          label: 'Initial thread text', type: 'textarea', required: true },
        { id: 'tags',          label: 'Tags (JSON array)', type: 'json' },
        { id: 'extra',         label: 'Extra fields (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: helpScoutCreateConversation,
    },
  ],
} satisfies ForgeBlock);

/* ── 8. Hopin — list events ───────────────────────────────────────────── */

async function hopinListEvents(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Hopin: select a credential (bearer token)');

  const params = new URLSearchParams();
  const status = str(ctx.options.status);
  if (status) params.set('status', status);
  const page = Number(ctx.options.page);
  if (Number.isFinite(page) && page > 0) params.set('page', String(Math.round(page)));
  const perPage = Number(ctx.options.perPage);
  if (Number.isFinite(perPage) && perPage > 0) {
    params.set('per_page', String(Math.min(100, Math.max(1, Math.round(perPage)))));
  }
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.hopin.com/v1/events${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Hopin: listed events${status ? ` (status=${status})` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_hopin',
  name: 'Hopin',
  description: 'List Hopin events on the current organisation.',
  iconName: 'LuCalendarHeart',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'hopin' as never },
  actions: [
    {
      id: 'list_events',
      label: 'List events',
      description: 'GET https://api.hopin.com/v1/events.',
      fields: [
        { id: 'status',  label: 'Status (draft / published / completed)', type: 'text' },
        { id: 'page',    label: 'Page (1-based)', type: 'number' },
        { id: 'perPage', label: 'Per page (1–100)', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: hopinListEvents,
    },
  ],
} satisfies ForgeBlock);

/* ── 9. Tally — list forms ────────────────────────────────────────────── */

async function tallyListForms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Tally: select a credential (bearer token)');

  const params = new URLSearchParams();
  const page = Number(ctx.options.page);
  if (Number.isFinite(page) && page > 0) params.set('page', String(Math.round(page)));
  const limit = Number(ctx.options.limit);
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(Math.min(100, Math.max(1, Math.round(limit)))));
  }
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.tally.so/forms${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: ['Tally: listed forms'],
  };
}

registerForgeBlock({
  id: 'forge_tally_ext',
  name: 'Tally',
  description: 'List the forms accessible to the Tally workspace.',
  iconName: 'LuClipboardList',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'tally' as never },
  actions: [
    {
      id: 'list_forms',
      label: 'List forms',
      description: 'GET https://api.tally.so/forms (Bearer token).',
      fields: [
        { id: 'page',  label: 'Page (1-based)', type: 'number' },
        { id: 'limit', label: 'Limit (1–100)', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: tallyListForms,
    },
  ],
} satisfies ForgeBlock);

/* ── 10. Typeform-Ext — get responses ─────────────────────────────────── */

async function typeformGetResponses(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Typeform: select a credential (bearer token)');

  const formId = str(ctx.options.formId);
  if (!formId) throw new Error('Typeform: formId is required');

  const params = new URLSearchParams();
  const pageSize = Number(ctx.options.pageSize);
  if (Number.isFinite(pageSize) && pageSize > 0) {
    params.set('page_size', String(Math.min(1000, Math.max(1, Math.round(pageSize)))));
  }
  const since = str(ctx.options.since);
  if (since) params.set('since', since);
  const until = str(ctx.options.until);
  if (until) params.set('until', until);
  const completed = ctx.options.completed;
  if (completed === true) params.set('completed', 'true');
  if (completed === false) params.set('completed', 'false');
  const after = str(ctx.options.after);
  if (after) params.set('after', after);
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.typeform.com/forms/${encodeURIComponent(formId)}/responses${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Typeform: fetched responses for form ${formId}`],
  };
}

registerForgeBlock({
  id: 'forge_typeform_ext',
  name: 'Typeform',
  description: 'Fetch responses for a Typeform form.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'typeform' as never },
  actions: [
    {
      id: 'get_responses',
      label: 'Get responses',
      description: 'GET https://api.typeform.com/forms/{form_id}/responses.',
      fields: [
        { id: 'formId',    label: 'Form id', type: 'text', required: true },
        { id: 'pageSize',  label: 'Page size (1–1000)', type: 'number' },
        { id: 'since',     label: 'Since (ISO 8601)', type: 'text' },
        { id: 'until',     label: 'Until (ISO 8601)', type: 'text' },
        { id: 'completed', label: 'Completed only', type: 'toggle' },
        { id: 'after',     label: 'After token (pagination)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: typeformGetResponses,
    },
  ],
} satisfies ForgeBlock);

/* ── 11. Algolia Search — save object ─────────────────────────────────── */

async function algoliaSaveObject(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const appId = ctx.credential?.applicationId ?? ctx.credential?.appId ?? str(ctx.options.appId);
  const adminKey = ctx.credential?.adminApiKey ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!appId || !adminKey) throw new Error('Algolia: appId + adminApiKey are required');

  const indexName = str(ctx.options.indexName);
  if (!indexName) throw new Error('Algolia: indexName is required');

  const objectRaw = ctx.options.object;
  const objectRec = asRecord(objectRaw);
  if (!objectRec) throw new Error('Algolia: object must be a JSON object');

  const objectId = str(ctx.options.objectId) || str(objectRec.objectID);
  const url = objectId
    ? `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/${encodeURIComponent(objectId)}`
    : `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}`;

  const data = await jsonRequest({
    method: objectId ? 'PUT' : 'POST',
    url,
    headers: {
      'X-Algolia-API-Key': String(adminKey),
      'X-Algolia-Application-Id': String(appId),
      'Content-Type': 'application/json',
    },
    body: objectRec,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Algolia: saved object to index ${indexName}${objectId ? ` (id=${objectId})` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_algolia',
  name: 'Algolia Search',
  description: 'Save (upsert) an object into an Algolia index.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'algolia' as never },
  actions: [
    {
      id: 'save_object',
      label: 'Save object',
      description: 'POST/PUT /1/indexes/{indexName}/{objectID?}.',
      fields: [
        { id: 'appId',     label: 'Application id (overrides credential)', type: 'text' },
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
        { id: 'objectId',  label: 'Object id (optional; PUT semantics)', type: 'text' },
        { id: 'object',    label: 'Object (JSON)', type: 'json', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: algoliaSaveObject,
    },
  ],
} satisfies ForgeBlock);

/* ── 12. Sendbird — send message ──────────────────────────────────────── */

async function sendbirdSendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiToken = ctx.credential?.apiToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  const appId = ctx.credential?.appId ?? str(ctx.options.appId);
  if (!apiToken) throw new Error('Sendbird: select a credential (API token)');
  if (!appId) throw new Error('Sendbird: appId is required');

  const channelType = str(ctx.options.channelType) || 'group_channels';
  const channelUrl = str(ctx.options.channelUrl);
  const userId = str(ctx.options.userId);
  const message = str(ctx.options.message);
  if (!channelUrl) throw new Error('Sendbird: channelUrl is required');
  if (!userId) throw new Error('Sendbird: userId is required');
  if (!message) throw new Error('Sendbird: message is required');

  const body: Record<string, unknown> = {
    message_type: str(ctx.options.messageType) || 'MESG',
    user_id: userId,
    message,
  };
  const customType = str(ctx.options.customType);
  if (customType) body.custom_type = customType;
  const data = asRecord(ctx.options.data);
  if (data) body.data = JSON.stringify(data);

  const resp = await jsonRequest({
    method: 'POST',
    url: `https://api-${appId}.sendbird.com/v3/${encodeURIComponent(channelType)}/${encodeURIComponent(channelUrl)}/messages`,
    headers: {
      'Api-Token': String(apiToken),
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, resp),
    logs: [`Sendbird: sent message to ${channelType}/${channelUrl}`],
  };
}

registerForgeBlock({
  id: 'forge_sendbird',
  name: 'Sendbird',
  description: 'Send a message into a Sendbird channel.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'sendbird' as never },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'POST /v3/{channel_type}/{channel_url}/messages (Api-Token).',
      fields: [
        { id: 'appId',        label: 'App id (overrides credential)', type: 'text' },
        { id: 'channelType',  label: 'Channel type (group_channels / open_channels)', type: 'text', placeholder: 'group_channels' },
        { id: 'channelUrl',   label: 'Channel URL', type: 'text', required: true },
        { id: 'userId',       label: 'Sender user id', type: 'text', required: true },
        { id: 'message',      label: 'Message text', type: 'textarea', required: true },
        { id: 'messageType',  label: 'Message type (MESG / FILE / ADMM)', type: 'text', placeholder: 'MESG' },
        { id: 'customType',   label: 'Custom type (optional)', type: 'text' },
        { id: 'data',         label: 'Data (JSON object, serialised)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: sendbirdSendMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 13. Customer.io-Ext — track event ────────────────────────────────── */

async function customerIoTrackEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = ctx.credential?.siteId ?? ctx.credential?.username ?? ctx.credential?.apiKey;
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.apiSecret ?? ctx.credential?.password;
  if (!siteId || !apiKey) throw new Error('Customer.io: siteId + apiKey required');

  const customerId = str(ctx.options.customerId);
  const eventName = str(ctx.options.eventName);
  if (!customerId) throw new Error('Customer.io: customerId is required');
  if (!eventName) throw new Error('Customer.io: eventName is required');

  const body: Record<string, unknown> = { name: eventName };
  const data = asRecord(ctx.options.data);
  if (data) body.data = data;
  const ts = Number(ctx.options.timestamp);
  if (Number.isFinite(ts) && ts > 0) body.timestamp = Math.round(ts);
  const type = str(ctx.options.type);
  if (type) body.type = type;

  const region = str(ctx.options.region) || 'us';
  const host = region === 'eu' ? 'track-eu.customer.io' : 'track.customer.io';

  const resp = await jsonRequest({
    method: 'POST',
    url: `https://${host}/api/v1/customers/${encodeURIComponent(customerId)}/events`,
    headers: {
      Authorization: basicAuth(String(siteId), String(apiKey)),
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, resp),
    logs: [`Customer.io: tracked ${eventName} for ${customerId}`],
  };
}

registerForgeBlock({
  id: 'forge_customer_io_ext',
  name: 'Customer.io',
  description: 'Track a behavioural event on a Customer.io customer.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'customer_io' as never },
  actions: [
    {
      id: 'track_event',
      label: 'Track event',
      description: 'POST /api/v1/customers/{customer_id}/events (basic auth).',
      fields: [
        { id: 'customerId', label: 'Customer id', type: 'text', required: true },
        { id: 'eventName',  label: 'Event name', type: 'text', required: true },
        { id: 'data',       label: 'Properties (JSON object)', type: 'json' },
        { id: 'timestamp',  label: 'Timestamp (unix seconds, optional)', type: 'number' },
        { id: 'type',       label: 'Type (event / page / screen, optional)', type: 'text' },
        { id: 'region',     label: 'Region (us / eu)', type: 'text', placeholder: 'us' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: customerIoTrackEvent,
    },
  ],
} satisfies ForgeBlock);

/* ── 14. Persona — create inquiry ─────────────────────────────────────── */

async function personaCreateInquiry(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Persona: select a credential (bearer token)');

  const templateId = str(ctx.options.templateId);
  if (!templateId) throw new Error('Persona: templateId is required');

  const attributes: Record<string, unknown> = {
    'inquiry-template-id': templateId,
  };
  const referenceId = str(ctx.options.referenceId);
  if (referenceId) attributes['reference-id'] = referenceId;
  const fields = asRecord(ctx.options.fields);
  if (fields) attributes.fields = fields;
  const note = str(ctx.options.note);
  if (note) attributes.note = note;

  const body = { data: { attributes } };

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://withpersona.com/api/v1/inquiries',
    headers: {
      Authorization: `Bearer ${token}`,
      'Persona-Version': str(ctx.options.apiVersion) || '2023-01-05',
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Persona: created inquiry from template ${templateId}`],
  };
}

registerForgeBlock({
  id: 'forge_persona',
  name: 'Persona KYC',
  description: 'Create a Persona KYC inquiry from a template.',
  iconName: 'LuShieldCheck',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'persona' as never },
  actions: [
    {
      id: 'create_inquiry',
      label: 'Create inquiry',
      description: 'POST https://withpersona.com/api/v1/inquiries.',
      fields: [
        { id: 'templateId',  label: 'Inquiry template id', type: 'text', required: true },
        { id: 'referenceId', label: 'Reference id (your user id)', type: 'text' },
        { id: 'fields',      label: 'Prefill fields (JSON object)', type: 'json' },
        { id: 'note',        label: 'Internal note (optional)', type: 'textarea' },
        { id: 'apiVersion',  label: 'Persona-Version header', type: 'text', placeholder: '2023-01-05' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: personaCreateInquiry,
    },
  ],
} satisfies ForgeBlock);

/* ── 15. Stripe Identity — create verification session ────────────────── */

async function stripeIdentityCreateSession(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.secretKey ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!token) throw new Error('Stripe Identity: select a credential (secret key)');

  const type = str(ctx.options.type) || 'document';
  const params = new URLSearchParams();
  params.set('type', type);
  const returnUrl = str(ctx.options.returnUrl);
  if (returnUrl) params.set('return_url', returnUrl);
  const clientReferenceId = str(ctx.options.clientReferenceId);
  if (clientReferenceId) params.set('client_reference_id', clientReferenceId);
  const metadata = asRecord(ctx.options.metadata);
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      params.set(`metadata[${k}]`, String(v));
    }
  }
  const allowedTypes = ctx.options.allowedDocumentTypes;
  if (Array.isArray(allowedTypes)) {
    for (const t of allowedTypes) {
      params.append('options[document][allowed_types][]', String(t));
    }
  }

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.stripe.com/v1/identity/verification_sessions',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    rawBody: params.toString(),
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Stripe Identity: created ${type} verification session`],
  };
}

registerForgeBlock({
  id: 'forge_stripe_identity',
  name: 'Stripe Identity',
  description: 'Create a Stripe Identity verification session.',
  iconName: 'LuBadgeCheck',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'stripe' as never },
  actions: [
    {
      id: 'create_verification_session',
      label: 'Create verification session',
      description: 'POST https://api.stripe.com/v1/identity/verification_sessions.',
      fields: [
        { id: 'type',                 label: 'Type (document / id_number)', type: 'text', placeholder: 'document' },
        { id: 'returnUrl',            label: 'Return URL', type: 'text' },
        { id: 'clientReferenceId',    label: 'Client reference id (your user id)', type: 'text' },
        { id: 'allowedDocumentTypes', label: 'Allowed document types (JSON array)', type: 'json' },
        { id: 'metadata',             label: 'Metadata (JSON object)', type: 'json' },
        { id: 'outputVariable',       label: 'Save response to variable', type: 'text' },
      ],
      run: stripeIdentityCreateSession,
    },
  ],
} satisfies ForgeBlock);

/* ── 16. Mux Live — create live stream ────────────────────────────────── */

async function muxLiveCreateStream(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tokenId = ctx.credential?.tokenId ?? ctx.credential?.apiKey ?? ctx.credential?.username;
  const tokenSecret = ctx.credential?.tokenSecret ?? ctx.credential?.apiSecret ?? ctx.credential?.password;
  if (!tokenId || !tokenSecret) throw new Error('Mux Live: tokenId + tokenSecret required');

  const body: Record<string, unknown> = {
    playback_policy: [str(ctx.options.playbackPolicy) || 'public'],
    new_asset_settings: {
      playback_policy: [str(ctx.options.assetPlaybackPolicy) || 'public'],
    },
  };
  const latencyMode = str(ctx.options.latencyMode);
  if (latencyMode) body.latency_mode = latencyMode;
  const reconnectWindow = Number(ctx.options.reconnectWindow);
  if (Number.isFinite(reconnectWindow) && reconnectWindow >= 0) body.reconnect_window = reconnectWindow;
  const test = ctx.options.test;
  if (typeof test === 'boolean') body.test = test;
  const extra = asRecord(ctx.options.extra);
  if (extra) Object.assign(body, extra);

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.mux.com/video/v1/live-streams',
    headers: {
      Authorization: basicAuth(String(tokenId), String(tokenSecret)),
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: ['Mux Live: created live stream'],
  };
}

registerForgeBlock({
  id: 'forge_mux_live',
  name: 'Mux Live',
  description: 'Create a Mux live stream with playback IDs.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mux' as never },
  actions: [
    {
      id: 'create_live_stream',
      label: 'Create live stream',
      description: 'POST https://api.mux.com/video/v1/live-streams.',
      fields: [
        { id: 'playbackPolicy',      label: 'Playback policy (public / signed)', type: 'text', placeholder: 'public' },
        { id: 'assetPlaybackPolicy', label: 'Asset playback policy', type: 'text', placeholder: 'public' },
        { id: 'latencyMode',         label: 'Latency mode (low / reduced / standard)', type: 'text' },
        { id: 'reconnectWindow',     label: 'Reconnect window (seconds)', type: 'number' },
        { id: 'test',                label: 'Test stream', type: 'toggle' },
        { id: 'extra',               label: 'Extra fields (JSON object)', type: 'json' },
        { id: 'outputVariable',      label: 'Save response to variable', type: 'text' },
      ],
      run: muxLiveCreateStream,
    },
  ],
} satisfies ForgeBlock);

/* ── 17. Cloudflare Stream — create video upload ──────────────────────── */

async function cloudflareStreamCreateUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  const accountId = ctx.credential?.accountId ?? str(ctx.options.accountId);
  if (!token) throw new Error('Cloudflare Stream: bearer token required');
  if (!accountId) throw new Error('Cloudflare Stream: accountId required');

  const maxDuration = Number(ctx.options.maxDurationSeconds);
  const body: Record<string, unknown> = {};
  if (Number.isFinite(maxDuration) && maxDuration > 0) {
    body.maxDurationSeconds = Math.round(maxDuration);
  }
  const meta = asRecord(ctx.options.meta);
  if (meta) body.meta = meta;
  const requireSignedUrls = ctx.options.requireSignedUrls;
  if (typeof requireSignedUrls === 'boolean') body.requireSignedURLs = requireSignedUrls;
  const allowedOrigins = ctx.options.allowedOrigins;
  if (Array.isArray(allowedOrigins)) body.allowedOrigins = allowedOrigins;
  const watermark = asRecord(ctx.options.watermark);
  if (watermark) body.watermark = watermark;
  const thumbnailTimestampPct = Number(ctx.options.thumbnailTimestampPct);
  if (Number.isFinite(thumbnailTimestampPct)) body.thumbnailTimestampPct = thumbnailTimestampPct;

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/direct_upload`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: ['Cloudflare Stream: created direct-upload URL'],
  };
}

registerForgeBlock({
  id: 'forge_cloudflare_stream',
  name: 'Cloudflare Stream',
  description: 'Create a Cloudflare Stream direct-upload URL.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'cloudflare' as never },
  actions: [
    {
      id: 'create_video_upload',
      label: 'Create direct-upload URL',
      description: 'POST /client/v4/accounts/{account_id}/stream/direct_upload.',
      fields: [
        { id: 'accountId',            label: 'Account id (overrides credential)', type: 'text' },
        { id: 'maxDurationSeconds',   label: 'Max duration (seconds)', type: 'number' },
        { id: 'meta',                 label: 'Metadata (JSON object)', type: 'json' },
        { id: 'requireSignedUrls',    label: 'Require signed URLs', type: 'toggle' },
        { id: 'allowedOrigins',       label: 'Allowed origins (JSON array)', type: 'json' },
        { id: 'watermark',            label: 'Watermark (JSON, with uid)', type: 'json' },
        { id: 'thumbnailTimestampPct', label: 'Thumbnail timestamp pct (0.0–1.0)', type: 'number' },
        { id: 'outputVariable',       label: 'Save response to variable', type: 'text' },
      ],
      run: cloudflareStreamCreateUpload,
    },
  ],
} satisfies ForgeBlock);

/* ── 18. Replicate Predictions — create prediction ────────────────────── */

async function replicateCreatePrediction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Replicate: select a credential (api token)');

  const version = str(ctx.options.version);
  const input = asRecord(ctx.options.input);
  if (!version) throw new Error('Replicate: version (model version hash) is required');
  if (!input) throw new Error('Replicate: input (JSON object) is required');

  const body: Record<string, unknown> = { version, input };
  const webhook = str(ctx.options.webhook);
  if (webhook) body.webhook = webhook;
  const webhookEventsFilter = ctx.options.webhookEventsFilter;
  if (Array.isArray(webhookEventsFilter)) body.webhook_events_filter = webhookEventsFilter;

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.replicate.com/v1/predictions',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Replicate: created prediction for version ${version.slice(0, 12)}…`],
  };
}

registerForgeBlock({
  id: 'forge_replicate_predictions',
  name: 'Replicate Predictions',
  description: 'Create a Replicate model prediction (async).',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'replicate' as never },
  actions: [
    {
      id: 'create_prediction',
      label: 'Create prediction',
      description: 'POST https://api.replicate.com/v1/predictions (Token auth).',
      fields: [
        { id: 'version',              label: 'Model version (sha256 hash)', type: 'text', required: true },
        { id: 'input',                label: 'Input (JSON object)', type: 'json', required: true },
        { id: 'webhook',              label: 'Webhook URL (optional)', type: 'text' },
        { id: 'webhookEventsFilter',  label: 'Webhook events filter (JSON array)', type: 'json' },
        { id: 'outputVariable',       label: 'Save response to variable', type: 'text' },
      ],
      run: replicateCreatePrediction,
    },
  ],
} satisfies ForgeBlock);

/* ── 19. AssemblyAI — transcribe ──────────────────────────────────────── */

async function assemblyAiTranscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('AssemblyAI: select a credential (api key)');

  const audioUrl = str(ctx.options.audioUrl);
  if (!audioUrl) throw new Error('AssemblyAI: audioUrl is required');

  const body: Record<string, unknown> = { audio_url: audioUrl };
  const languageCode = str(ctx.options.languageCode);
  if (languageCode) body.language_code = languageCode;
  const speakerLabels = ctx.options.speakerLabels;
  if (typeof speakerLabels === 'boolean') body.speaker_labels = speakerLabels;
  const punctuate = ctx.options.punctuate;
  if (typeof punctuate === 'boolean') body.punctuate = punctuate;
  const formatText = ctx.options.formatText;
  if (typeof formatText === 'boolean') body.format_text = formatText;
  const webhookUrl = str(ctx.options.webhookUrl);
  if (webhookUrl) body.webhook_url = webhookUrl;
  const extra = asRecord(ctx.options.extra);
  if (extra) Object.assign(body, extra);

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.assemblyai.com/v2/transcript',
    headers: {
      Authorization: String(token),
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`AssemblyAI: queued transcript for ${audioUrl}`],
  };
}

registerForgeBlock({
  id: 'forge_assemblyai',
  name: 'AssemblyAI',
  description: 'Queue an AssemblyAI transcription job for an audio URL.',
  iconName: 'LuAudioLines',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'assemblyai' as never },
  actions: [
    {
      id: 'transcribe',
      label: 'Transcribe audio URL',
      description: 'POST https://api.assemblyai.com/v2/transcript.',
      fields: [
        { id: 'audioUrl',      label: 'Audio URL', type: 'text', required: true },
        { id: 'languageCode',  label: 'Language code (e.g. en_us)', type: 'text' },
        { id: 'speakerLabels', label: 'Speaker labels (diarization)', type: 'toggle' },
        { id: 'punctuate',     label: 'Punctuate', type: 'toggle' },
        { id: 'formatText',    label: 'Format text', type: 'toggle' },
        { id: 'webhookUrl',    label: 'Webhook URL (optional)', type: 'text' },
        { id: 'extra',         label: 'Extra fields (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: assemblyAiTranscribe,
    },
  ],
} satisfies ForgeBlock);

/* ── 20. Deepgram — transcribe URL ────────────────────────────────────── */

async function deepgramTranscribeUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('Deepgram: select a credential (api key)');

  const audioUrl = str(ctx.options.audioUrl);
  if (!audioUrl) throw new Error('Deepgram: audioUrl is required');

  const params = new URLSearchParams();
  const model = str(ctx.options.model);
  if (model) params.set('model', model);
  const language = str(ctx.options.language);
  if (language) params.set('language', language);
  const tier = str(ctx.options.tier);
  if (tier) params.set('tier', tier);
  const punctuate = ctx.options.punctuate;
  if (typeof punctuate === 'boolean') params.set('punctuate', String(punctuate));
  const diarize = ctx.options.diarize;
  if (typeof diarize === 'boolean') params.set('diarize', String(diarize));
  const smartFormat = ctx.options.smartFormat;
  if (typeof smartFormat === 'boolean') params.set('smart_format', String(smartFormat));
  const detectLanguage = ctx.options.detectLanguage;
  if (typeof detectLanguage === 'boolean') params.set('detect_language', String(detectLanguage));
  const callback = str(ctx.options.callback);
  if (callback) params.set('callback', callback);
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.deepgram.com/v1/listen${qs ? `?${qs}` : ''}`,
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: { url: audioUrl },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Deepgram: transcribed ${audioUrl}`],
  };
}

registerForgeBlock({
  id: 'forge_deepgram',
  name: 'Deepgram',
  description: 'Transcribe an audio URL via Deepgram /v1/listen.',
  iconName: 'LuMic',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'deepgram' as never },
  actions: [
    {
      id: 'transcribe_url',
      label: 'Transcribe URL',
      description: 'POST https://api.deepgram.com/v1/listen (Token auth).',
      fields: [
        { id: 'audioUrl',       label: 'Audio URL', type: 'text', required: true },
        { id: 'model',          label: 'Model (nova-2 / nova / enhanced / …)', type: 'text' },
        { id: 'language',       label: 'Language (en, es, multi, …)', type: 'text' },
        { id: 'tier',           label: 'Tier (nova / enhanced / base)', type: 'text' },
        { id: 'punctuate',      label: 'Punctuate', type: 'toggle' },
        { id: 'diarize',        label: 'Diarize (speaker tags)', type: 'toggle' },
        { id: 'smartFormat',    label: 'Smart format', type: 'toggle' },
        { id: 'detectLanguage', label: 'Detect language', type: 'toggle' },
        { id: 'callback',       label: 'Callback URL (async, optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: deepgramTranscribeUrl,
    },
  ],
} satisfies ForgeBlock);

/* ── public id list ───────────────────────────────────────────────────── */

export const STEP_PLUS_PARITY4_BLOCK_IDS = [
  'forge_mux_video',
  'forge_stream_chat',
  'forge_pusher',
  'forge_ably',
  'forge_crisp',
  'forge_front',
  'forge_helpscout',
  'forge_hopin',
  'forge_tally_ext',
  'forge_typeform_ext',
  'forge_algolia',
  'forge_sendbird',
  'forge_customer_io_ext',
  'forge_persona',
  'forge_stripe_identity',
  'forge_mux_live',
  'forge_cloudflare_stream',
  'forge_replicate_predictions',
  'forge_assemblyai',
  'forge_deepgram',
] as const;
