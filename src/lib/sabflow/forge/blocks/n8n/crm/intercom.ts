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
 *   - user.delete          DELETE /users/{id}
 *   - user.list_all        GET    /users    (paginated via next.page link)
 *   - contact.create       POST   /contacts (visitor → lead/user contact API)
 *   - contact.get          GET    /contacts/{id}
 *   - contact.delete       DELETE /contacts/{id}
 *   - contact.list_all     GET    /contacts (paginated)
 *   - lead.create          POST   /contacts (role=lead)
 *   - lead.delete          DELETE /contacts/{id}
 *   - company.create       POST   /companies (also updates by company_id)
 *   - company.get          GET    /companies/{id}
 *   - company.list_all     GET    /companies (paginated)
 *   - company.users        GET    /companies/{id}/users (paginated)
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
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

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

// Generic paginated list over Intercom's classic v1 collections. Intercom
// returns `{ <responseKey>: [...], pages: { next: <url> | { page } } }`. We
// follow `pages.next.page` (integer) up to maxItems.
async function listPaginated<T>(
  ctx: ForgeActionContext,
  path: string,
  responseKey: string,
  maxItems: number,
  pageSize: number,
): Promise<T[]> {
  return paginateAll<T>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ? Number(cursor) : 1;
      const qs = new URLSearchParams({ per_page: String(pageSize), page: String(page) });
      const res = await apiRequest({
        service: 'Intercom',
        method: 'GET',
        url: `${BASE}${path}?${qs.toString()}`,
        headers: authHeaders(ctx),
      });
      const body = res.data as Record<string, unknown> & {
        pages?: { next?: { page?: number } | string; total_pages?: number };
      };
      const items = ((body?.[responseKey] as T[] | undefined) ?? []) as T[];
      const next = body?.pages?.next;
      // Intercom returns either an object {page: N} or a URL string with ?page=N.
      let nextPage: number | undefined;
      if (next && typeof next === 'object' && typeof next.page === 'number') {
        nextPage = next.page;
      } else if (typeof next === 'string') {
        try {
          const u = new URL(next);
          const p = u.searchParams.get('page');
          if (p) nextPage = Number(p);
        } catch {
          /* ignore malformed next URL */
        }
      }
      return { items, nextCursor: nextPage ? String(nextPage) : undefined };
    },
  });
}

async function userDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('Intercom: userId is required');
  await icApi(ctx, 'DELETE', `/users/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Intercom user delete → ${id}`] };
}

async function userListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 60;
  const items = await listPaginated<unknown>(ctx, '/users', 'users', maxItems, pageSize);
  return { outputs: { users: items, count: items.length }, logs: [`Intercom user list all → ${items.length}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Intercom: contactId is required');
  const data = await icApi(ctx, 'GET', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Intercom contact get → ${id}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Intercom: contactId is required');
  await icApi(ctx, 'DELETE', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Intercom contact delete → ${id}`] };
}

async function contactListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 60;
  const items = await listPaginated<unknown>(ctx, '/contacts', 'contacts', maxItems, pageSize);
  return { outputs: { contacts: items, count: items.length }, logs: [`Intercom contact list all → ${items.length}`] };
}

async function leadDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // Leads in classic Intercom v1 are contacts with role=lead; deletion goes
  // through the same /contacts/{id} endpoint.
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Intercom: leadId is required');
  await icApi(ctx, 'DELETE', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Intercom lead delete → ${id}`] };
}

async function companyGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Intercom: id is required');
  const data = await icApi(ctx, 'GET', `/companies/${encodeURIComponent(id)}`);
  return { outputs: { company: data }, logs: [`Intercom company get → ${id}`] };
}

async function companyListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 60;
  const items = await listPaginated<unknown>(ctx, '/companies', 'companies', maxItems, pageSize);
  return { outputs: { companies: items, count: items.length }, logs: [`Intercom company list all → ${items.length}`] };
}

async function companyUsers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Intercom: id is required');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 60;
  const items = await listPaginated<unknown>(
    ctx,
    `/companies/${encodeURIComponent(id)}/users`,
    'users',
    maxItems,
    pageSize,
  );
  return {
    outputs: { users: items, count: items.length, companyId: id },
    logs: [`Intercom company users → ${id} (${items.length})`],
  };
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
    {
      id: 'user_delete',
      label: 'Delete user',
      description: 'Delete a user by Intercom id.',
      fields: [{ id: 'userId', label: 'User ID', type: 'text', required: true }],
      run: userDelete,
    },
    {
      id: 'user_list_all',
      label: 'List all users (paginated)',
      description: 'Walk Intercom v1 page-based pagination and return every user up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 60)', type: 'number', defaultValue: '60' },
      ],
      run: userListAll,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by Intercom id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Delete a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
    {
      id: 'contact_list_all',
      label: 'List all contacts (paginated)',
      description: 'Walk Intercom v1 page-based pagination and return every contact up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 60)', type: 'number', defaultValue: '60' },
      ],
      run: contactListAll,
    },
    {
      id: 'lead_delete',
      label: 'Delete lead',
      description: 'Delete a lead (contact with role=lead) by id.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }],
      run: leadDelete,
    },
    {
      id: 'company_get',
      label: 'Get company',
      description: 'Fetch a company by Intercom id.',
      fields: [{ id: 'id', label: 'Company ID (Intercom id)', type: 'text', required: true }],
      run: companyGet,
    },
    {
      id: 'company_list_all',
      label: 'List all companies (paginated)',
      description: 'Walk Intercom v1 page-based pagination and return every company up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 60)', type: 'number', defaultValue: '60' },
      ],
      run: companyListAll,
    },
    {
      id: 'company_users',
      label: 'List company users (paginated)',
      description: 'Walk pagination of users attached to a company.',
      fields: [
        { id: 'id', label: 'Company ID (Intercom id)', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 60)', type: 'number', defaultValue: '60' },
      ],
      run: companyUsers,
    },
  ],
};

registerForgeBlock(block);
export default block;
