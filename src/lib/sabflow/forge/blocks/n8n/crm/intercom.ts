/**
 * Forge block: Intercom
 *
 * Source: n8n-master/packages/nodes-base/nodes/Intercom/Intercom.node.ts
 *   (+ GenericFunctions.ts, *Description.ts)
 * Credential type: 'intercom' — fields: { accessToken }
 *   Auth: `Authorization: Bearer <accessToken>`.
 *
 * Operations covered:
 *   - user.get             GET    /users/{id}
 *   - user.upsert          POST   /users    (Intercom upserts by email/external_id)
 *   - contact.create       POST   /contacts (visitor → lead/user contact API)
 *   - lead.create          POST   /contacts (role=lead)
 *   - company.create       POST   /companies
 *   - tag.tagUsers         POST   /tags     (attach a tag to one or more users)
 *
 * Out of scope: conversations, segments, articles, notes — re-add as needed.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.intercom.io';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Intercom', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('Intercom: credential is missing `accessToken`');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function icApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Intercom',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

function parseExtra(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Intercom: extra fields must be a JSON object');
}

// ── User ───────────────────────────────────────────────────────────────────

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('Intercom: userId is required');
  const data = await icApi(ctx, 'GET', `/users/${encodeURIComponent(id)}`);
  return { outputs: { user: data }, logs: [`Intercom user get → ${id}`] };
}

async function userUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const userIdExternal = asString(ctx.options.userIdExternal);
  if (!email && !userIdExternal) {
    throw new Error('Intercom: provide either email or external user_id');
  }
  const body: Record<string, unknown> = parseExtra(ctx.options.extra);
  if (email) body.email = email;
  if (userIdExternal) body.user_id = userIdExternal;
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.phone)) body.phone = asString(ctx.options.phone);

  const data = (await icApi(ctx, 'POST', '/users', body)) as { id?: string } | null;
  return { outputs: { user: data, id: data?.id ?? null }, logs: [`Intercom user upsert → ${data?.id ?? '?'}`] };
}

// ── Contact (lead/user via /contacts endpoint) ─────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const role = asString(ctx.options.role) || 'user';
  const body: Record<string, unknown> = { role, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.email)) body.email = asString(ctx.options.email);
  if (asString(ctx.options.externalId)) body.external_id = asString(ctx.options.externalId);
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.phone)) body.phone = asString(ctx.options.phone);
  if (!body.email && !body.external_id && !asString(ctx.options.phone)) {
    throw new Error('Intercom: provide email, external_id or phone');
  }

  const data = (await icApi(ctx, 'POST', '/contacts', body)) as { id?: string } | null;
  return {
    outputs: { contact: data, id: data?.id ?? null },
    logs: [`Intercom contact create (${role}) → ${data?.id ?? '?'}`],
  };
}

async function leadCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body: Record<string, unknown> = { role: 'lead', ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.email)) body.email = asString(ctx.options.email);
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.phone)) body.phone = asString(ctx.options.phone);

  const data = (await icApi(ctx, 'POST', '/contacts', body)) as { id?: string } | null;
  return {
    outputs: { lead: data, id: data?.id ?? null },
    logs: [`Intercom lead create → ${data?.id ?? '?'}`],
  };
}

// ── Company ────────────────────────────────────────────────────────────────

async function companyCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const companyId = asString(ctx.options.companyId);
  if (!companyId) throw new Error('Intercom: companyId is required');
  const body: Record<string, unknown> = { company_id: companyId, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.website)) body.website = asString(ctx.options.website);

  const data = (await icApi(ctx, 'POST', '/companies', body)) as { id?: string } | null;
  return {
    outputs: { company: data, id: data?.id ?? null },
    logs: [`Intercom company create → ${data?.id ?? companyId}`],
  };
}

// ── Tag ────────────────────────────────────────────────────────────────────

async function tagTagUsers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tagName = asString(ctx.options.name);
  if (!tagName) throw new Error('Intercom: tag name is required');
  const userIdsRaw = asString(ctx.options.userIds);
  if (!userIdsRaw) throw new Error('Intercom: userIds (comma-separated) is required');
  const users = userIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => ({ id }));

  const data = (await icApi(ctx, 'POST', '/tags', { name: tagName, users })) as {
    id?: string;
  } | null;
  return { outputs: { tag: data, id: data?.id ?? null }, logs: [`Intercom tag → ${tagName} (${users.length})`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_intercom',
  name: 'Intercom',
  description: 'Manage Intercom users, leads, companies and tags from a flow.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'intercom' },
  actions: [
    {
      id: 'user_get',
      label: 'Get user',
      description: 'Fetch a user by Intercom id.',
      fields: [{ id: 'userId', label: 'User ID', type: 'text', required: true }],
      run: userGet,
    },
    {
      id: 'user_upsert',
      label: 'Upsert user',
      description: 'Create or update a user by email or external user_id.',
      fields: [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'userIdExternal', label: 'External user_id', type: 'text' },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: userUpsert,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a contact via /contacts (role defaults to user).',
      fields: [
        {
          id: 'role',
          label: 'Role',
          type: 'select',
          defaultValue: 'user',
          options: [
            { label: 'User', value: 'user' },
            { label: 'Lead', value: 'lead' },
          ],
        },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'externalId', label: 'External ID', type: 'text' },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactCreate,
    },
    {
      id: 'lead_create',
      label: 'Create lead',
      description: 'Create a contact with role=lead.',
      fields: [
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: leadCreate,
    },
    {
      id: 'company_create',
      label: 'Create company',
      description: 'Create or update a company by company_id.',
      fields: [
        { id: 'companyId', label: 'Company ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: companyCreate,
    },
    {
      id: 'tag_tag_users',
      label: 'Tag users',
      description: 'Attach a tag to one or more users.',
      fields: [
        { id: 'name', label: 'Tag name', type: 'text', required: true },
        { id: 'userIds', label: 'User IDs (comma-separated)', type: 'text', required: true },
      ],
      run: tagTagUsers,
    },
  ],
};

registerForgeBlock(block);
export default block;
