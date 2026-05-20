/**
 * Forge block: Copper
 *
 * Source: n8n-master/packages/nodes-base/nodes/Copper/Copper.node.ts
 *   (+ GenericFunctions.ts, descriptions/*)
 * Credential type: 'copper' — fields: { apiKey, email }
 *   Auth headers: X-PW-AccessToken, X-PW-Application: developer_api, X-PW-UserEmail.
 *
 * Operations covered:
 *   - person.get             GET    /people/{id}
 *   - person.create          POST   /people
 *   - person.update          PUT    /people/{id}
 *   - person.delete          DELETE /people/{id}
 *   - person.search          POST   /people/search          (paginated)
 *   - person.search_by_email POST   /people/fetch_by_email
 *   - company.create         POST   /companies
 *   - company.get            GET    /companies/{id}
 *   - company.update         PUT    /companies/{id}
 *   - company.delete         DELETE /companies/{id}
 *   - company.search         POST   /companies/search       (paginated)
 *   - opportunity.create     POST   /opportunities
 *   - opportunity.get        GET    /opportunities/{id}
 *   - opportunity.update     PUT    /opportunities/{id}
 *   - opportunity.delete     DELETE /opportunities/{id}
 *   - opportunity.search     POST   /opportunities/search   (paginated)
 *   - lead.create            POST   /leads
 *   - lead.get               GET    /leads/{id}
 *   - lead.update            PUT    /leads/{id}
 *   - lead.delete            DELETE /leads/{id}
 *   - lead.search            POST   /leads/search           (paginated)
 *   - task.create            POST   /tasks
 *   - task.get               GET    /tasks/{id}
 *   - task.update            PUT    /tasks/{id}
 *   - task.delete            DELETE /tasks/{id}
 *   - customer_source.list   GET    /customer_sources
 *   - user.list              POST   /users/search           (paginated)
 *
 * Out of scope:
 *   - Project / activity resources, address/email/phone fixed-collection builders
 *     (call sites can pass equivalent payloads via the `extra` JSON object).
 *   - LoadOptions for pipelines and statuses
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.copper.com/developer_api/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Copper', ctx.credential);
  const apiKey = cred.apiKey;
  const email = cred.email;
  if (!apiKey) throw new Error('Copper: credential is missing `apiKey`');
  if (!email) throw new Error('Copper: credential is missing `email`');
  return {
    'X-PW-AccessToken': apiKey,
    'X-PW-Application': 'developer_api',
    'X-PW-UserEmail': email,
  };
}

async function copperApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Copper',
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
  throw new Error('Copper: extra fields must be a JSON object');
}

// ── Person ─────────────────────────────────────────────────────────────────

async function personGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Copper: personId is required');
  const data = await copperApi(ctx, 'GET', `/people/${encodeURIComponent(id)}`);
  return { outputs: { person: data }, logs: [`Copper person get → ${id}`] };
}

async function personCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Copper: name is required');
  const body: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  const email = asString(ctx.options.email);
  if (email) body.emails = [{ email, category: 'work' }];
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.companyName)) body.company_name = asString(ctx.options.companyName);

  const data = (await copperApi(ctx, 'POST', '/people', body)) as { id?: number } | null;
  return {
    outputs: { person: data, id: data?.id ?? null },
    logs: [`Copper person create → ${data?.id ?? '?'}`],
  };
}

async function personSearchByEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Copper: email is required');
  const data = await copperApi(ctx, 'POST', '/people/fetch_by_email', { email });
  return { outputs: { person: data }, logs: [`Copper person fetch by email → ${email}`] };
}

// ── Company ────────────────────────────────────────────────────────────────

async function companyCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Copper: name is required');
  const body: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.details)) body.details = asString(ctx.options.details);

  const data = (await copperApi(ctx, 'POST', '/companies', body)) as { id?: number } | null;
  return {
    outputs: { company: data, id: data?.id ?? null },
    logs: [`Copper company create → ${data?.id ?? '?'}`],
  };
}

// ── Opportunity ────────────────────────────────────────────────────────────

async function opportunityCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const primaryContactId = asString(ctx.options.primaryContactId);
  if (!name) throw new Error('Copper: name is required');
  if (!primaryContactId) throw new Error('Copper: primaryContactId is required');
  const body: Record<string, unknown> = {
    name,
    primary_contact_id: Number(primaryContactId),
    ...parseExtra(ctx.options.extra),
  };
  if (asString(ctx.options.monetaryValue)) body.monetary_value = Number(asString(ctx.options.monetaryValue));
  if (asString(ctx.options.pipelineId)) body.pipeline_id = Number(asString(ctx.options.pipelineId));
  if (asString(ctx.options.pipelineStageId)) body.pipeline_stage_id = Number(asString(ctx.options.pipelineStageId));

  const data = (await copperApi(ctx, 'POST', '/opportunities', body)) as { id?: number } | null;
  return {
    outputs: { opportunity: data, id: data?.id ?? null },
    logs: [`Copper opportunity create → ${data?.id ?? '?'}`],
  };
}

// Generic /<resource>/search POST pagination using `page_number` + `page_size`.
// Copper returns an array body and a top-level x-pw-total header, but to keep
// the helper simple we just stop when a page returns fewer than `pageSize`.
async function searchPaginated<T>(
  ctx: ForgeActionContext,
  path: string,
  maxItems: number,
  pageSize: number,
  filters?: Record<string, unknown>,
): Promise<T[]> {
  return paginateAll<T>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ? Number(cursor) : 1;
      const body = { ...(filters ?? {}), page_size: pageSize, page_number: page };
      const res = await apiRequest({
        service: 'Copper',
        method: 'POST',
        url: `${BASE}${path}`,
        headers: authHeaders(ctx),
        json: body,
      });
      const items = Array.isArray(res.data) ? (res.data as T[]) : [];
      const more = items.length === pageSize;
      return { items, nextCursor: more ? String(page + 1) : undefined };
    },
  });
}

async function personUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Copper: personId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.companyName)) body.company_name = asString(ctx.options.companyName);
  if (asString(ctx.options.email)) body.emails = [{ email: asString(ctx.options.email), category: 'work' }];
  if (Object.keys(body).length === 0) {
    throw new Error('Copper: at least one updatable field must be provided');
  }
  const data = await copperApi(ctx, 'PUT', `/people/${encodeURIComponent(id)}`, body);
  return { outputs: { person: data, id }, logs: [`Copper person update → ${id}`] };
}

async function personDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Copper: personId is required');
  await copperApi(ctx, 'DELETE', `/people/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`Copper person delete → ${id}`] };
}

async function personSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 200;
  const pageSize = asNumber(ctx.options.pageSize) ?? 200;
  const filters = parseExtra(ctx.options.filters);
  const items = await searchPaginated<unknown>(ctx, '/people/search', maxItems, pageSize, filters);
  return { outputs: { people: items, count: items.length }, logs: [`Copper person search → ${items.length}`] };
}

// ── Company ────────────────────────────────────────────────────────────────

async function companyGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.companyId);
  if (!id) throw new Error('Copper: companyId is required');
  const data = await copperApi(ctx, 'GET', `/companies/${encodeURIComponent(id)}`);
  return { outputs: { company: data }, logs: [`Copper company get → ${id}`] };
}

async function companyUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.companyId);
  if (!id) throw new Error('Copper: companyId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.details)) body.details = asString(ctx.options.details);
  if (Object.keys(body).length === 0) {
    throw new Error('Copper: at least one updatable field must be provided');
  }
  const data = await copperApi(ctx, 'PUT', `/companies/${encodeURIComponent(id)}`, body);
  return { outputs: { company: data, id }, logs: [`Copper company update → ${id}`] };
}

async function companyDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.companyId);
  if (!id) throw new Error('Copper: companyId is required');
  await copperApi(ctx, 'DELETE', `/companies/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`Copper company delete → ${id}`] };
}

async function companySearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 200;
  const pageSize = asNumber(ctx.options.pageSize) ?? 200;
  const filters = parseExtra(ctx.options.filters);
  const items = await searchPaginated<unknown>(ctx, '/companies/search', maxItems, pageSize, filters);
  return { outputs: { companies: items, count: items.length }, logs: [`Copper company search → ${items.length}`] };
}

// ── Opportunity ────────────────────────────────────────────────────────────

async function opportunityGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.opportunityId);
  if (!id) throw new Error('Copper: opportunityId is required');
  const data = await copperApi(ctx, 'GET', `/opportunities/${encodeURIComponent(id)}`);
  return { outputs: { opportunity: data }, logs: [`Copper opportunity get → ${id}`] };
}

async function opportunityUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.opportunityId);
  if (!id) throw new Error('Copper: opportunityId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.monetaryValue)) body.monetary_value = Number(asString(ctx.options.monetaryValue));
  if (asString(ctx.options.pipelineId)) body.pipeline_id = Number(asString(ctx.options.pipelineId));
  if (asString(ctx.options.pipelineStageId)) body.pipeline_stage_id = Number(asString(ctx.options.pipelineStageId));
  if (Object.keys(body).length === 0) {
    throw new Error('Copper: at least one updatable field must be provided');
  }
  const data = await copperApi(ctx, 'PUT', `/opportunities/${encodeURIComponent(id)}`, body);
  return { outputs: { opportunity: data, id }, logs: [`Copper opportunity update → ${id}`] };
}

async function opportunityDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.opportunityId);
  if (!id) throw new Error('Copper: opportunityId is required');
  await copperApi(ctx, 'DELETE', `/opportunities/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`Copper opportunity delete → ${id}`] };
}

async function opportunitySearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 200;
  const pageSize = asNumber(ctx.options.pageSize) ?? 200;
  const filters = parseExtra(ctx.options.filters);
  const items = await searchPaginated<unknown>(ctx, '/opportunities/search', maxItems, pageSize, filters);
  return { outputs: { opportunities: items, count: items.length }, logs: [`Copper opportunity search → ${items.length}`] };
}

// ── Lead ───────────────────────────────────────────────────────────────────

async function leadCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Copper: name is required');
  const body: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.email)) body.email = { email: asString(ctx.options.email), category: 'work' };
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.companyName)) body.company_name = asString(ctx.options.companyName);
  const data = (await copperApi(ctx, 'POST', '/leads', body)) as { id?: number } | null;
  return {
    outputs: { lead: data, id: data?.id ?? null },
    logs: [`Copper lead create → ${data?.id ?? '?'}`],
  };
}

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Copper: leadId is required');
  const data = await copperApi(ctx, 'GET', `/leads/${encodeURIComponent(id)}`);
  return { outputs: { lead: data }, logs: [`Copper lead get → ${id}`] };
}

async function leadUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Copper: leadId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (Object.keys(body).length === 0) {
    throw new Error('Copper: at least one updatable field must be provided');
  }
  const data = await copperApi(ctx, 'PUT', `/leads/${encodeURIComponent(id)}`, body);
  return { outputs: { lead: data, id }, logs: [`Copper lead update → ${id}`] };
}

async function leadDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Copper: leadId is required');
  await copperApi(ctx, 'DELETE', `/leads/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`Copper lead delete → ${id}`] };
}

async function leadSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 200;
  const pageSize = asNumber(ctx.options.pageSize) ?? 200;
  const filters = parseExtra(ctx.options.filters);
  const items = await searchPaginated<unknown>(ctx, '/leads/search', maxItems, pageSize, filters);
  return { outputs: { leads: items, count: items.length }, logs: [`Copper lead search → ${items.length}`] };
}

// ── Task ───────────────────────────────────────────────────────────────────

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Copper: name is required');
  const body: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.dueDate)) body.due_date = Number(asString(ctx.options.dueDate));
  if (asString(ctx.options.priority)) body.priority = asString(ctx.options.priority);
  if (asString(ctx.options.status)) body.status = asString(ctx.options.status);
  const data = (await copperApi(ctx, 'POST', '/tasks', body)) as { id?: number } | null;
  return {
    outputs: { task: data, id: data?.id ?? null },
    logs: [`Copper task create → ${data?.id ?? '?'}`],
  };
}

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Copper: taskId is required');
  const data = await copperApi(ctx, 'GET', `/tasks/${encodeURIComponent(id)}`);
  return { outputs: { task: data }, logs: [`Copper task get → ${id}`] };
}

async function taskUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Copper: taskId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.dueDate)) body.due_date = Number(asString(ctx.options.dueDate));
  if (asString(ctx.options.priority)) body.priority = asString(ctx.options.priority);
  if (asString(ctx.options.status)) body.status = asString(ctx.options.status);
  if (Object.keys(body).length === 0) {
    throw new Error('Copper: at least one updatable field must be provided');
  }
  const data = await copperApi(ctx, 'PUT', `/tasks/${encodeURIComponent(id)}`, body);
  return { outputs: { task: data, id }, logs: [`Copper task update → ${id}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Copper: taskId is required');
  await copperApi(ctx, 'DELETE', `/tasks/${encodeURIComponent(id)}`);
  return { outputs: { ok: true, id }, logs: [`Copper task delete → ${id}`] };
}

// ── Misc ───────────────────────────────────────────────────────────────────

async function customerSourceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await copperApi(ctx, 'GET', '/customer_sources');
  return { outputs: { customer_sources: data }, logs: ['Copper customer sources list'] };
}

async function userList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 200;
  const pageSize = asNumber(ctx.options.pageSize) ?? 200;
  const items = await searchPaginated<unknown>(ctx, '/users/search', maxItems, pageSize);
  return { outputs: { users: items, count: items.length }, logs: [`Copper users → ${items.length}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_copper',
  name: 'Copper',
  description: 'Read and write Copper people, companies and opportunities.',
  iconName: 'LuCopper',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'copper' },
  actions: [
    {
      id: 'person_get',
      label: 'Get person',
      description: 'Fetch a person by id.',
      fields: [{ id: 'personId', label: 'Person ID', type: 'text', required: true }],
      run: personGet,
    },
    {
      id: 'person_create',
      label: 'Create person',
      description: 'Create a new person record.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'companyName', label: 'Company name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: personCreate,
    },
    {
      id: 'person_search_by_email',
      label: 'Search person by email',
      description: 'Look up a person by email address.',
      fields: [{ id: 'email', label: 'Email', type: 'text', required: true }],
      run: personSearchByEmail,
    },
    {
      id: 'company_create',
      label: 'Create company',
      description: 'Create a new company.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'details', label: 'Details', type: 'textarea' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: companyCreate,
    },
    {
      id: 'opportunity_create',
      label: 'Create opportunity',
      description: 'Create a new opportunity tied to a primary contact.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'primaryContactId', label: 'Primary contact ID', type: 'text', required: true },
        { id: 'monetaryValue', label: 'Monetary value', type: 'number' },
        { id: 'pipelineId', label: 'Pipeline ID', type: 'text' },
        { id: 'pipelineStageId', label: 'Pipeline stage ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: opportunityCreate,
    },
    {
      id: 'person_update',
      label: 'Update person',
      description: 'Patch fields on a person.',
      fields: [
        { id: 'personId', label: 'Person ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'companyName', label: 'Company name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: personUpdate,
    },
    {
      id: 'person_delete',
      label: 'Delete person',
      description: 'Permanently delete a person.',
      fields: [{ id: 'personId', label: 'Person ID', type: 'text', required: true }],
      run: personDelete,
    },
    {
      id: 'person_search',
      label: 'Search people',
      description: 'Search people, walking page_number/page_size pagination.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '200' },
        { id: 'pageSize', label: 'Page size (max 200)', type: 'number', defaultValue: '200' },
        { id: 'filters', label: 'Filters (JSON)', type: 'json' },
      ],
      run: personSearch,
    },
    {
      id: 'company_get',
      label: 'Get company',
      description: 'Fetch a company by id.',
      fields: [{ id: 'companyId', label: 'Company ID', type: 'text', required: true }],
      run: companyGet,
    },
    {
      id: 'company_update',
      label: 'Update company',
      description: 'Patch fields on a company.',
      fields: [
        { id: 'companyId', label: 'Company ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'details', label: 'Details', type: 'textarea' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: companyUpdate,
    },
    {
      id: 'company_delete',
      label: 'Delete company',
      description: 'Permanently delete a company.',
      fields: [{ id: 'companyId', label: 'Company ID', type: 'text', required: true }],
      run: companyDelete,
    },
    {
      id: 'company_search',
      label: 'Search companies',
      description: 'Search companies, walking page_number/page_size pagination.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '200' },
        { id: 'pageSize', label: 'Page size (max 200)', type: 'number', defaultValue: '200' },
        { id: 'filters', label: 'Filters (JSON)', type: 'json' },
      ],
      run: companySearch,
    },
    {
      id: 'opportunity_get',
      label: 'Get opportunity',
      description: 'Fetch an opportunity by id.',
      fields: [{ id: 'opportunityId', label: 'Opportunity ID', type: 'text', required: true }],
      run: opportunityGet,
    },
    {
      id: 'opportunity_update',
      label: 'Update opportunity',
      description: 'Patch fields on an opportunity.',
      fields: [
        { id: 'opportunityId', label: 'Opportunity ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'monetaryValue', label: 'Monetary value', type: 'number' },
        { id: 'pipelineId', label: 'Pipeline ID', type: 'text' },
        { id: 'pipelineStageId', label: 'Pipeline stage ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: opportunityUpdate,
    },
    {
      id: 'opportunity_delete',
      label: 'Delete opportunity',
      description: 'Permanently delete an opportunity.',
      fields: [{ id: 'opportunityId', label: 'Opportunity ID', type: 'text', required: true }],
      run: opportunityDelete,
    },
    {
      id: 'opportunity_search',
      label: 'Search opportunities',
      description: 'Search opportunities, walking page_number/page_size pagination.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '200' },
        { id: 'pageSize', label: 'Page size (max 200)', type: 'number', defaultValue: '200' },
        { id: 'filters', label: 'Filters (JSON)', type: 'json' },
      ],
      run: opportunitySearch,
    },
    {
      id: 'lead_create',
      label: 'Create lead',
      description: 'Create a new lead.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'companyName', label: 'Company name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: leadCreate,
    },
    {
      id: 'lead_get',
      label: 'Get lead',
      description: 'Fetch a lead by id.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }],
      run: leadGet,
    },
    {
      id: 'lead_update',
      label: 'Update lead',
      description: 'Patch fields on a lead.',
      fields: [
        { id: 'leadId', label: 'Lead ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: leadUpdate,
    },
    {
      id: 'lead_delete',
      label: 'Delete lead',
      description: 'Permanently delete a lead.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }],
      run: leadDelete,
    },
    {
      id: 'lead_search',
      label: 'Search leads',
      description: 'Search leads, walking page_number/page_size pagination.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '200' },
        { id: 'pageSize', label: 'Page size (max 200)', type: 'number', defaultValue: '200' },
        { id: 'filters', label: 'Filters (JSON)', type: 'json' },
      ],
      run: leadSearch,
    },
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a new task.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'dueDate', label: 'Due date (epoch seconds)', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text', placeholder: 'High | Medium | Low' },
        { id: 'status', label: 'Status', type: 'text', placeholder: 'Open | Completed' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: taskCreate,
    },
    {
      id: 'task_get',
      label: 'Get task',
      description: 'Fetch a task by id.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }],
      run: taskGet,
    },
    {
      id: 'task_update',
      label: 'Update task',
      description: 'Patch fields on a task.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'dueDate', label: 'Due date (epoch seconds)', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'status', label: 'Status', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: taskUpdate,
    },
    {
      id: 'task_delete',
      label: 'Delete task',
      description: 'Permanently delete a task.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }],
      run: taskDelete,
    },
    {
      id: 'customer_source_list',
      label: 'List customer sources',
      description: 'Fetch all customer sources.',
      fields: [],
      run: customerSourceList,
    },
    {
      id: 'user_list',
      label: 'List users',
      description: 'Walk pagination over /users/search and return every user up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '200' },
        { id: 'pageSize', label: 'Page size (max 200)', type: 'number', defaultValue: '200' },
      ],
      run: userList,
    },
  ],
};

registerForgeBlock(block);
export default block;
