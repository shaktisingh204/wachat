/**
 * Forge block: Gmail
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Gmail/Gmail.node.ts (+ v2)
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - message.send    POST /gmail/v1/users/me/messages/send  (RFC 822 body)
 *   - message.list    GET  /gmail/v1/users/me/messages
 *   - message.get     GET  /gmail/v1/users/me/messages/{id}
 *   - label.list      GET  /gmail/v1/users/me/labels
 *   - draft.create    POST /gmail/v1/users/me/drafts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SERVICE = 'Gmail';
const CACHE = 'google_gmail';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

function base64UrlEncode(s: string): string {
  // Node has Buffer in the engine runtime; fall back to btoa otherwise.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis;
  return g.btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRfc822({ to, subject, body, from, cc, bcc }: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  cc?: string;
  bcc?: string;
}): string {
  const lines: string[] = [];
  if (from) lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/html; charset=UTF-8');
  lines.push('');
  lines.push(body);
  return lines.join('\r\n');
}

// ── Actions ────────────────────────────────────────────────────────────────

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const to = asString(ctx.options.to);
  const subject = asString(ctx.options.subject);
  const body = asString(ctx.options.body);
  if (!to) throw new Error(`${SERVICE}: to is required`);
  if (!subject) throw new Error(`${SERVICE}: subject is required`);
  const raw = base64UrlEncode(
    buildRfc822({
      to,
      subject,
      body,
      from: asString(ctx.options.from) || undefined,
      cc: asString(ctx.options.cc) || undefined,
      bcc: asString(ctx.options.bcc) || undefined,
    }),
  );
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { raw },
  });
  return { outputs: { result: res.data }, logs: [`Gmail send → ${to}`] };
}

async function messageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const params = new URLSearchParams();
  const q = asString(ctx.options.q);
  const maxResults = asString(ctx.options.maxResults);
  const pageToken = asString(ctx.options.pageToken);
  const labelIds = asString(ctx.options.labelIds);
  if (q) params.set('q', q);
  if (maxResults) params.set('maxResults', maxResults);
  if (pageToken) params.set('pageToken', pageToken);
  if (labelIds) for (const id of labelIds.split(',').map((s) => s.trim()).filter(Boolean)) params.append('labelIds', id);
  const qs = params.toString();
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Gmail message list'] };
}

async function messageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const id = asString(ctx.options.id);
  if (!id) throw new Error(`${SERVICE}: id is required`);
  const format = asString(ctx.options.format) || 'full';
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=${encodeURIComponent(format)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`Gmail message get → ${id}`] };
}

async function labelList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Gmail label list'] };
}

async function draftCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const to = asString(ctx.options.to);
  const subject = asString(ctx.options.subject);
  const body = asString(ctx.options.body);
  if (!to) throw new Error(`${SERVICE}: to is required`);
  if (!subject) throw new Error(`${SERVICE}: subject is required`);
  const raw = base64UrlEncode(
    buildRfc822({
      to,
      subject,
      body,
      from: asString(ctx.options.from) || undefined,
      cc: asString(ctx.options.cc) || undefined,
      bcc: asString(ctx.options.bcc) || undefined,
    }),
  );
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { message: { raw } },
  });
  return { outputs: { result: res.data }, logs: [`Gmail draft create → ${to}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_gmail',
  name: 'Gmail',
  description: 'Send messages, list/get messages, list labels and create drafts in Gmail.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'message_send',
      label: 'Send message',
      description: 'Send an HTML email via Gmail.',
      fields: [
        ...authFields,
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'body', label: 'Body (HTML)', type: 'textarea' },
        { id: 'from', label: 'From', type: 'text' },
        { id: 'cc', label: 'Cc', type: 'text' },
        { id: 'bcc', label: 'Bcc', type: 'text' },
      ],
      run: messageSend,
    },
    {
      id: 'message_list',
      label: 'List messages',
      description: 'List messages with optional `q` and label filters.',
      fields: [
        ...authFields,
        { id: 'q', label: 'Gmail query', type: 'text', placeholder: 'is:unread from:foo@bar.com' },
        { id: 'maxResults', label: 'Max results', type: 'number' },
        { id: 'pageToken', label: 'Page token', type: 'text' },
        { id: 'labelIds', label: 'Label IDs (comma separated)', type: 'text' },
      ],
      run: messageList,
    },
    {
      id: 'message_get',
      label: 'Get message',
      description: 'Fetch a message by id.',
      fields: [
        ...authFields,
        { id: 'id', label: 'Message ID', type: 'text', required: true },
        {
          id: 'format',
          label: 'Format',
          type: 'select',
          options: [
            { label: 'full', value: 'full' },
            { label: 'metadata', value: 'metadata' },
            { label: 'minimal', value: 'minimal' },
            { label: 'raw', value: 'raw' },
          ],
          defaultValue: 'full',
        },
      ],
      run: messageGet,
    },
    {
      id: 'label_list',
      label: 'List labels',
      description: 'List Gmail labels for the authenticated user.',
      fields: [...authFields],
      run: labelList,
    },
    {
      id: 'draft_create',
      label: 'Create draft',
      description: 'Create a draft email in the user mailbox.',
      fields: [
        ...authFields,
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'body', label: 'Body (HTML)', type: 'textarea' },
        { id: 'from', label: 'From', type: 'text' },
        { id: 'cc', label: 'Cc', type: 'text' },
        { id: 'bcc', label: 'Bcc', type: 'text' },
      ],
      run: draftCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
