/**
 * Forge block: HubSpot
 *
 * Source: n8n-master/packages/nodes-base/nodes/Hubspot/V2/HubspotV2.node.ts
 *   (+ ContactDescription.ts, CompanyDescription.ts, DealDescription.ts)
 * Credential type: 'hubspot' — fields: { accessToken: 'pat-...' }
 *
 * Operations covered (subset of the multi-resource CRM):
 *   - contact.get          GET    /crm/v3/objects/contacts/{id}
 *   - contact.upsert       POST   /crm/v3/objects/contacts (email-search then PATCH)
 *   - contact.update       PATCH  /crm/v3/objects/contacts/{id}
 *   - contact.delete       DELETE /crm/v3/objects/contacts/{id}
 *   - contact.list_all     GET    /crm/v3/objects/contacts            (paginated)
 *   - company.get          GET    /crm/v3/objects/companies/{id}
 *   - company.create       POST   /crm/v3/objects/companies
 *   - company.update       PATCH  /crm/v3/objects/companies/{id}
 *   - company.delete       DELETE /crm/v3/objects/companies/{id}
 *   - company.list_all     GET    /crm/v3/objects/companies           (paginated)
 *   - deal.get             GET    /crm/v3/objects/deals/{id}
 *   - deal.create          POST   /crm/v3/objects/deals
 *   - deal.update          PATCH  /crm/v3/objects/deals/{id}
 *   - deal.delete          DELETE /crm/v3/objects/deals/{id}
 *   - deal.list_all        GET    /crm/v3/objects/deals               (paginated)
 *   - ticket.create        POST   /crm/v3/objects/tickets
 *   - ticket.get           GET    /crm/v3/objects/tickets/{id}
 *   - ticket.update        PATCH  /crm/v3/objects/tickets/{id}
 *   - ticket.delete        DELETE /crm/v3/objects/tickets/{id}
 *   - engagement.create    POST   /engagements/v1/engagements
 *
 * Out of scope for the first port:
 *   - LoadOptions for pipeline/stage/owner dropdowns (free-text instead)
 *   - Form submit, list membership, file APIs
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString, requireCredential } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.hubapi.com';

async function hsApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  requireCredential('HubSpot', ctx.credential);
  const r = await ctx.helpers!.requestWithAuthentication('bearer', {
    method,
    url: `${BASE}${path}`,
    tokenField: 'accessToken',
    json,
  });
  if (!r.ok) {
    const clip =
      typeof r.data === 'string'
        ? r.data.length > 300
          ? `${r.data.slice(0, 300)}…`
          : r.data
        : JSON.stringify(r.data ?? null).slice(0, 300);
    throw new Error(`HubSpot ${method} ${path} failed (${r.status}): ${clip}`);
  }
  return r.data;
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

// Generic paginated lister over /crm/v3/objects/<type>. Mirrors HubSpot's
// `paging.next.after` cursor convention.
async function listObjects<T>(
  ctx: ForgeActionContext,
  objectType: string,
  maxItems: number,
  pageSize: string,
  propsField: string,
): Promise<T[]> {
  const propsQuery = propsField ? `&properties=${encodeURIComponent(propsField)}` : '';
  return paginateAll<T>({
    maxItems,
    async fetchPage(cursor) {
      const afterQuery = cursor ? `&after=${encodeURIComponent(cursor)}` : '';
      const path = `/crm/v3/objects/${objectType}?limit=${encodeURIComponent(pageSize)}${afterQuery}${propsQuery}`;
      const data = (await hsApi(ctx, 'GET', path)) as {
        results?: T[];
        paging?: { next?: { after?: string } };
      } | null;
      const items = (data?.results ?? []) as T[];
      const nextCursor = data?.paging?.next?.after;
      return { items, nextCursor };
    },
  });
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('HubSpot: contactId is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  if (asString(ctx.options.email)) properties.email = asString(ctx.options.email);
  if (asString(ctx.options.firstName)) properties.firstname = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) properties.lastname = asString(ctx.options.lastName);
  if (Object.keys(properties).length === 0) {
    throw new Error('HubSpot: at least one property must be provided');
  }
  const data = await hsApi(ctx, 'PATCH', `/crm/v3/objects/contacts/${encodeURIComponent(id)}`, {
    properties,
  });
  return { outputs: { contact: data, id }, logs: [`HubSpot contact update → ${id}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('HubSpot: contactId is required');
  await hsApi(ctx, 'DELETE', `/crm/v3/objects/contacts/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`HubSpot contact delete → ${id}`] };
}

// ── Company actions (extended) ─────────────────────────────────────────────

async function companyUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.companyId);
  if (!id) throw new Error('HubSpot: companyId is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  if (asString(ctx.options.name)) properties.name = asString(ctx.options.name);
  if (asString(ctx.options.domain)) properties.domain = asString(ctx.options.domain);
  if (Object.keys(properties).length === 0) {
    throw new Error('HubSpot: at least one property must be provided');
  }
  const data = await hsApi(ctx, 'PATCH', `/crm/v3/objects/companies/${encodeURIComponent(id)}`, {
    properties,
  });
  return { outputs: { company: data, id }, logs: [`HubSpot company update → ${id}`] };
}

async function companyDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.companyId);
  if (!id) throw new Error('HubSpot: companyId is required');
  await hsApi(ctx, 'DELETE', `/crm/v3/objects/companies/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`HubSpot company delete → ${id}`] };
}

async function companyListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = Number(asString(ctx.options.maxItems) || '500');
  const pageSize = asString(ctx.options.pageSize) || '100';
  const propsField = asString(ctx.options.properties).trim();
  const items = await listObjects<unknown>(
    ctx,
    'companies',
    Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 500,
    pageSize,
    propsField,
  );
  return { outputs: { companies: items, count: items.length }, logs: [`HubSpot company list all → ${items.length}`] };
}

// ── Deal actions (extended) ────────────────────────────────────────────────

async function dealUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('HubSpot: dealId is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  if (asString(ctx.options.dealname)) properties.dealname = asString(ctx.options.dealname);
  if (asString(ctx.options.pipeline)) properties.pipeline = asString(ctx.options.pipeline);
  if (asString(ctx.options.dealstage)) properties.dealstage = asString(ctx.options.dealstage);
  if (asString(ctx.options.amount)) properties.amount = asString(ctx.options.amount);
  if (Object.keys(properties).length === 0) {
    throw new Error('HubSpot: at least one property must be provided');
  }
  const data = await hsApi(ctx, 'PATCH', `/crm/v3/objects/deals/${encodeURIComponent(id)}`, {
    properties,
  });
  return { outputs: { deal: data, id }, logs: [`HubSpot deal update → ${id}`] };
}

async function dealDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('HubSpot: dealId is required');
  await hsApi(ctx, 'DELETE', `/crm/v3/objects/deals/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`HubSpot deal delete → ${id}`] };
}

async function dealListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = Number(asString(ctx.options.maxItems) || '500');
  const pageSize = asString(ctx.options.pageSize) || '100';
  const propsField = asString(ctx.options.properties).trim();
  const items = await listObjects<unknown>(
    ctx,
    'deals',
    Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 500,
    pageSize,
    propsField,
  );
  return { outputs: { deals: items, count: items.length }, logs: [`HubSpot deal list all → ${items.length}`] };
}

// ── Ticket actions ─────────────────────────────────────────────────────────

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  if (!subject) throw new Error('HubSpot: subject is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  properties.subject = subject;
  if (asString(ctx.options.content)) properties.content = asString(ctx.options.content);
  if (asString(ctx.options.pipeline)) properties.hs_pipeline = asString(ctx.options.pipeline);
  if (asString(ctx.options.stage)) properties.hs_pipeline_stage = asString(ctx.options.stage);
  if (asString(ctx.options.priority)) properties.hs_ticket_priority = asString(ctx.options.priority);
  const data = (await hsApi(ctx, 'POST', '/crm/v3/objects/tickets', { properties })) as {
    id?: string;
  } | null;
  return {
    outputs: { ticket: data, id: data?.id ?? null },
    logs: [`HubSpot ticket create → ${data?.id ?? '?'}`],
  };
}

async function ticketGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('HubSpot: ticketId is required');
  const data = await hsApi(ctx, 'GET', `/crm/v3/objects/tickets/${encodeURIComponent(id)}`);
  return { outputs: { ticket: data }, logs: [`HubSpot ticket get → ${id}`] };
}

async function ticketUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('HubSpot: ticketId is required');
  const properties = parseJsonObject(ctx.options.properties, 'HubSpot: properties');
  if (asString(ctx.options.subject)) properties.subject = asString(ctx.options.subject);
  if (asString(ctx.options.content)) properties.content = asString(ctx.options.content);
  if (asString(ctx.options.stage)) properties.hs_pipeline_stage = asString(ctx.options.stage);
  if (Object.keys(properties).length === 0) {
    throw new Error('HubSpot: at least one property must be provided');
  }
  const data = await hsApi(ctx, 'PATCH', `/crm/v3/objects/tickets/${encodeURIComponent(id)}`, {
    properties,
  });
  return { outputs: { ticket: data, id }, logs: [`HubSpot ticket update → ${id}`] };
}

async function ticketDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.ticketId);
  if (!id) throw new Error('HubSpot: ticketId is required');
  await hsApi(ctx, 'DELETE', `/crm/v3/objects/tickets/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`HubSpot ticket delete → ${id}`] };
}

// ── Engagement (legacy v1 endpoint, still maintained) ──────────────────────

async function engagementCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const type = asString(ctx.options.type).toUpperCase();
  if (!type) throw new Error('HubSpot: engagement type is required (NOTE | TASK | CALL | EMAIL | MEETING)');
  const engagement: Record<string, unknown> = { type, active: true };
  const associations = parseJsonObject(ctx.options.associations, 'HubSpot: associations');
  const metadata = parseJsonObject(ctx.options.metadata, 'HubSpot: metadata');
  const body: Record<string, unknown> = { engagement, associations, metadata };
  const data = await hsApi(ctx, 'POST', '/engagements/v1/engagements', body);
  return { outputs: { engagement: data }, logs: [`HubSpot engagement create → ${type}`] };
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
            const res = await ctx.helpers!.requestWithAuthentication('bearer', {
              method: 'GET',
              url: 'https://api.hubapi.com/crm/v3/properties/contacts/lifecyclestage',
              tokenField: 'accessToken',
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
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'PATCH properties on a contact by id.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'properties', label: 'Extra properties (JSON)', type: 'json' },
      ],
      run: contactUpdate,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Soft-delete a contact (HubSpot moves it to the recycle bin).',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
    {
      id: 'company_update',
      label: 'Update company',
      description: 'PATCH properties on a company by id.',
      fields: [
        { id: 'companyId', label: 'Company ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'domain', label: 'Domain', type: 'text' },
        { id: 'properties', label: 'Extra properties (JSON)', type: 'json' },
      ],
      run: companyUpdate,
    },
    {
      id: 'company_delete',
      label: 'Delete company',
      description: 'Soft-delete a company.',
      fields: [{ id: 'companyId', label: 'Company ID', type: 'text', required: true }],
      run: companyDelete,
    },
    {
      id: 'company_list_all',
      label: 'List all companies (paginated)',
      description: 'Walk the `paging.next.after` cursor and return every company up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        { id: 'properties', label: 'Properties (comma-separated)', type: 'text' },
      ],
      run: companyListAll,
    },
    {
      id: 'deal_update',
      label: 'Update deal',
      description: 'PATCH properties on a deal by id.',
      fields: [
        { id: 'dealId', label: 'Deal ID', type: 'text', required: true },
        { id: 'dealname', label: 'Deal name', type: 'text' },
        { id: 'pipeline', label: 'Pipeline ID', type: 'text' },
        { id: 'dealstage', label: 'Deal stage ID', type: 'text' },
        { id: 'amount', label: 'Amount', type: 'text' },
        { id: 'properties', label: 'Extra properties (JSON)', type: 'json' },
      ],
      run: dealUpdate,
    },
    {
      id: 'deal_delete',
      label: 'Delete deal',
      description: 'Soft-delete a deal.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealDelete,
    },
    {
      id: 'deal_list_all',
      label: 'List all deals (paginated)',
      description: 'Walk the `paging.next.after` cursor and return every deal up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        { id: 'properties', label: 'Properties (comma-separated)', type: 'text' },
      ],
      run: dealListAll,
    },
    {
      id: 'ticket_create',
      label: 'Create ticket',
      description: 'Create a new ticket.',
      fields: [
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea' },
        { id: 'pipeline', label: 'Pipeline ID', type: 'text' },
        { id: 'stage', label: 'Stage ID', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text', placeholder: 'LOW | MEDIUM | HIGH' },
        { id: 'properties', label: 'Extra properties (JSON)', type: 'json' },
      ],
      run: ticketCreate,
    },
    {
      id: 'ticket_get',
      label: 'Get ticket',
      description: 'Fetch a ticket by id.',
      fields: [{ id: 'ticketId', label: 'Ticket ID', type: 'text', required: true }],
      run: ticketGet,
    },
    {
      id: 'ticket_update',
      label: 'Update ticket',
      description: 'PATCH properties on a ticket by id.',
      fields: [
        { id: 'ticketId', label: 'Ticket ID', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'content', label: 'Content', type: 'textarea' },
        { id: 'stage', label: 'Stage ID', type: 'text' },
        { id: 'properties', label: 'Extra properties (JSON)', type: 'json' },
      ],
      run: ticketUpdate,
    },
    {
      id: 'ticket_delete',
      label: 'Delete ticket',
      description: 'Soft-delete a ticket.',
      fields: [{ id: 'ticketId', label: 'Ticket ID', type: 'text', required: true }],
      run: ticketDelete,
    },
    {
      id: 'engagement_create',
      label: 'Create engagement',
      description: 'Create an engagement (NOTE / TASK / CALL / EMAIL / MEETING) via the legacy v1 endpoint.',
      fields: [
        {
          id: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          defaultValue: 'NOTE',
          options: [
            { label: 'Note', value: 'NOTE' },
            { label: 'Task', value: 'TASK' },
            { label: 'Call', value: 'CALL' },
            { label: 'Email', value: 'EMAIL' },
            { label: 'Meeting', value: 'MEETING' },
          ],
        },
        {
          id: 'associations',
          label: 'Associations (JSON)',
          type: 'json',
          helperText: '{ "contactIds": [], "companyIds": [], "dealIds": [] }',
        },
        {
          id: 'metadata',
          label: 'Metadata (JSON)',
          type: 'json',
          helperText: 'Engagement-type-specific payload, e.g. { "body": "Note text" } for NOTE.',
        },
      ],
      run: engagementCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
