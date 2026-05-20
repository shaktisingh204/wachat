/**
 * Forge block: MailerLite (Classic v2 + new Connect v3)
 *
 * Source: n8n-master/packages/nodes-base/nodes/MailerLite/MailerLite.node.ts
 * Credential type: 'mailerlite' (apiKey, Bearer)
 *
 * Auth: `Authorization: Bearer <KEY>` against the Connect API.
 *
 * Operations covered (subscriber resource):
 *   - subscriber.create  POST   /api/subscribers
 *   - subscriber.get     GET    /api/subscribers/{email_or_id}
 *   - subscriber.getAll  GET    /api/subscribers              (cursor pagination via meta.next_cursor)
 *   - subscriber.update  PUT    /api/subscribers/{email_or_id}
 *   - subscriber.delete  DELETE /api/subscribers/{email_or_id}
 *
 * Out of scope for the first port:
 *   - Groups / segments management
 *   - Custom field LoadOptions
 *   - Automations / campaigns
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://connect.mailerlite.com/api';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('MailerLite', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  if (!apiKey) throw new Error('MailerLite: credential is missing `apiKey`');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

function parseFields(raw: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('MailerLite: fields must be valid JSON');
  }
}

async function subscriberCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('MailerLite: email is required');
  const body: Record<string, unknown> = { email };
  const fields = parseFields(asString(ctx.options.fields));
  if (fields) body.fields = fields;
  const groupsRaw = asString(ctx.options.groups);
  if (groupsRaw) body.groups = groupsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const status = asString(ctx.options.status);
  if (status) body.status = status;
  const res = await apiRequest({
    service: 'MailerLite',
    method: 'POST',
    url: `${BASE}/subscribers`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { subscriber: res.data }, logs: [`MailerLite subscriber create → ${email}`] };
}

async function subscriberGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const identifier = asString(ctx.options.identifier);
  if (!identifier) throw new Error('MailerLite: identifier (email or id) is required');
  const res = await apiRequest({
    service: 'MailerLite',
    method: 'GET',
    url: `${BASE}/subscribers/${encodeURIComponent(identifier)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { subscriber: res.data }, logs: [`MailerLite subscriber get → ${identifier}`] };
}

async function subscriberUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const identifier = asString(ctx.options.identifier);
  if (!identifier) throw new Error('MailerLite: identifier (email or id) is required');
  const body: Record<string, unknown> = {};
  const fields = parseFields(asString(ctx.options.fields));
  if (fields) body.fields = fields;
  const groupsRaw = asString(ctx.options.groups);
  if (groupsRaw) body.groups = groupsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const status = asString(ctx.options.status);
  if (status) body.status = status;
  if (Object.keys(body).length === 0) {
    throw new Error('MailerLite: at least one updatable field must be set');
  }
  const res = await apiRequest({
    service: 'MailerLite',
    method: 'PUT',
    url: `${BASE}/subscribers/${encodeURIComponent(identifier)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { subscriber: res.data }, logs: [`MailerLite subscriber update → ${identifier}`] };
}

async function subscriberGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 100;
  const status = asString(ctx.options.status);

  const subscribers = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const qs = new URLSearchParams();
      qs.set('limit', String(pageSize));
      if (cursor) qs.set('cursor', cursor);
      if (status) qs.set('filter[status]', status);
      const res = await apiRequest({
        service: 'MailerLite',
        method: 'GET',
        url: `${BASE}/subscribers?${qs.toString()}`,
        headers: authHeaders(ctx),
      });
      const body = res.data as {
        data?: unknown[];
        meta?: { next_cursor?: string | null };
        links?: { next?: string | null };
      } | null;
      const items = (body?.data ?? []) as unknown[];
      const nextCursor = body?.links?.next ? body?.meta?.next_cursor ?? undefined : undefined;
      return { items, nextCursor: nextCursor ?? undefined };
    },
  });
  return { outputs: { subscribers, count: subscribers.length }, logs: [`MailerLite subscriber list → ${subscribers.length}`] };
}

async function subscriberDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const identifier = asString(ctx.options.identifier);
  if (!identifier) throw new Error('MailerLite: identifier is required');
  await apiRequest({
    service: 'MailerLite',
    method: 'DELETE',
    url: `${BASE}/subscribers/${encodeURIComponent(identifier)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`MailerLite subscriber delete → ${identifier}`] };
}

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Unsubscribed', value: 'unsubscribed' },
  { label: 'Unconfirmed', value: 'unconfirmed' },
  { label: 'Bounced', value: 'bounced' },
  { label: 'Junk', value: 'junk' },
];

const block: ForgeBlock = {
  id: 'forge_mailerlite',
  name: 'MailerLite',
  description: 'Manage MailerLite subscribers.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mailerlite' },
  actions: [
    {
      id: 'subscriber_create',
      label: 'Create subscriber',
      description: 'Create a new MailerLite subscriber.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON e.g. {"name":"Jane"})', type: 'json' },
        { id: 'groups', label: 'Group IDs (comma separated)', type: 'text' },
        { id: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, defaultValue: 'active' },
      ],
      run: subscriberCreate,
    },
    {
      id: 'subscriber_get',
      label: 'Get subscriber',
      description: 'Fetch a subscriber by email or ID.',
      fields: [{ id: 'identifier', label: 'Email or ID', type: 'text', required: true }],
      run: subscriberGet,
    },
    {
      id: 'subscriber_update',
      label: 'Update subscriber',
      description: 'Update an existing subscriber.',
      fields: [
        { id: 'identifier', label: 'Email or ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON)', type: 'json' },
        { id: 'groups', label: 'Group IDs (comma separated)', type: 'text' },
        { id: 'status', label: 'Status', type: 'select', options: [{ label: 'Unchanged', value: '' }, ...STATUS_OPTIONS] },
      ],
      run: subscriberUpdate,
    },
    {
      id: 'subscriber_get_all',
      label: 'List subscribers (paginated)',
      description: 'Walk MailerLite Connect cursor pagination.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (limit, max 1000)', type: 'number', defaultValue: '100' },
        { id: 'status', label: 'Status filter (optional)', type: 'select', options: [{ label: 'Any', value: '' }, ...STATUS_OPTIONS] },
      ],
      run: subscriberGetAll,
    },
    {
      id: 'subscriber_delete',
      label: 'Delete subscriber',
      description: 'Delete a subscriber.',
      fields: [{ id: 'identifier', label: 'Email or ID', type: 'text', required: true }],
      run: subscriberDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
