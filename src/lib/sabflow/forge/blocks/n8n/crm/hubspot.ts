/**
 * Forge block: HubSpot
 *
 * Source: n8n-master/packages/nodes-base/nodes/Hubspot/V2/HubspotV2.node.ts
 *   (+ ContactDescription.ts, CompanyDescription.ts, DealDescription.ts)
 * Credential type: 'hubspot' — fields: { accessToken: 'pat-...' }
 *
 * Operations covered (subset of the multi-resource CRM):
 *   - contact.get          GET /crm/v3/objects/contacts/{id}
 *   - contact.upsert       POST /crm/v3/objects/contacts (idsearch by email then PATCH)
 *   - company.get          GET /crm/v3/objects/companies/{id}
 *   - company.create       POST /crm/v3/objects/companies
 *   - deal.get             GET /crm/v3/objects/deals/{id}
 *   - deal.create          POST /crm/v3/objects/deals
 *
 * Out of scope for the first port:
 *   - LoadOptions for pipeline/stage/owner dropdowns (free-text instead)
 *   - Engagement, Form, Ticket and List operations — re-add in a follow-up
 *   - Pagination on getMany (defer to a shared paginator)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.hubapi.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('HubSpot', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('HubSpot: credential is missing `accessToken` field');
  return { Authorization: `Bearer ${token}` };
}

async function hsApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'HubSpot',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

// ── Contact actions ─────────────────────────────────────────────────────────

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('HubSpot: contactId is required');
  const data = await hsApi(ctx, 'GET', `/crm/v3/objects/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`HubSpot contact get → ${id}`] };
}

async function contactUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('HubSpot: email is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  properties.email = email;
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const lifecyclestage = asString(ctx.options.lifecyclestage);
  if (firstName) properties.firstname = firstName;
  if (lastName) properties.lastname = lastName;
  if (lifecyclestage) properties.lifecyclestage = lifecyclestage;

  // Search by email first.
  const search = (await hsApi(ctx, 'POST', '/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    limit: 1,
  })) as { results?: Array<{ id: string }> } | null;

  const existingId = search?.results?.[0]?.id;
  if (existingId) {
    const updated = await hsApi(
      ctx,
      'PATCH',
      `/crm/v3/objects/contacts/${encodeURIComponent(existingId)}`,
      { properties },
    );
    return {
      outputs: { contact: updated, id: existingId, created: false },
      logs: [`HubSpot contact updated → ${existingId}`],
    };
  }
  const created = (await hsApi(ctx, 'POST', '/crm/v3/objects/contacts', { properties })) as {
    id?: string;
  } | null;
  return {
    outputs: { contact: created, id: created?.id ?? null, created: true },
    logs: [`HubSpot contact created → ${created?.id ?? '?'}`],
  };
}

async function contactListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = Number(asString(ctx.options.maxItems) || '500');
  const pageSize = asString(ctx.options.pageSize) || '100';
  const propsField = asString(ctx.options.properties).trim();
  const propsQuery = propsField ? `&properties=${encodeURIComponent(propsField)}` : '';

  const contacts = await paginateAll<unknown>({
    maxItems: Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 500,
    async fetchPage(cursor) {
      const afterQuery = cursor ? `&after=${encodeURIComponent(cursor)}` : '';
      const path = `/crm/v3/objects/contacts?limit=${encodeURIComponent(pageSize)}${afterQuery}${propsQuery}`;
      const data = (await hsApi(ctx, 'GET', path)) as {
        results?: unknown[];
        paging?: { next?: { after?: string } };
      } | null;
      const items = (data?.results ?? []) as unknown[];
      const nextCursor = data?.paging?.next?.after;
      return { items, nextCursor };
    },
  });

  return { outputs: { contacts, count: contacts.length }, logs: [`HubSpot contact list all → ${contacts.length}`] };
}

// ── Company actions ────────────────────────────────────────────────────────

async function companyGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.companyId);
  if (!id) throw new Error('HubSpot: companyId is required');
  const data = await hsApi(ctx, 'GET', `/crm/v3/objects/companies/${encodeURIComponent(id)}`);
  return { outputs: { company: data }, logs: [`HubSpot company get → ${id}`] };
}

async function companyCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('HubSpot: name is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  properties.name = name;
  if (asString(ctx.options.domain)) properties.domain = asString(ctx.options.domain);
  const data = (await hsApi(ctx, 'POST', '/crm/v3/objects/companies', { properties })) as {
    id?: string;
  } | null;
  return {
    outputs: { company: data, id: data?.id ?? null },
    logs: [`HubSpot company create → ${data?.id ?? '?'}`],
  };
}

// ── Deal actions ───────────────────────────────────────────────────────────

async function dealGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('HubSpot: dealId is required');
  const data = await hsApi(ctx, 'GET', `/crm/v3/objects/deals/${encodeURIComponent(id)}`);
  return { outputs: { deal: data }, logs: [`HubSpot deal get → ${id}`] };
}

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.dealname);
  if (!name) throw new Error('HubSpot: dealname is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  properties.dealname = name;
  if (asString(ctx.options.pipeline)) properties.pipeline = asString(ctx.options.pipeline);
  if (asString(ctx.options.dealstage)) properties.dealstage = asString(ctx.options.dealstage);
  if (asString(ctx.options.amount)) properties.amount = asString(ctx.options.amount);
  const data = (await hsApi(ctx, 'POST', '/crm/v3/objects/deals', { properties })) as {
    id?: string;
  } | null;
  return {
    outputs: { deal: data, id: data?.id ?? null },
    logs: [`HubSpot deal create → ${data?.id ?? '?'}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_hubspot',
  name: 'HubSpot',
  description: 'Create, fetch and upsert HubSpot contacts, companies and deals.',
  iconName: 'LuOrbit',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'hubspot' },
  actions: [
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_upsert',
      label: 'Create or update contact',
      description: 'Look up by email; create if missing, otherwise PATCH.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true, placeholder: 'name@example.com' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        {
          id: 'lifecyclestage',
          label: 'Lifecycle stage',
          type: 'select',
          helperText: 'Dynamically loaded from HubSpot when a credential is selected.',
          loadOptions: async (ctx) => {
            if (!ctx.credential?.accessToken) return [];
            const res = await apiRequest({
              service: 'HubSpot',
              method: 'GET',
              url: 'https://api.hubapi.com/crm/v3/properties/contacts/lifecyclestage',
              headers: { Authorization: `Bearer ${ctx.credential.accessToken}` },
            });
            const opts =
              (res.data as { options?: Array<{ label: string; value: string }> }).options ?? [];
            return opts.map((o) => ({ label: o.label, value: o.value }));
          },
        },
        {
          id: 'properties',
          label: 'Extra properties (JSON)',
          type: 'json',
          helperText: 'Additional HubSpot contact properties as a JSON object.',
        },
      ],
      run: contactUpsert,
    },
    {
      id: 'contact_list_all',
      label: 'List all contacts (paginated)',
      description: 'Walk the `paging.next.after` cursor and return every contact up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        {
          id: 'properties',
          label: 'Properties (comma-separated)',
          type: 'text',
          helperText: 'Optional. Comma-separated property names to include in each contact.',
        },
      ],
      run: contactListAll,
    },
    {
      id: 'company_get',
      label: 'Get company',
      description: 'Fetch a company by id.',
      fields: [{ id: 'companyId', label: 'Company ID', type: 'text', required: true }],
      run: companyGet,
    },
    {
      id: 'company_create',
      label: 'Create company',
      description: 'Create a new company record.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'domain', label: 'Domain', type: 'text' },
        { id: 'properties', label: 'Extra properties (JSON)', type: 'json' },
      ],
      run: companyCreate,
    },
    {
      id: 'deal_get',
      label: 'Get deal',
      description: 'Fetch a deal by id.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealGet,
    },
    {
      id: 'deal_create',
      label: 'Create deal',
      description: 'Create a new deal.',
      fields: [
        { id: 'dealname', label: 'Deal name', type: 'text', required: true },
        { id: 'pipeline', label: 'Pipeline ID', type: 'text' },
        { id: 'dealstage', label: 'Deal stage ID', type: 'text' },
        { id: 'amount', label: 'Amount', type: 'text' },
        { id: 'properties', label: 'Extra properties (JSON)', type: 'json' },
      ],
      run: dealCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
