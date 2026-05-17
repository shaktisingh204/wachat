/**
 * Step n8n-real-executors — ten net-new forge blocks with REAL working
 * executors that supersede stubbed legacy n8n ports. Each block ships its
 * primary action (the 80/20 cut); broader API surface is reachable via the
 * generic HTTP block.
 *
 *   1.  Google Drive      — list_files
 *   2.  Google Calendar   — create_event
 *   3.  Gmail             — send_message
 *   4.  Dropbox           — list_folder
 *   5.  GitHub Search     — search_issues
 *   6.  YouTube Data      — list_videos
 *   7.  Telegram Bot      — send_message
 *   8.  Webflow CMS       — create_item
 *   9.  Discord Webhook   — post_message
 *   10. Hugging Face      — text_generation
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

/** Base64url-encode a UTF-8 string (RFC 4648 §5) — used by Gmail send. */
function base64UrlEncodeUtf8(input: string): string {
  const b64 = Buffer.from(input, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ── 1. Google Drive — list files ─────────────────────────────────────── */

async function googleDriveListFiles(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.oauthAccessToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Google Drive: select a credential (OAuth access token)');

  const params = new URLSearchParams();
  const q = str(ctx.options.query);
  if (q) params.set('q', q);
  const pageSize = Number(ctx.options.pageSize);
  if (Number.isFinite(pageSize) && pageSize > 0) {
    params.set('pageSize', String(Math.min(1000, Math.max(1, Math.round(pageSize)))));
  }
  const pageToken = str(ctx.options.pageToken);
  if (pageToken) params.set('pageToken', pageToken);
  const fields = str(ctx.options.fields);
  if (fields) params.set('fields', fields);
  const orderBy = str(ctx.options.orderBy);
  if (orderBy) params.set('orderBy', orderBy);
  const corpora = str(ctx.options.corpora);
  if (corpora) params.set('corpora', corpora);
  const driveId = str(ctx.options.driveId);
  if (driveId) {
    params.set('driveId', driveId);
    params.set('supportsAllDrives', 'true');
    params.set('includeItemsFromAllDrives', 'true');
  }
  const spaces = str(ctx.options.spaces);
  if (spaces) params.set('spaces', spaces);
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'GET',
    url: `https://www.googleapis.com/drive/v3/files${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Google Drive: listed files${q ? ` (q="${q.slice(0, 60)}")` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_google_drive',
  name: 'Google Drive',
  description: 'List files from Google Drive via the v3 Files API.',
  iconName: 'LuHardDrive',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'google_drive' },
  actions: [
    {
      id: 'list_files',
      label: 'List files',
      description: 'GET https://www.googleapis.com/drive/v3/files (OAuth bearer).',
      fields: [
        { id: 'query',     label: 'Query (Drive search syntax, e.g. mimeType="application/pdf")', type: 'text' },
        { id: 'pageSize',  label: 'Page size (1–1000)', type: 'number' },
        { id: 'pageToken', label: 'Page token (pagination)', type: 'text' },
        { id: 'fields',    label: 'Fields (partial response selector)', type: 'text', placeholder: 'files(id,name,mimeType),nextPageToken' },
        { id: 'orderBy',   label: 'Order by (e.g. modifiedTime desc)', type: 'text' },
        { id: 'corpora',   label: 'Corpora (user / drive / allDrives)', type: 'text' },
        { id: 'driveId',   label: 'Drive ID (for shared drive)', type: 'text' },
        { id: 'spaces',    label: 'Spaces (drive / appDataFolder)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: googleDriveListFiles,
    },
  ],
} satisfies ForgeBlock);

/* ── 2. Google Calendar — create event ────────────────────────────────── */

async function googleCalendarCreateEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.oauthAccessToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Google Calendar: select a credential (OAuth access token)');

  const calendarId = str(ctx.options.calendarId) || 'primary';
  const summary = str(ctx.options.summary);
  if (!summary) throw new Error('Google Calendar: summary is required');

  const startIso = str(ctx.options.start);
  const endIso = str(ctx.options.end);
  if (!startIso) throw new Error('Google Calendar: start (ISO-8601) is required');
  if (!endIso) throw new Error('Google Calendar: end (ISO-8601) is required');

  const timeZone = str(ctx.options.timeZone);
  const startObj: Record<string, unknown> = { dateTime: startIso };
  const endObj: Record<string, unknown> = { dateTime: endIso };
  if (timeZone) {
    startObj.timeZone = timeZone;
    endObj.timeZone = timeZone;
  }

  const body: Record<string, unknown> = {
    summary,
    start: startObj,
    end: endObj,
  };
  const description = str(ctx.options.description);
  if (description) body.description = description;
  const location = str(ctx.options.location);
  if (location) body.location = location;

  const attendeesRaw = ctx.options.attendees;
  if (Array.isArray(attendeesRaw)) {
    body.attendees = attendeesRaw.map((a) =>
      typeof a === 'string' ? { email: a } : a,
    );
  } else if (typeof attendeesRaw === 'string' && attendeesRaw.trim()) {
    body.attendees = attendeesRaw
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map((email) => ({ email }));
  }
  const extra = asRecord(ctx.options.extra);
  if (extra) Object.assign(body, extra);

  const params = new URLSearchParams();
  if (ctx.options.sendUpdates) params.set('sendUpdates', str(ctx.options.sendUpdates));
  if (ctx.options.conferenceDataVersion != null) {
    params.set('conferenceDataVersion', String(Number(ctx.options.conferenceDataVersion) || 0));
  }
  const qs = params.toString();

  const data = await jsonRequest({
    method: 'POST',
    url:
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
      (qs ? `?${qs}` : ''),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Google Calendar: created event "${summary}" on ${calendarId}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_google_calendar',
  name: 'Google Calendar',
  description: 'Create a Google Calendar event via the v3 Calendar API.',
  iconName: 'LuCalendar',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'google_calendar' as never },
  actions: [
    {
      id: 'create_event',
      label: 'Create event',
      description: 'POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events.',
      fields: [
        { id: 'calendarId',  label: 'Calendar ID (default "primary")', type: 'text' },
        { id: 'summary',     label: 'Title / summary', type: 'text', required: true },
        { id: 'start',       label: 'Start (ISO-8601 datetime)', type: 'text', required: true, placeholder: '2026-06-01T09:00:00-07:00' },
        { id: 'end',         label: 'End (ISO-8601 datetime)', type: 'text', required: true, placeholder: '2026-06-01T10:00:00-07:00' },
        { id: 'timeZone',    label: 'Time zone (IANA, e.g. America/Los_Angeles)', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'location',    label: 'Location', type: 'text' },
        { id: 'attendees',   label: 'Attendees (comma-separated emails or JSON array)', type: 'text' },
        { id: 'sendUpdates', label: 'Send updates (all / externalOnly / none)', type: 'text' },
        { id: 'conferenceDataVersion', label: 'Conference data version (0 or 1)', type: 'number' },
        { id: 'extra',       label: 'Extra fields (JSON object, merged into body)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: googleCalendarCreateEvent,
    },
  ],
} satisfies ForgeBlock);

/* ── 3. Gmail — send message ──────────────────────────────────────────── */

async function gmailSendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.oauthAccessToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Gmail: select a credential (OAuth access token)');

  const to = str(ctx.options.to);
  if (!to) throw new Error('Gmail: "to" is required');
  const subject = str(ctx.options.subject);
  const bodyText = str(ctx.options.body);
  const from = str(ctx.options.from);
  const cc = str(ctx.options.cc);
  const bcc = str(ctx.options.bcc);
  const replyTo = str(ctx.options.replyTo);
  const isHtml = ctx.options.html === true || str(ctx.options.contentType).toLowerCase() === 'html';

  const headerLines: string[] = [`To: ${to}`];
  if (from) headerLines.push(`From: ${from}`);
  if (cc) headerLines.push(`Cc: ${cc}`);
  if (bcc) headerLines.push(`Bcc: ${bcc}`);
  if (replyTo) headerLines.push(`Reply-To: ${replyTo}`);
  if (subject) headerLines.push(`Subject: ${subject}`);
  headerLines.push('MIME-Version: 1.0');
  headerLines.push(
    isHtml
      ? 'Content-Type: text/html; charset="UTF-8"'
      : 'Content-Type: text/plain; charset="UTF-8"',
  );

  const rfc822 = headerLines.join('\r\n') + '\r\n\r\n' + bodyText;
  const raw = base64UrlEncodeUtf8(rfc822);

  const body: Record<string, unknown> = { raw };
  const threadId = str(ctx.options.threadId);
  if (threadId) body.threadId = threadId;

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Gmail: sent message to ${to}${subject ? ` ("${subject}")` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_gmail',
  name: 'Gmail',
  description: 'Send an email via the Gmail v1 API (users.messages.send).',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'gmail' as never },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send (base64url RFC 822).',
      fields: [
        { id: 'to',          label: 'To (comma-separated)', type: 'text', required: true },
        { id: 'subject',     label: 'Subject', type: 'text' },
        { id: 'body',        label: 'Body', type: 'textarea' },
        { id: 'html',        label: 'Send as HTML', type: 'toggle' },
        { id: 'from',        label: 'From (optional override)', type: 'text' },
        { id: 'cc',          label: 'Cc (comma-separated)', type: 'text' },
        { id: 'bcc',         label: 'Bcc (comma-separated)', type: 'text' },
        { id: 'replyTo',     label: 'Reply-To', type: 'text' },
        { id: 'threadId',    label: 'Thread ID (reply within thread)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: gmailSendMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 4. Dropbox — list folder ─────────────────────────────────────────── */

async function dropboxListFolder(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.oauthAccessToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Dropbox: select a credential (OAuth access token)');

  const pathRaw = str(ctx.options.path);
  // Dropbox: root is "" (empty string), NOT "/".
  const path = pathRaw === '/' ? '' : pathRaw;

  const body: Record<string, unknown> = { path };
  if (ctx.options.recursive === true) body.recursive = true;
  if (ctx.options.includeMediaInfo === true) body.include_media_info = true;
  if (ctx.options.includeDeleted === true) body.include_deleted = true;
  if (ctx.options.includeNonDownloadableFiles === false) {
    body.include_non_downloadable_files = false;
  }
  const limit = Number(ctx.options.limit);
  if (Number.isFinite(limit) && limit > 0) {
    body.limit = Math.min(2000, Math.max(1, Math.round(limit)));
  }

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.dropboxapi.com/2/files/list_folder',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Dropbox: listed folder "${path || '(root)'}"`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_dropbox',
  name: 'Dropbox',
  description: 'List the contents of a Dropbox folder via the v2 API.',
  iconName: 'LuBox',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'dropbox' },
  actions: [
    {
      id: 'list_folder',
      label: 'List folder',
      description: 'POST https://api.dropboxapi.com/2/files/list_folder (Bearer token).',
      fields: [
        { id: 'path',       label: 'Path (use "" or "/" for root)', type: 'text' },
        { id: 'recursive',  label: 'Recursive', type: 'toggle' },
        { id: 'includeMediaInfo', label: 'Include media info', type: 'toggle' },
        { id: 'includeDeleted',   label: 'Include deleted entries', type: 'toggle' },
        { id: 'includeNonDownloadableFiles', label: 'Include non-downloadable files (default: true)', type: 'toggle' },
        { id: 'limit',      label: 'Limit (1–2000)', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: dropboxListFolder,
    },
  ],
} satisfies ForgeBlock);

/* ── 5. GitHub Search — search issues ─────────────────────────────────── */

async function githubSearchIssues(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey ??
    ctx.credential?.personalAccessToken;
  if (!token) throw new Error('GitHub Search: select a credential (Bearer token)');

  const q = str(ctx.options.query);
  if (!q) throw new Error('GitHub Search: query is required (e.g. "is:open label:bug repo:owner/name")');

  const params = new URLSearchParams();
  params.set('q', q);
  const sort = str(ctx.options.sort);
  if (sort) params.set('sort', sort);
  const order = str(ctx.options.order);
  if (order) params.set('order', order);
  const perPage = Number(ctx.options.perPage);
  if (Number.isFinite(perPage) && perPage > 0) {
    params.set('per_page', String(Math.min(100, Math.max(1, Math.round(perPage)))));
  }
  const page = Number(ctx.options.page);
  if (Number.isFinite(page) && page > 0) params.set('page', String(Math.round(page)));

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.github.com/search/issues?${params.toString()}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SabFlow-Forge',
    },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`GitHub Search: issues query="${q.slice(0, 80)}"`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_github_search',
  name: 'GitHub Issues Search',
  description: 'Search GitHub issues and pull requests via the Search API.',
  iconName: 'LuGithub',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'github' },
  actions: [
    {
      id: 'search_issues',
      label: 'Search issues',
      description: 'GET https://api.github.com/search/issues?q=… (Bearer token).',
      fields: [
        { id: 'query',   label: 'Search query (GitHub search syntax)', type: 'text', required: true, placeholder: 'is:open label:bug repo:owner/name' },
        { id: 'sort',    label: 'Sort (comments / reactions / created / updated)', type: 'text' },
        { id: 'order',   label: 'Order (asc / desc)', type: 'text' },
        { id: 'perPage', label: 'Per page (1–100)', type: 'number' },
        { id: 'page',    label: 'Page (1-based)', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: githubSearchIssues,
    },
  ],
} satisfies ForgeBlock);

/* ── 6. YouTube Data — list videos ────────────────────────────────────── */

async function youtubeListVideos(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.oauthAccessToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('YouTube: select a credential (OAuth access token)');

  const idRaw = ctx.options.id;
  const id = Array.isArray(idRaw) ? idRaw.map(str).join(',') : str(idRaw);
  if (!id) throw new Error('YouTube: id (video ID, comma-separated) is required');

  const part = str(ctx.options.part) || 'snippet,statistics';
  const params = new URLSearchParams();
  params.set('part', part);
  params.set('id', id);
  const maxResults = Number(ctx.options.maxResults);
  if (Number.isFinite(maxResults) && maxResults > 0) {
    params.set('maxResults', String(Math.min(50, Math.max(1, Math.round(maxResults)))));
  }
  const hl = str(ctx.options.hl);
  if (hl) params.set('hl', hl);
  const regionCode = str(ctx.options.regionCode);
  if (regionCode) params.set('regionCode', regionCode);

  const data = await jsonRequest({
    method: 'GET',
    url: `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`YouTube: fetched videos id=${id.slice(0, 80)}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_youtube',
  name: 'YouTube Data',
  description: 'Fetch YouTube video metadata via the v3 Data API.',
  iconName: 'LuYoutube',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'youtube' as never },
  actions: [
    {
      id: 'list_videos',
      label: 'List videos',
      description: 'GET https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=…',
      fields: [
        { id: 'id',         label: 'Video ID(s), comma-separated', type: 'text', required: true },
        { id: 'part',       label: 'Parts (default: snippet,statistics)', type: 'text' },
        { id: 'maxResults', label: 'Max results (1–50)', type: 'number' },
        { id: 'hl',         label: 'Language (BCP-47, optional)', type: 'text' },
        { id: 'regionCode', label: 'Region code (ISO 3166-1 alpha-2, optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: youtubeListVideos,
    },
  ],
} satisfies ForgeBlock);

/* ── 7. Telegram Bot — send message ───────────────────────────────────── */

async function telegramSendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.botToken ?? ctx.credential?.accessToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey ?? str(ctx.options.botToken);
  if (!token) throw new Error('Telegram: select a credential (bot token)');

  const chatIdRaw = ctx.options.chatId;
  const chatId =
    typeof chatIdRaw === 'number' ? chatIdRaw : str(chatIdRaw);
  if (chatId === '' || chatId === 0) throw new Error('Telegram: chatId is required');

  const text = str(ctx.options.text);
  if (!text) throw new Error('Telegram: text is required');

  const body: Record<string, unknown> = { chat_id: chatId, text };
  const parseMode = str(ctx.options.parseMode);
  if (parseMode) body.parse_mode = parseMode;
  if (ctx.options.disableNotification === true) body.disable_notification = true;
  if (ctx.options.disableWebPagePreview === true) body.disable_web_page_preview = true;
  if (ctx.options.protectContent === true) body.protect_content = true;
  const replyToMessageId = Number(ctx.options.replyToMessageId);
  if (Number.isFinite(replyToMessageId) && replyToMessageId > 0) {
    body.reply_to_message_id = Math.round(replyToMessageId);
  }
  const messageThreadId = Number(ctx.options.messageThreadId);
  if (Number.isFinite(messageThreadId) && messageThreadId > 0) {
    body.message_thread_id = Math.round(messageThreadId);
  }
  const replyMarkup = asRecord(ctx.options.replyMarkup);
  if (replyMarkup) body.reply_markup = replyMarkup;

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.telegram.org/bot${encodeURIComponent(String(token))}/sendMessage`,
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Telegram: sent message to chat ${chatId}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_telegram',
  name: 'Telegram Bot',
  description: 'Send a Telegram chat message via the Bot API.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'telegram' },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'POST https://api.telegram.org/bot{token}/sendMessage.',
      fields: [
        { id: 'chatId',         label: 'Chat ID (numeric or @username)', type: 'text', required: true },
        { id: 'text',           label: 'Message text', type: 'textarea', required: true },
        { id: 'parseMode',      label: 'Parse mode (Markdown / MarkdownV2 / HTML)', type: 'text' },
        { id: 'disableNotification', label: 'Disable notification', type: 'toggle' },
        { id: 'disableWebPagePreview', label: 'Disable web page preview', type: 'toggle' },
        { id: 'protectContent', label: 'Protect content (no forwarding)', type: 'toggle' },
        { id: 'replyToMessageId', label: 'Reply to message ID', type: 'number' },
        { id: 'messageThreadId',  label: 'Message thread ID (forum topic)', type: 'number' },
        { id: 'replyMarkup',    label: 'Reply markup (JSON, inline keyboard etc.)', type: 'json' },
        { id: 'botToken',       label: 'Bot token (overrides credential)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: telegramSendMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 8. Webflow CMS — create item ─────────────────────────────────────── */

async function webflowCreateItem(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.apiToken ??
    ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Webflow: select a credential (Bearer token)');

  const collectionId = str(ctx.options.collectionId);
  if (!collectionId) throw new Error('Webflow: collectionId is required');

  const fieldData =
    asRecord(ctx.options.fieldData) ??
    asRecord(ctx.options.fields) ??
    asRecord(ctx.options.item);
  if (!fieldData) {
    throw new Error('Webflow: fieldData (JSON object) is required');
  }

  const body: Record<string, unknown> = { fieldData };
  if (ctx.options.isArchived === true) body.isArchived = true;
  if (ctx.options.isDraft === true) body.isDraft = true;
  const cmsLocaleId = str(ctx.options.cmsLocaleId);
  if (cmsLocaleId) body.cmsLocaleId = cmsLocaleId;

  const live = ctx.options.live === true;
  const url =
    `https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}/items` +
    (live ? '/live' : '');

  const data = await jsonRequest({
    method: 'POST',
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept-version': '2.0.0',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Webflow: created CMS item in collection ${collectionId}${live ? ' (live)' : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_webflow',
  name: 'Webflow CMS',
  description: 'Create a CMS item in a Webflow collection via the v2 API.',
  iconName: 'LuLayoutGrid',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'webflow' },
  actions: [
    {
      id: 'create_item',
      label: 'Create CMS item',
      description: 'POST https://api.webflow.com/v2/collections/{collection_id}/items.',
      fields: [
        { id: 'collectionId', label: 'Collection ID', type: 'text', required: true },
        { id: 'fieldData',    label: 'Field data (JSON: { name, slug, … })', type: 'json', required: true },
        { id: 'cmsLocaleId',  label: 'CMS locale ID (optional)', type: 'text' },
        { id: 'isDraft',      label: 'Save as draft', type: 'toggle' },
        { id: 'isArchived',   label: 'Create as archived', type: 'toggle' },
        { id: 'live',         label: 'Publish live (use /items/live endpoint)', type: 'toggle' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: webflowCreateItem,
    },
  ],
} satisfies ForgeBlock);

/* ── 9. Discord Webhook — post message ────────────────────────────────── */

async function discordWebhookPostMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookUrl = str(ctx.options.webhookUrl) || str(ctx.credential?.webhookUrl);
  if (!webhookUrl) throw new Error('Discord Webhook: webhookUrl is required');
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(webhookUrl)) {
    throw new Error('Discord Webhook: webhookUrl must be a discord.com webhook URL');
  }

  const content = str(ctx.options.content);
  const username = str(ctx.options.username);
  const avatarUrl = str(ctx.options.avatarUrl);
  const tts = ctx.options.tts === true;
  const embedsRaw = ctx.options.embeds;
  const allowedMentions = asRecord(ctx.options.allowedMentions);

  let embeds: unknown[] | undefined;
  if (Array.isArray(embedsRaw)) {
    embeds = embedsRaw;
  } else if (embedsRaw && typeof embedsRaw === 'object') {
    embeds = [embedsRaw];
  } else if (typeof embedsRaw === 'string' && embedsRaw.trim()) {
    const parsed = safeJsonParse(embedsRaw);
    if (Array.isArray(parsed)) embeds = parsed;
    else if (parsed && typeof parsed === 'object') embeds = [parsed];
  }

  if (!content && !embeds?.length) {
    throw new Error('Discord Webhook: either "content" or "embeds" is required');
  }

  const body: Record<string, unknown> = {};
  if (content) body.content = content;
  if (username) body.username = username;
  if (avatarUrl) body.avatar_url = avatarUrl;
  if (tts) body.tts = true;
  if (embeds?.length) body.embeds = embeds;
  if (allowedMentions) body.allowed_mentions = allowedMentions;
  const threadId = str(ctx.options.threadId);

  const params = new URLSearchParams();
  if (ctx.options.wait === true) params.set('wait', 'true');
  if (threadId) params.set('thread_id', threadId);
  const qs = params.toString();
  const url = qs ? `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}${qs}` : webhookUrl;

  const data = await jsonRequest({
    method: 'POST',
    url,
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Discord webhook: posted message${content ? ` (${content.length} chars)` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_discord_webhook',
  name: 'Discord Webhook',
  description: 'Post a message to a Discord channel via a webhook URL.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'post_message',
      label: 'Post message',
      description: 'POST {webhook_url} — the URL itself carries the token, no auth header.',
      fields: [
        { id: 'webhookUrl',      label: 'Webhook URL (https://discord.com/api/webhooks/…)', type: 'text', required: true },
        { id: 'content',         label: 'Message content (≤2000 chars)', type: 'textarea' },
        { id: 'username',        label: 'Override username', type: 'text' },
        { id: 'avatarUrl',       label: 'Override avatar URL', type: 'text' },
        { id: 'tts',             label: 'Text-to-speech', type: 'toggle' },
        { id: 'embeds',          label: 'Embeds (JSON array)', type: 'json' },
        { id: 'allowedMentions', label: 'Allowed mentions (JSON object)', type: 'json' },
        { id: 'threadId',        label: 'Thread ID (post into existing thread)', type: 'text' },
        { id: 'wait',            label: 'Wait for confirmation (returns message)', type: 'toggle' },
        { id: 'outputVariable',  label: 'Save response to variable', type: 'text' },
      ],
      run: discordWebhookPostMessage,
    },
  ],
} satisfies ForgeBlock);

/* ── 10. Hugging Face — text generation ───────────────────────────────── */

async function huggingfaceTextGeneration(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.apiKey ?? ctx.credential?.accessToken ??
    ctx.credential?.token ?? ctx.credential?.apiToken;
  if (!token) throw new Error('Hugging Face: select a credential (API token)');

  const modelId = str(ctx.options.modelId);
  if (!modelId) throw new Error('Hugging Face: modelId is required');
  const inputs = str(ctx.options.inputs);
  if (!inputs) throw new Error('Hugging Face: inputs (prompt) is required');

  const parameters: Record<string, unknown> = {};
  const maxNewTokens = Number(ctx.options.maxNewTokens);
  if (Number.isFinite(maxNewTokens) && maxNewTokens > 0) {
    parameters.max_new_tokens = Math.round(maxNewTokens);
  }
  const temperature = Number(ctx.options.temperature);
  if (Number.isFinite(temperature) && temperature >= 0) parameters.temperature = temperature;
  const topP = Number(ctx.options.topP);
  if (Number.isFinite(topP) && topP > 0) parameters.top_p = topP;
  const topK = Number(ctx.options.topK);
  if (Number.isFinite(topK) && topK > 0) parameters.top_k = Math.round(topK);
  const repetitionPenalty = Number(ctx.options.repetitionPenalty);
  if (Number.isFinite(repetitionPenalty) && repetitionPenalty > 0) {
    parameters.repetition_penalty = repetitionPenalty;
  }
  if (ctx.options.returnFullText === false) parameters.return_full_text = false;
  if (ctx.options.doSample === true) parameters.do_sample = true;
  const stop = ctx.options.stop;
  if (Array.isArray(stop)) parameters.stop = stop.map(str).filter(Boolean);
  else if (typeof stop === 'string' && stop.trim()) {
    parameters.stop = stop.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  const extraParams = asRecord(ctx.options.parameters);
  if (extraParams) Object.assign(parameters, extraParams);

  const options: Record<string, unknown> = {};
  if (ctx.options.waitForModel === true) options.wait_for_model = true;
  if (ctx.options.useCache === false) options.use_cache = false;

  const body: Record<string, unknown> = { inputs };
  if (Object.keys(parameters).length > 0) body.parameters = parameters;
  if (Object.keys(options).length > 0) body.options = options;

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api-inference.huggingface.co/models/${modelId
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Hugging Face: ran text generation on ${modelId}`],
  };
}

registerForgeBlock({
  id: 'forge_n8n_huggingface',
  name: 'Hugging Face Inference',
  description: 'Run text generation against any Hugging Face hosted model.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'huggingface' },
  actions: [
    {
      id: 'text_generation',
      label: 'Text generation',
      description: 'POST https://api-inference.huggingface.co/models/{model_id} (Bearer token).',
      fields: [
        { id: 'modelId',           label: 'Model ID (e.g. mistralai/Mistral-7B-Instruct-v0.3)', type: 'text', required: true },
        { id: 'inputs',            label: 'Inputs (prompt)', type: 'textarea', required: true },
        { id: 'maxNewTokens',      label: 'Max new tokens', type: 'number' },
        { id: 'temperature',       label: 'Temperature', type: 'number' },
        { id: 'topP',              label: 'Top-p', type: 'number' },
        { id: 'topK',              label: 'Top-k', type: 'number' },
        { id: 'repetitionPenalty', label: 'Repetition penalty', type: 'number' },
        { id: 'doSample',          label: 'Do sample', type: 'toggle' },
        { id: 'returnFullText',    label: 'Return full text (default: true)', type: 'toggle' },
        { id: 'stop',              label: 'Stop sequences (one per line)', type: 'textarea' },
        { id: 'waitForModel',      label: 'Wait for model (cold start)', type: 'toggle' },
        { id: 'useCache',          label: 'Use cache (default: true)', type: 'toggle' },
        { id: 'parameters',        label: 'Extra parameters (JSON, merged in)', type: 'json' },
        { id: 'outputVariable',    label: 'Save response to variable', type: 'text' },
      ],
      run: huggingfaceTextGeneration,
    },
  ],
} satisfies ForgeBlock);

/* ── exports ──────────────────────────────────────────────────────────── */

export const STEP_PLUS_N8N_REAL_BLOCK_IDS = [
  'forge_n8n_google_drive',
  'forge_n8n_google_calendar',
  'forge_n8n_gmail',
  'forge_n8n_dropbox',
  'forge_n8n_github_search',
  'forge_n8n_youtube',
  'forge_n8n_telegram',
  'forge_n8n_webflow',
  'forge_n8n_discord_webhook',
  'forge_n8n_huggingface',
] as const;
