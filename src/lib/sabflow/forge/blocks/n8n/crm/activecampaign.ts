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
 *   - contact.get            GET    /api/3/contacts/{id}
 *   - contact.update         PUT    /api/3/contacts/{id}
 *   - deal.create            POST   /api/3/deals
 *   - tag.addToContact       POST   /api/3/contactTags
 *
 * Out of scope:
 *   - List/account/tracking operations
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
  ],
};

registerForgeBlock(block);
export default block;
