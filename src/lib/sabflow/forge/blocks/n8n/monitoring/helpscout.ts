/**
 * Forge block: Help Scout
 *
 * Source: n8n-master/packages/nodes-base/nodes/HelpScout/HelpScout.node.ts
 * Credential type: 'helpscout' → { appId, appSecret }.
 *
 * OAuth client-credentials grant: exchange appId/appSecret for an access token
 * via POST /v2/oauth2/token. The token is cached for the current action call.
 *
 * Operations:
 *   - conversation.create   POST /v2/conversations
 *   - conversation.get      GET  /v2/conversations/{id}
 *   - conversation.list     GET  /v2/conversations
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.helpscout.net';

async function getAccessToken(ctx: ForgeActionContext): Promise<string> {
  const cred = requireCredential('Help Scout', ctx.credential);
  const appId = cred.appId ?? '';
  const appSecret = cred.appSecret ?? '';
  if (!appId || !appSecret) throw new Error('Help Scout: credential needs appId and appSecret');

  const res = await apiRequest({
    service: 'Help Scout',
    method: 'POST',
    url: `${BASE}/v2/oauth2/token`,
    json: { grant_type: 'client_credentials', client_id: appId, client_secret: appSecret },
  });
  const token = (res.data as { access_token?: string }).access_token;
  if (!token) throw new Error('Help Scout: token exchange returned no access_token');
  return token;
}

async function hsRequest(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  path: string,
  json?: unknown,
): Promise<{ data: unknown; status: number; locationId?: string }> {
  const token = await getAccessToken(ctx);
  const res = await apiRequest({
    service: 'Help Scout',
    method,
    url: `${BASE}${path.startsWith('/') ? path : `/${path}`}`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    json,
  });
  const location = res.headers.get('resource-id') ?? res.headers.get('location') ?? undefined;
  return { data: res.data, status: res.status, locationId: location ?? undefined };
}

async function conversationCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const mailboxId = asString(ctx.options.mailboxId);
  const customerEmail = asString(ctx.options.customerEmail);
  const text = asString(ctx.options.text);
  const status = asString(ctx.options.status) || 'active';
  const type = asString(ctx.options.type) || 'email';
  if (!subject) throw new Error('Help Scout: subject is required');
  if (!mailboxId) throw new Error('Help Scout: mailboxId is required');
  if (!customerEmail) throw new Error('Help Scout: customerEmail is required');
  if (!text) throw new Error('Help Scout: message text is required');

  const body: Record<string, unknown> = {
    subject,
    customer: { email: customerEmail },
    mailboxId: Number(mailboxId),
    type,
    status,
    threads: [
      {
        type: 'customer',
        customer: { email: customerEmail },
        text,
      },
    ],
  };

  const res = await hsRequest(ctx, 'POST', '/v2/conversations', body);
  return {
    outputs: { conversation: res.data, conversationId: res.locationId, status: res.status },
    logs: [`Help Scout conversation create → ${subject}`],
  };
}

async function conversationGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.conversationId);
  if (!id) throw new Error('Help Scout: conversationId is required');
  const res = await hsRequest(ctx, 'GET', `/v2/conversations/${id}`);
  return { outputs: { conversation: res.data }, logs: [`Help Scout conversation get → ${id}`] };
}

async function conversationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const qs = new URLSearchParams();
  const status = asString(ctx.options.status);
  const mailbox = asString(ctx.options.mailboxId);
  const page = asString(ctx.options.page);
  if (status) qs.set('status', status);
  if (mailbox) qs.set('mailbox', mailbox);
  if (page) qs.set('page', page);
  const path = `/v2/conversations${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await hsRequest(ctx, 'GET', path);
  return { outputs: { conversations: res.data }, logs: ['Help Scout conversation list'] };
}

const block: ForgeBlock = {
  id: 'forge_helpscout',
  name: 'Help Scout',
  description: 'Manage Help Scout conversations from a flow.',
  iconName: 'LuLifeBuoy',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'helpscout' },
  actions: [
    {
      id: 'conversation_create',
      label: 'Create conversation',
      fields: [
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'mailboxId', label: 'Mailbox ID', type: 'text', required: true },
        { id: 'customerEmail', label: 'Customer email', type: 'text', required: true },
        { id: 'text', label: 'Message body', type: 'textarea', required: true },
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          options: [
            { label: 'Email', value: 'email' },
            { label: 'Chat', value: 'chat' },
            { label: 'Phone', value: 'phone' },
          ],
        },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Pending', value: 'pending' },
            { label: 'Closed', value: 'closed' },
          ],
        },
      ],
      run: conversationCreate,
    },
    {
      id: 'conversation_get',
      label: 'Get conversation',
      fields: [{ id: 'conversationId', label: 'Conversation ID', type: 'text', required: true }],
      run: conversationGet,
    },
    {
      id: 'conversation_list',
      label: 'List conversations',
      fields: [
        { id: 'mailboxId', label: 'Mailbox ID', type: 'text' },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'Active', value: 'active' },
            { label: 'Pending', value: 'pending' },
            { label: 'Closed', value: 'closed' },
            { label: 'Spam', value: 'spam' },
            { label: 'Open', value: 'open' },
          ],
        },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: conversationList,
    },
  ],
};

registerForgeBlock(block);
export default block;
