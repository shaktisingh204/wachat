/**
 * Forge block: GetResponse
 *
 * Source: n8n-master/packages/nodes-base/nodes/GetResponse/GetResponse.node.ts
 * Credential type: 'getresponse' (apiKey)
 *
 * Auth: `X-Auth-Token: api-key <KEY>`.
 *
 * Operations covered (contact resource — GetResponse's only documented resource here):
 *   - contact.create   POST   /contacts
 *   - contact.get      GET    /contacts/{id}
 *   - contact.getAll   GET    /contacts                 (page+perPage pagination via TotalPages header)
 *   - contact.update   POST   /contacts/{id}            (GR uses POST for partial update)
 *   - contact.delete   DELETE /contacts/{id}
 *
 * Out of scope for the first port:
 *   - LoadOptions for campaign/list dropdowns
 *   - Custom fields helpers
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.getresponse.com/v3';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('GetResponse', ctx.credential);
  const apiKey = cred.apiKey ?? '';
  if (!apiKey) throw new Error('GetResponse: credential is missing `apiKey`');
  return { 'X-Auth-Token': `api-key ${apiKey}` };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const campaignId = asString(ctx.options.campaignId);
  if (!email) throw new Error('GetResponse: email is required');
  if (!campaignId) throw new Error('GetResponse: campaignId is required');
  const body: Record<string, unknown> = { email, campaign: { campaignId } };
  const name = asString(ctx.options.name);
  if (name) body.name = name;
  const dayOfCycle = asString(ctx.options.dayOfCycle);
  if (dayOfCycle) body.dayOfCycle = Number(dayOfCycle);
  const ipAddress = asString(ctx.options.ipAddress);
  if (ipAddress) body.ipAddress = ipAddress;

  const res = await apiRequest({
    service: 'GetResponse',
    method: 'POST',
    url: `${BASE}/contacts`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data, success: true }, logs: [`GetResponse contact create → ${email}`] };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('GetResponse: contactId is required');
  const res = await apiRequest({
    service: 'GetResponse',
    method: 'GET',
    url: `${BASE}/contacts/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { contact: res.data }, logs: [`GetResponse contact get → ${id}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('GetResponse: contactId is required');
  const body: Record<string, unknown> = {};
  const name = asString(ctx.options.name);
  if (name) body.name = name;
  const email = asString(ctx.options.email);
  if (email) body.email = email;
  const dayOfCycle = asString(ctx.options.dayOfCycle);
  if (dayOfCycle) body.dayOfCycle = Number(dayOfCycle);
  if (Object.keys(body).length === 0) {
    throw new Error('GetResponse: at least one updatable field must be set');
  }
  const res = await apiRequest({
    service: 'GetResponse',
    method: 'POST',
    url: `${BASE}/contacts/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { contact: res.data }, logs: [`GetResponse contact update → ${id}`] };
}

async function contactGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const perPage = asNumber(ctx.options.pageSize) ?? 100;
  const campaignId = asString(ctx.options.campaignId);

  const contacts = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ?? '1';
      const qs = new URLSearchParams();
      qs.set('page', page);
      qs.set('perPage', String(perPage));
      // GR uses bracketed query filters: `query[campaignId]=`.
      if (campaignId) qs.set('query[campaignId]', campaignId);
      const res = await apiRequest({
        service: 'GetResponse',
        method: 'GET',
        url: `${BASE}/contacts?${qs.toString()}`,
        headers: authHeaders(ctx),
      });
      const items = ((res.data as unknown[] | null) ?? []) as unknown[];
      const totalPagesHeader = res.headers.get('totalpages') ?? res.headers.get('TotalPages');
      const totalPages = totalPagesHeader ? Number(totalPagesHeader) : NaN;
      const current = Number(page);
      const more = Number.isFinite(totalPages) ? current < totalPages : items.length === perPage;
      return { items, nextCursor: more ? String(current + 1) : undefined };
    },
  });
  return { outputs: { contacts, count: contacts.length }, logs: [`GetResponse contact list → ${contacts.length}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('GetResponse: contactId is required');
  await apiRequest({
    service: 'GetResponse',
    method: 'DELETE',
    url: `${BASE}/contacts/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`GetResponse contact delete → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_getresponse',
  name: 'GetResponse',
  description: 'Manage GetResponse contacts.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'getresponse' },
  actions: [
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Add a contact to a campaign.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'campaignId', label: 'Campaign (list) ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'dayOfCycle', label: 'Day of cycle', type: 'number' },
        { id: 'ipAddress', label: 'IP address', type: 'text' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Patch an existing contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'dayOfCycle', label: 'Day of cycle', type: 'number' },
      ],
      run: contactUpdate,
    },
    {
      id: 'contact_get_all',
      label: 'List contacts (paginated)',
      description: 'Walk GetResponse contact pagination (TotalPages header). Optionally filter by campaign.',
      fields: [
        { id: 'campaignId', label: 'Campaign ID (optional)', type: 'text' },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (perPage)', type: 'number', defaultValue: '100' },
      ],
      run: contactGetAll,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Delete a contact.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
