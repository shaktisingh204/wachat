/**
 * Forge block: ActiveCampaign
 *
 * Source: n8n-master/packages/nodes-base/nodes/ActiveCampaign/ActiveCampaign.node.ts
 *   (+ ContactDescription.ts, DealDescription.ts and others)
 * Credential type: 'activecampaign' — fields: { baseUrl, apiKey }
 *   Auth: `Api-Token: <apiKey>` header. baseUrl is the account-specific
 *   URL like https://you.api-us1.com.
 *
 * Operations covered:
 *   - contact.sync           POST   /api/3/contact/sync
 *   - contact.create         POST   /api/3/contacts
 *   - contact.get            GET    /api/3/contacts/{id}
 *   - contact.update         PUT    /api/3/contacts/{id}
 *   - contact.delete         DELETE /api/3/contacts/{id}
 *   - contact.list_all       GET    /api/3/contacts            (paginated)
 *   - contact_list.add       POST   /api/3/contactLists        (status=1)
 *   - contact_list.remove    POST   /api/3/contactLists        (status=2)
 *   - deal.create            POST   /api/3/deals
 *   - deal.update            PUT    /api/3/deals/{id}
 *   - deal.delete            DELETE /api/3/deals/{id}
 *   - deal.get               GET    /api/3/deals/{id}
 *   - deal.list_all          GET    /api/3/deals               (paginated)
 *   - tag.create             POST   /api/3/tags
 *   - tag.add_to_contact     POST   /api/3/contactTags
 *   - tag.remove_from_contact DELETE /api/3/contactTags/{id}
 *   - list.list_all          GET    /api/3/lists               (paginated)
 *
 * Out of scope:
 *   - Account / accountContact / connection / ecommerce* resources
 *   - Deal notes (createNote/updateNote)
 *   - LoadOptions
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

function resolveAuth(ctx: ForgeActionContext): { baseUrl: string; apiKey: string } {
  const cred = requireCredential('ActiveCampaign', ctx.credential);
  const baseUrl = (cred.baseUrl || '').replace(/\/+$/, '');
  const apiKey = cred.apiKey || '';
  if (!baseUrl) throw new Error('ActiveCampaign: credential is missing `baseUrl`');
  if (!apiKey) throw new Error('ActiveCampaign: credential is missing `apiKey`');
  return { baseUrl, apiKey };
}

async function acApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { baseUrl, apiKey } = resolveAuth(ctx);
  const res = await apiRequest({
    service: 'ActiveCampaign',
    method,
    url: `${baseUrl}${path}`,
    headers: { 'Api-Token': apiKey },
    json,
  });
  return res.data;
}

// ── Contact ────────────────────────────────────────────────────────────────

async function contactSync(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('ActiveCampaign: email is required');
  const contact: Record<string, unknown> = { email };
  if (asString(ctx.options.firstName)) contact.firstName = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) contact.lastName = asString(ctx.options.lastName);
  if (asString(ctx.options.phone)) contact.phone = asString(ctx.options.phone);

  const data = (await acApi(ctx, 'POST', '/api/3/contact/sync', { contact })) as {
    contact?: { id?: string };
  } | null;
  return {
    outputs: { contact: data?.contact, id: data?.contact?.id ?? null },
    logs: [`ActiveCampaign contact sync → ${data?.contact?.id ?? '?'}`],
  };
}

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('ActiveCampaign: contactId is required');
  const data = (await acApi(ctx, 'GET', `/api/3/contacts/${encodeURIComponent(id)}`)) as {
    contact?: unknown;
  } | null;
  return { outputs: { contact: data?.contact ?? data }, logs: [`ActiveCampaign contact get → ${id}`] };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('ActiveCampaign: contactId is required');
  const contact: Record<string, unknown> = {};
  if (asString(ctx.options.email)) contact.email = asString(ctx.options.email);
  if (asString(ctx.options.firstName)) contact.firstName = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) contact.lastName = asString(ctx.options.lastName);
  if (asString(ctx.options.phone)) contact.phone = asString(ctx.options.phone);
  if (Object.keys(contact).length === 0) {
    throw new Error('ActiveCampaign: at least one updatable field must be provided');
  }
  const data = await acApi(ctx, 'PUT', `/api/3/contacts/${encodeURIComponent(id)}`, { contact });
  return { outputs: { contact: data }, logs: [`ActiveCampaign contact update → ${id}`] };
}

async function contactListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = resolveAuth(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSizeNum = asNumber(ctx.options.pageSize) ?? 100;
  const email = asString(ctx.options.email);
  const search = asString(ctx.options.search);

  const contacts = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const offset = cursor ?? '0';
      const qs = new URLSearchParams();
      qs.set('limit', String(pageSizeNum));
      qs.set('offset', offset);
      if (email) qs.set('email', email);
      if (search) qs.set('search', search);
      const res = await apiRequest({
        service: 'ActiveCampaign',
        method: 'GET',
        url: `${baseUrl}/api/3/contacts?${qs.toString()}`,
        headers: { 'Api-Token': apiKey },
      });
      const body = res.data as {
        contacts?: unknown[];
        meta?: { total?: string | number };
      } | null;
      const items = (body?.contacts ?? []) as unknown[];
      // Compute the next offset; stop when the page returned fewer than asked
      // (or we've reached the reported total).
      const consumed = Number(offset) + items.length;
      const total = body?.meta?.total !== undefined ? Number(body.meta.total) : undefined;
      const more = items.length === pageSizeNum && (total === undefined || consumed < total);
      const nextCursor = more ? String(consumed) : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { contacts, count: contacts.length },
    logs: [`ActiveCampaign contact list all → ${contacts.length}`],
  };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('ActiveCampaign: title is required');
  const deal: Record<string, unknown> = { title };
  if (asString(ctx.options.value)) deal.value = asString(ctx.options.value);
  if (asString(ctx.options.currency)) deal.currency = asString(ctx.options.currency).toLowerCase();
  if (asString(ctx.options.contactId)) deal.contact = asString(ctx.options.contactId);
  if (asString(ctx.options.ownerId)) deal.owner = asString(ctx.options.ownerId);
  if (asString(ctx.options.stageId)) deal.stage = asString(ctx.options.stageId);

  const data = (await acApi(ctx, 'POST', '/api/3/deals', { deal })) as {
    deal?: { id?: string };
  } | null;
  return {
    outputs: { deal: data?.deal, id: data?.deal?.id ?? null },
    logs: [`ActiveCampaign deal create → ${data?.deal?.id ?? '?'}`],
  };
}

// ── Tag → Contact ──────────────────────────────────────────────────────────

async function tagAddToContact(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const tagId = asString(ctx.options.tagId);
  if (!contactId) throw new Error('ActiveCampaign: contactId is required');
  if (!tagId) throw new Error('ActiveCampaign: tagId is required');
  const data = (await acApi(ctx, 'POST', '/api/3/contactTags', {
    contactTag: { contact: contactId, tag: tagId },
  })) as { contactTag?: { id?: string } } | null;
  return {
    outputs: { contactTag: data?.contactTag, id: data?.contactTag?.id ?? null },
    logs: [`ActiveCampaign tag ${tagId} → contact ${contactId}`],
  };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('ActiveCampaign: email is required');
  const contact: Record<string, unknown> = { email };
  if (asString(ctx.options.firstName)) contact.firstName = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) contact.lastName = asString(ctx.options.lastName);
  if (asString(ctx.options.phone)) contact.phone = asString(ctx.options.phone);
  const data = (await acApi(ctx, 'POST', '/api/3/contacts', { contact })) as {
    contact?: { id?: string };
  } | null;
  return {
    outputs: { contact: data?.contact, id: data?.contact?.id ?? null },
    logs: [`ActiveCampaign contact create → ${data?.contact?.id ?? '?'}`],
  };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('ActiveCampaign: contactId is required');
  await acApi(ctx, 'DELETE', `/api/3/contacts/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`ActiveCampaign contact delete → ${id}`] };
}

// ── Contact list (membership) ─────────────────────────────────────────────

async function contactListAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const listId = asString(ctx.options.listId);
  if (!contactId) throw new Error('ActiveCampaign: contactId is required');
  if (!listId) throw new Error('ActiveCampaign: listId is required');
  // status=1 subscribes the contact to the list (n8n source).
  const data = await acApi(ctx, 'POST', '/api/3/contactLists', {
    contactList: { list: listId, contact: contactId, status: 1 },
  });
  return {
    outputs: { contactList: data },
    logs: [`ActiveCampaign contactList add → list ${listId} contact ${contactId}`],
  };
}

async function contactListRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const listId = asString(ctx.options.listId);
  if (!contactId) throw new Error('ActiveCampaign: contactId is required');
  if (!listId) throw new Error('ActiveCampaign: listId is required');
  // status=2 unsubscribes (n8n source uses the same endpoint with a different status).
  const data = await acApi(ctx, 'POST', '/api/3/contactLists', {
    contactList: { list: listId, contact: contactId, status: 2 },
  });
  return {
    outputs: { contactList: data },
    logs: [`ActiveCampaign contactList remove → list ${listId} contact ${contactId}`],
  };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('ActiveCampaign: dealId is required');
  const deal: Record<string, unknown> = {};
  if (asString(ctx.options.title)) deal.title = asString(ctx.options.title);
  if (asString(ctx.options.value)) deal.value = asString(ctx.options.value);
  if (asString(ctx.options.currency)) deal.currency = asString(ctx.options.currency).toLowerCase();
  if (asString(ctx.options.contactId)) deal.contact = asString(ctx.options.contactId);
  if (asString(ctx.options.ownerId)) deal.owner = asString(ctx.options.ownerId);
  if (asString(ctx.options.stageId)) deal.stage = asString(ctx.options.stageId);
  if (Object.keys(deal).length === 0) {
    throw new Error('ActiveCampaign: at least one updatable field must be provided');
  }
  const data = await acApi(ctx, 'PUT', `/api/3/deals/${encodeURIComponent(id)}`, { deal });
  return { outputs: { deal: data }, logs: [`ActiveCampaign deal update → ${id}`] };
}

async function dealDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('ActiveCampaign: dealId is required');
  await acApi(ctx, 'DELETE', `/api/3/deals/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`ActiveCampaign deal delete → ${id}`] };
}

async function dealGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('ActiveCampaign: dealId is required');
  const data = (await acApi(ctx, 'GET', `/api/3/deals/${encodeURIComponent(id)}`)) as {
    deal?: unknown;
  } | null;
  return { outputs: { deal: data?.deal ?? data }, logs: [`ActiveCampaign deal get → ${id}`] };
}

// Shared paginated list helper for ActiveCampaign endpoints that return
// `{ <key>: [...], meta: { total } }`. Mirrors n8n's `activeCampaignApiRequestAllItems`.
async function listPaginated<T>(
  ctx: ForgeActionContext,
  path: string,
  responseKey: string,
  maxItems: number,
  pageSize: number,
  extraQs?: Record<string, string>,
): Promise<T[]> {
  const { baseUrl, apiKey } = resolveAuth(ctx);
  return paginateAll<T>({
    maxItems,
    async fetchPage(cursor) {
      const offset = cursor ?? '0';
      const qs = new URLSearchParams();
      qs.set('limit', String(pageSize));
      qs.set('offset', offset);
      if (extraQs) for (const [k, v] of Object.entries(extraQs)) qs.set(k, v);
      const res = await apiRequest({
        service: 'ActiveCampaign',
        method: 'GET',
        url: `${baseUrl}${path}?${qs.toString()}`,
        headers: { 'Api-Token': apiKey },
      });
      const body = res.data as Record<string, unknown> & {
        meta?: { total?: string | number };
      };
      const items = ((body?.[responseKey] as T[] | undefined) ?? []) as T[];
      const consumed = Number(offset) + items.length;
      const total = body?.meta?.total !== undefined ? Number(body.meta.total) : undefined;
      const more = items.length === pageSize && (total === undefined || consumed < total);
      return { items, nextCursor: more ? String(consumed) : undefined };
    },
  });
}

async function dealListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 100;
  const deals = await listPaginated<unknown>(ctx, '/api/3/deals', 'deals', maxItems, pageSize);
  return {
    outputs: { deals, count: deals.length },
    logs: [`ActiveCampaign deal list all → ${deals.length}`],
  };
}

async function listListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 100;
  const lists = await listPaginated<unknown>(ctx, '/api/3/lists', 'lists', maxItems, pageSize);
  return {
    outputs: { lists, count: lists.length },
    logs: [`ActiveCampaign list list all → ${lists.length}`],
  };
}

// ── Tag ───────────────────────────────────────────────────────────────────

async function tagCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('ActiveCampaign: name is required');
  const tag: Record<string, unknown> = { tag: name };
  const tagType = asString(ctx.options.tagType);
  if (tagType) tag.tagType = tagType;
  const description = asString(ctx.options.description);
  if (description) tag.description = description;
  const data = (await acApi(ctx, 'POST', '/api/3/tags', { tag })) as {
    tag?: { id?: string };
  } | null;
  return {
    outputs: { tag: data?.tag, id: data?.tag?.id ?? null },
    logs: [`ActiveCampaign tag create → ${data?.tag?.id ?? '?'}`],
  };
}

async function tagRemoveFromContact(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // Deletes by contactTag id (the join row, not the tag itself), matching n8n's contactTag:remove.
  const contactTagId = asString(ctx.options.contactTagId);
  if (!contactTagId) throw new Error('ActiveCampaign: contactTagId is required');
  await acApi(ctx, 'DELETE', `/api/3/contactTags/${encodeURIComponent(contactTagId)}`);
  return {
    outputs: { ok: true, id: contactTagId },
    logs: [`ActiveCampaign tag remove → contactTag ${contactTagId}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_activecampaign',
  name: 'ActiveCampaign',
  description: 'Sync contacts, manage deals and tag contacts in ActiveCampaign.',
  iconName: 'LuMegaphone',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'activecampaign' },
  actions: [
    {
      id: 'contact_sync',
      label: 'Sync contact',
      description: 'Create or update a contact by email.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ],
      run: contactSync,
    },
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_list_all',
      label: 'List all contacts (paginated)',
      description: 'Walk ActiveCampaign\'s limit/offset pagination and return every contact up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        { id: 'email', label: 'Filter by email (optional)', type: 'text' },
        { id: 'search', label: 'Search text (optional)', type: 'text' },
      ],
      run: contactListAll,
    },
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Patch fields on a contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ],
      run: contactUpdate,
    },
    {
      id: 'deal_create',
      label: 'Create deal',
      description: 'Create a new deal.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'value', label: 'Value (cents)', type: 'text' },
        { id: 'currency', label: 'Currency code', type: 'text', placeholder: 'usd' },
        { id: 'contactId', label: 'Contact ID', type: 'text' },
        { id: 'ownerId', label: 'Owner ID', type: 'text' },
        { id: 'stageId', label: 'Stage ID', type: 'text' },
      ],
      run: dealCreate,
    },
    {
      id: 'tag_add_to_contact',
      label: 'Add tag to contact',
      description: 'Associate an existing tag with a contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'tagId', label: 'Tag ID', type: 'text', required: true },
      ],
      run: tagAddToContact,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a new contact (errors if the email already exists).',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ],
      run: contactCreate,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Permanently delete a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
    {
      id: 'contact_list_add',
      label: 'Add contact to list',
      description: 'Subscribe a contact to a mailing list (status=1).',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: contactListAdd,
    },
    {
      id: 'contact_list_remove',
      label: 'Remove contact from list',
      description: 'Unsubscribe a contact from a mailing list (status=2).',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
      ],
      run: contactListRemove,
    },
    {
      id: 'deal_update',
      label: 'Update deal',
      description: 'Patch fields on an existing deal.',
      fields: [
        { id: 'dealId', label: 'Deal ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'value', label: 'Value (cents)', type: 'text' },
        { id: 'currency', label: 'Currency code', type: 'text', placeholder: 'usd' },
        { id: 'contactId', label: 'Contact ID', type: 'text' },
        { id: 'ownerId', label: 'Owner ID', type: 'text' },
        { id: 'stageId', label: 'Stage ID', type: 'text' },
      ],
      run: dealUpdate,
    },
    {
      id: 'deal_delete',
      label: 'Delete deal',
      description: 'Delete a deal by id.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealDelete,
    },
    {
      id: 'deal_get',
      label: 'Get deal',
      description: 'Fetch a deal by id.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealGet,
    },
    {
      id: 'deal_list_all',
      label: 'List all deals (paginated)',
      description: 'Walk limit/offset pagination and return every deal up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
      ],
      run: dealListAll,
    },
    {
      id: 'list_list_all',
      label: 'List all lists (paginated)',
      description: 'Walk limit/offset pagination and return every mailing list up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
      ],
      run: listListAll,
    },
    {
      id: 'tag_create',
      label: 'Create tag',
      description: 'Create a new tag.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        {
          id: 'tagType',
          label: 'Tag type',
          type: 'select',
          options: [
            { label: 'Contact', value: 'contact' },
            { label: 'Template', value: 'template' },
          ],
          defaultValue: 'contact',
        },
        { id: 'description', label: 'Description', type: 'textarea' },
      ],
      run: tagCreate,
    },
    {
      id: 'tag_remove_from_contact',
      label: 'Remove tag from contact',
      description: 'Delete a contactTag join row (the link between contact and tag).',
      fields: [{ id: 'contactTagId', label: 'Contact-tag ID', type: 'text', required: true }],
      run: tagRemoveFromContact,
    },
  ],
};

registerForgeBlock(block);
export default block;
