/**
 * Forge block: Drift
 *
 * Source: n8n-master/packages/nodes-base/nodes/Drift/Drift.node.ts
 * Credential type: 'drift' — fields: { accessToken }
 *
 * Operations (subset):
 *   - contact.get             GET  /contacts/{id}
 *   - contact.upsert          POST /contacts (creates/updates by email)
 *   - conversation.list       GET  /conversations
 *
 * Deferred: contact list/delete, message send, conversation status updates.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://driftapi.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Drift', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('Drift: credential is missing `accessToken` field');
  return { Authorization: `Bearer ${token}` };
}

async function driftApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Drift',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Drift: attributes must be a JSON object');
}

// ── Actions ────────────────────────────────────────────────────────────────

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Drift: contactId is required');
  const data = await driftApi(ctx, 'GET', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Drift contact get → ${id}`] };
}

async function contactUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Drift: email is required');

  const attributes: Record<string, unknown> = { email, ...parseJsonObject(ctx.options.attributes) };
  const name = asString(ctx.options.name);
  const phone = asString(ctx.options.phone);
  if (name) attributes.name = name;
  if (phone) attributes.phone = phone;

  const data = (await driftApi(ctx, 'POST', '/contacts', { attributes })) as
    | { data?: { id?: number } }
    | null;
  return {
    outputs: { contact: data, id: data?.data?.id ?? null },
    logs: [`Drift contact upsert → ${data?.data?.id ?? '?'}`],
  };
}

async function conversationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asString(ctx.options.limit) || '50';
  const qs = new URLSearchParams({ limit });
  const status = asString(ctx.options.status);
  if (status) qs.set('statusId', status);
  const data = await driftApi(ctx, 'GET', `/conversations/list?${qs.toString()}`);
  return { outputs: { result: data }, logs: ['Drift conversation list'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_drift',
  name: 'Drift',
  description: 'Manage Drift contacts and list conversations.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'drift' },
  actions: [
    {
      id: 'contact_get',
      label: 'Get contact',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_upsert',
      label: 'Create or update contact',
      description: 'Drift upserts on email.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'attributes', label: 'Extra attributes (JSON)', type: 'json' },
      ],
      run: contactUpsert,
    },
    {
      id: 'conversation_list',
      label: 'List conversations',
      fields: [
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
        { id: 'status', label: 'Status ID', type: 'text' },
      ],
      run: conversationList,
    },
  ],
};

registerForgeBlock(block);
export default block;
