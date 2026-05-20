/**
 * Forge block: Pipedrive
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pipedrive/Pipedrive.node.ts
 *   (+ v1/PipedriveV1.node.ts, v1/GenericFunctions.ts)
 * Credential type: 'pipedrive' — fields: { apiToken, companyDomain? }
 *   Pipedrive authenticates via `?api_token=...` query string per the n8n
 *   PipedriveApi credential.
 *
 * Operations covered:
 *   - person.get            GET    /persons/{id}
 *   - person.create         POST   /persons
 *   - person.update         PUT    /persons/{id}
 *   - person.delete         DELETE /persons/{id}
 *   - person.list_all       GET    /persons        (paginated)
 *   - deal.get              GET    /deals/{id}
 *   - deal.create           POST   /deals
 *   - deal.update           PUT    /deals/{id}
 *   - deal.delete           DELETE /deals/{id}
 *   - deal.duplicate        POST   /deals/{id}/duplicate
 *   - deal.search           GET    /deals/search?term=…
 *   - deal.list_all         GET    /deals          (paginated)
 *   - organization.get      GET    /organizations/{id}
 *   - organization.create   POST   /organizations
 *   - organization.update   PUT    /organizations/{id}
 *   - organization.delete   DELETE /organizations/{id}
 *   - organization.list_all GET    /organizations  (paginated)
 *   - activity.get          GET    /activities/{id}
 *   - activity.create       POST   /activities
 *   - activity.list_all     GET    /activities     (paginated)
 *   - note.get              GET    /notes/{id}
 *   - note.create           POST   /notes
 *   - note.list_all         GET    /notes          (paginated)
 *   - lead.get              GET    /leads/{id}
 *   - lead.create           POST   /leads
 *   - lead.delete           DELETE /leads/{id}
 *   - lead.list_all         GET    /leads          (paginated)
 *
 * Out of scope:
 *   - OAuth2 alternative auth flow (api_token query string is enough)
 *   - file resource (binary upload + multipart — not yet wired through the
 *     forge runtime which has no binary-stream handling)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

function buildUrl(ctx: ForgeActionContext, path: string, extraQs?: Record<string, string>): string {
  const cred = requireCredential('Pipedrive', ctx.credential);
  const apiToken = cred.apiToken;
  if (!apiToken) throw new Error('Pipedrive: credential is missing `apiToken` field');
  const url = new URL(`https://api.pipedrive.com/v1${path}`);
  url.searchParams.set('api_token', apiToken);
  if (extraQs) {
    for (const [k, v] of Object.entries(extraQs)) {
      if (v !== '') url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function pdApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
  qs?: Record<string, string>,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Pipedrive',
    method,
    url: buildUrl(ctx, path, qs),
    json,
  });
  const body = res.data as { success?: boolean; data?: unknown; error?: string } | null;
  if (body && body.success === false) {
    throw new Error(`Pipedrive ${method} ${path}: ${body.error ?? 'unknown error'}`);
  }
  return body?.data ?? body;
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
  throw new Error('Pipedrive: extra fields must be a JSON object');
}

/**
 * Walk Pipedrive's start/limit pagination for any list endpoint. Pipedrive
 * returns a uniform `additional_data.pagination.next_start` cursor.
 */
async function pdListAll(
  ctx: ForgeActionContext,
  path: string,
  opts: { maxItems: number; pageSize: string; extraQs?: Record<string, string> },
): Promise<unknown[]> {
  return paginateAll<unknown>({
    maxItems: opts.maxItems,
    async fetchPage(cursor) {
      const qs: Record<string, string> = {
        limit: opts.pageSize,
        start: cursor ?? '0',
        ...(opts.extraQs ?? {}),
      };
      const url = buildUrl(ctx, path, qs);
      const res = await apiRequest({ service: 'Pipedrive', method: 'GET', url });
      const body = res.data as {
        success?: boolean;
        data?: unknown[];
        error?: string;
        additional_data?: {
          pagination?: {
            start?: number;
            limit?: number;
            more_items_in_collection?: boolean;
            next_start?: number;
          };
        };
      } | null;
      if (body && body.success === false) {
        throw new Error(`Pipedrive GET ${path}: ${body.error ?? 'unknown error'}`);
      }
      const items = (body?.data ?? []) as unknown[];
      const pag = body?.additional_data?.pagination;
      const nextCursor =
        pag?.more_items_in_collection && pag.next_start !== undefined
          ? String(pag.next_start)
          : undefined;
      return { items, nextCursor };
    },
  });
}

// ── Person ─────────────────────────────────────────────────────────────────

async function personGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Pipedrive: personId is required');
  const data = await pdApi(ctx, 'GET', `/persons/${encodeURIComponent(id)}`);
  return { outputs: { person: data }, logs: [`Pipedrive person get → ${id}`] };
}

async function personCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Pipedrive: name is required');
  const body: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.email)) body.email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) body.phone = asString(ctx.options.phone);
  if (asString(ctx.options.orgId)) body.org_id = Number(asString(ctx.options.orgId));

  const data = (await pdApi(ctx, 'POST', '/persons', body)) as { id?: number } | null;
  return {
    outputs: { person: data, id: data?.id ?? null },
    logs: [`Pipedrive person create → ${data?.id ?? '?'}`],
  };
}

async function personUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Pipedrive: personId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.email)) body.email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) body.phone = asString(ctx.options.phone);
  if (Object.keys(body).length === 0) {
    throw new Error('Pipedrive: at least one updatable field must be provided');
  }
  const data = await pdApi(ctx, 'PUT', `/persons/${encodeURIComponent(id)}`, body);
  return { outputs: { person: data }, logs: [`Pipedrive person update → ${id}`] };
}

async function personDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Pipedrive: personId is required');
  const data = await pdApi(ctx, 'DELETE', `/persons/${encodeURIComponent(id)}`);
  return { outputs: { result: data }, logs: [`Pipedrive person delete → ${id}`] };
}

async function personListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const filterId = asString(ctx.options.filterId);
  const extraQs: Record<string, string> = {};
  if (filterId) extraQs.filter_id = filterId;
  const persons = await pdListAll(ctx, '/persons', { maxItems, pageSize, extraQs });
  return {
    outputs: { persons, count: persons.length },
    logs: [`Pipedrive person list all → ${persons.length}`],
  };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('Pipedrive: dealId is required');
  const data = await pdApi(ctx, 'GET', `/deals/${encodeURIComponent(id)}`);
  return { outputs: { deal: data }, logs: [`Pipedrive deal get → ${id}`] };
}

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('Pipedrive: title is required');
  const body: Record<string, unknown> = { title, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.value)) body.value = asString(ctx.options.value);
  if (asString(ctx.options.currency)) body.currency = asString(ctx.options.currency);
  if (asString(ctx.options.personId)) body.person_id = Number(asString(ctx.options.personId));
  if (asString(ctx.options.orgId)) body.org_id = Number(asString(ctx.options.orgId));
  if (asString(ctx.options.stageId)) body.stage_id = Number(asString(ctx.options.stageId));

  const data = (await pdApi(ctx, 'POST', '/deals', body)) as { id?: number } | null;
  return {
    outputs: { deal: data, id: data?.id ?? null },
    logs: [`Pipedrive deal create → ${data?.id ?? '?'}`],
  };
}

async function dealUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('Pipedrive: dealId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.value)) body.value = asString(ctx.options.value);
  if (asString(ctx.options.currency)) body.currency = asString(ctx.options.currency);
  if (asString(ctx.options.stageId)) body.stage_id = Number(asString(ctx.options.stageId));
  if (asString(ctx.options.status)) body.status = asString(ctx.options.status);
  if (Object.keys(body).length === 0) {
    throw new Error('Pipedrive: at least one updatable field must be provided');
  }
  const data = await pdApi(ctx, 'PUT', `/deals/${encodeURIComponent(id)}`, body);
  return { outputs: { deal: data }, logs: [`Pipedrive deal update → ${id}`] };
}

async function dealDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('Pipedrive: dealId is required');
  const data = await pdApi(ctx, 'DELETE', `/deals/${encodeURIComponent(id)}`);
  return { outputs: { result: data }, logs: [`Pipedrive deal delete → ${id}`] };
}

async function dealDuplicate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('Pipedrive: dealId is required');
  const data = await pdApi(ctx, 'POST', `/deals/${encodeURIComponent(id)}/duplicate`);
  return { outputs: { deal: data }, logs: [`Pipedrive deal duplicate → ${id}`] };
}

async function dealSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const term = asString(ctx.options.term);
  if (!term) throw new Error('Pipedrive: term is required');
  const qs: Record<string, string> = { term };
  if (asString(ctx.options.fields)) qs.fields = asString(ctx.options.fields);
  if (asString(ctx.options.exactMatch)) qs.exact_match = asString(ctx.options.exactMatch);
  if (asString(ctx.options.status)) qs.status = asString(ctx.options.status);
  const data = await pdApi(ctx, 'GET', '/deals/search', undefined, qs);
  return { outputs: { result: data }, logs: [`Pipedrive deal search → ${term}`] };
}

async function dealListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const extraQs: Record<string, string> = {};
  if (asString(ctx.options.status)) extraQs.status = asString(ctx.options.status);
  if (asString(ctx.options.filterId)) extraQs.filter_id = asString(ctx.options.filterId);
  const deals = await pdListAll(ctx, '/deals', { maxItems, pageSize, extraQs });
  return {
    outputs: { deals, count: deals.length },
    logs: [`Pipedrive deal list all → ${deals.length}`],
  };
}

// ── Organization ───────────────────────────────────────────────────────────

async function organizationGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orgId);
  if (!id) throw new Error('Pipedrive: orgId is required');
  const data = await pdApi(ctx, 'GET', `/organizations/${encodeURIComponent(id)}`);
  return { outputs: { organization: data }, logs: [`Pipedrive organization get → ${id}`] };
}

async function organizationCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Pipedrive: name is required');
  const body: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.ownerId)) body.owner_id = Number(asString(ctx.options.ownerId));

  const data = (await pdApi(ctx, 'POST', '/organizations', body)) as { id?: number } | null;
  return {
    outputs: { organization: data, id: data?.id ?? null },
    logs: [`Pipedrive organization create → ${data?.id ?? '?'}`],
  };
}

async function organizationUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orgId);
  if (!id) throw new Error('Pipedrive: orgId is required');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.ownerId)) body.owner_id = Number(asString(ctx.options.ownerId));
  if (Object.keys(body).length === 0) {
    throw new Error('Pipedrive: at least one updatable field must be provided');
  }
  const data = await pdApi(ctx, 'PUT', `/organizations/${encodeURIComponent(id)}`, body);
  return { outputs: { organization: data }, logs: [`Pipedrive organization update → ${id}`] };
}

async function organizationDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.orgId);
  if (!id) throw new Error('Pipedrive: orgId is required');
  const data = await pdApi(ctx, 'DELETE', `/organizations/${encodeURIComponent(id)}`);
  return { outputs: { result: data }, logs: [`Pipedrive organization delete → ${id}`] };
}

async function organizationListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const orgs = await pdListAll(ctx, '/organizations', { maxItems, pageSize });
  return {
    outputs: { organizations: orgs, count: orgs.length },
    logs: [`Pipedrive organization list all → ${orgs.length}`],
  };
}

// ── Activity ───────────────────────────────────────────────────────────────

async function activityGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.activityId);
  if (!id) throw new Error('Pipedrive: activityId is required');
  const data = await pdApi(ctx, 'GET', `/activities/${encodeURIComponent(id)}`);
  return { outputs: { activity: data }, logs: [`Pipedrive activity get → ${id}`] };
}

async function activityCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  if (!subject) throw new Error('Pipedrive: subject is required');
  const body: Record<string, unknown> = { subject, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.type)) body.type = asString(ctx.options.type);
  if (asString(ctx.options.done)) body.done = Number(asString(ctx.options.done));
  if (asString(ctx.options.dueDate)) body.due_date = asString(ctx.options.dueDate);
  if (asString(ctx.options.dealId)) body.deal_id = Number(asString(ctx.options.dealId));
  if (asString(ctx.options.personId)) body.person_id = Number(asString(ctx.options.personId));
  if (asString(ctx.options.orgId)) body.org_id = Number(asString(ctx.options.orgId));

  const data = (await pdApi(ctx, 'POST', '/activities', body)) as { id?: number } | null;
  return {
    outputs: { activity: data, id: data?.id ?? null },
    logs: [`Pipedrive activity create → ${data?.id ?? '?'}`],
  };
}

async function activityListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const extraQs: Record<string, string> = {};
  if (asString(ctx.options.done)) extraQs.done = asString(ctx.options.done);
  if (asString(ctx.options.type)) extraQs.type = asString(ctx.options.type);
  const activities = await pdListAll(ctx, '/activities', { maxItems, pageSize, extraQs });
  return {
    outputs: { activities, count: activities.length },
    logs: [`Pipedrive activity list all → ${activities.length}`],
  };
}

// ── Note ───────────────────────────────────────────────────────────────────

async function noteGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.noteId);
  if (!id) throw new Error('Pipedrive: noteId is required');
  const data = await pdApi(ctx, 'GET', `/notes/${encodeURIComponent(id)}`);
  return { outputs: { note: data }, logs: [`Pipedrive note get → ${id}`] };
}

async function noteCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Pipedrive: content is required');
  const body: Record<string, unknown> = { content, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.dealId)) body.deal_id = Number(asString(ctx.options.dealId));
  if (asString(ctx.options.personId)) body.person_id = Number(asString(ctx.options.personId));
  if (asString(ctx.options.orgId)) body.org_id = Number(asString(ctx.options.orgId));
  if (asString(ctx.options.leadId)) body.lead_id = asString(ctx.options.leadId);

  const data = (await pdApi(ctx, 'POST', '/notes', body)) as { id?: number } | null;
  return {
    outputs: { note: data, id: data?.id ?? null },
    logs: [`Pipedrive note create → ${data?.id ?? '?'}`],
  };
}

async function noteListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const extraQs: Record<string, string> = {};
  if (asString(ctx.options.dealId)) extraQs.deal_id = asString(ctx.options.dealId);
  if (asString(ctx.options.personId)) extraQs.person_id = asString(ctx.options.personId);
  if (asString(ctx.options.orgId)) extraQs.org_id = asString(ctx.options.orgId);
  const notes = await pdListAll(ctx, '/notes', { maxItems, pageSize, extraQs });
  return {
    outputs: { notes, count: notes.length },
    logs: [`Pipedrive note list all → ${notes.length}`],
  };
}

// ── Lead ───────────────────────────────────────────────────────────────────

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Pipedrive: leadId is required');
  const data = await pdApi(ctx, 'GET', `/leads/${encodeURIComponent(id)}`);
  return { outputs: { lead: data }, logs: [`Pipedrive lead get → ${id}`] };
}

async function leadCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('Pipedrive: title is required');
  const body: Record<string, unknown> = { title, ...parseExtra(ctx.options.extra) };
  // Per n8n LeadDescription a lead must be associated with either a person or organization
  if (asString(ctx.options.personId)) body.person_id = Number(asString(ctx.options.personId));
  if (asString(ctx.options.orgId)) body.organization_id = Number(asString(ctx.options.orgId));
  if (!body.person_id && !body.organization_id) {
    throw new Error('Pipedrive: lead must have either personId or orgId');
  }
  if (asString(ctx.options.value) && asString(ctx.options.currency)) {
    body.value = { amount: Number(asString(ctx.options.value)), currency: asString(ctx.options.currency) };
  }
  if (asString(ctx.options.expectedCloseDate)) {
    body.expected_close_date = asString(ctx.options.expectedCloseDate);
  }

  const data = (await pdApi(ctx, 'POST', '/leads', body)) as { id?: string } | null;
  return {
    outputs: { lead: data, id: data?.id ?? null },
    logs: [`Pipedrive lead create → ${data?.id ?? '?'}`],
  };
}

async function leadDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Pipedrive: leadId is required');
  const data = await pdApi(ctx, 'DELETE', `/leads/${encodeURIComponent(id)}`);
  return { outputs: { result: data }, logs: [`Pipedrive lead delete → ${id}`] };
}

async function leadListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const leads = await pdListAll(ctx, '/leads', { maxItems, pageSize });
  return {
    outputs: { leads, count: leads.length },
    logs: [`Pipedrive lead list all → ${leads.length}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_pipedrive',
  name: 'Pipedrive',
  description: 'Manage Pipedrive persons, deals, organizations, activities, notes and leads from a flow.',
  iconName: 'LuTrendingUp',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pipedrive' },
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
      description: 'Create a new person.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'orgId', label: 'Organization ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: personCreate,
    },
    {
      id: 'person_list_all',
      label: 'List all persons (paginated)',
      description: 'Walk Pipedrive\'s start/limit pagination and return every person up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 500)', type: 'number', defaultValue: '100' },
        { id: 'filterId', label: 'Filter ID (optional)', type: 'text' },
      ],
      run: personListAll,
    },
    {
      id: 'person_update',
      label: 'Update person',
      description: 'Patch fields on an existing person.',
      fields: [
        { id: 'personId', label: 'Person ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: personUpdate,
    },
    {
      id: 'person_delete',
      label: 'Delete person',
      description: 'Permanently delete a person by id.',
      fields: [{ id: 'personId', label: 'Person ID', type: 'text', required: true }],
      run: personDelete,
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
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'text' },
        { id: 'currency', label: 'Currency code', type: 'text', placeholder: 'USD' },
        { id: 'personId', label: 'Person ID', type: 'number' },
        { id: 'orgId', label: 'Organization ID', type: 'number' },
        { id: 'stageId', label: 'Stage ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: dealCreate,
    },
    {
      id: 'deal_update',
      label: 'Update deal',
      description: 'Patch fields on an existing deal.',
      fields: [
        { id: 'dealId', label: 'Deal ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'value', label: 'Value', type: 'text' },
        { id: 'currency', label: 'Currency', type: 'text' },
        { id: 'stageId', label: 'Stage ID', type: 'number' },
        { id: 'status', label: 'Status', type: 'select', options: [
          { label: 'Open', value: 'open' },
          { label: 'Won', value: 'won' },
          { label: 'Lost', value: 'lost' },
          { label: 'Deleted', value: 'deleted' },
        ] },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: dealUpdate,
    },
    {
      id: 'deal_delete',
      label: 'Delete deal',
      description: 'Permanently delete a deal by id.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealDelete,
    },
    {
      id: 'deal_duplicate',
      label: 'Duplicate deal',
      description: 'Create a copy of an existing deal.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealDuplicate,
    },
    {
      id: 'deal_search',
      label: 'Search deals',
      description: 'Search deals by free-text term.',
      fields: [
        { id: 'term', label: 'Search term', type: 'text', required: true },
        { id: 'fields', label: 'Fields (comma list)', type: 'text', placeholder: 'title,notes' },
        { id: 'exactMatch', label: 'Exact match (true/false)', type: 'text' },
        { id: 'status', label: 'Status', type: 'text', placeholder: 'open' },
      ],
      run: dealSearch,
    },
    {
      id: 'deal_list_all',
      label: 'List all deals (paginated)',
      description: 'Walk start/limit pagination and return every deal up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 500)', type: 'number', defaultValue: '100' },
        { id: 'status', label: 'Status filter', type: 'text', placeholder: 'open' },
        { id: 'filterId', label: 'Filter ID (optional)', type: 'text' },
      ],
      run: dealListAll,
    },
    {
      id: 'organization_get',
      label: 'Get organization',
      description: 'Fetch an organization by id.',
      fields: [{ id: 'orgId', label: 'Organization ID', type: 'text', required: true }],
      run: organizationGet,
    },
    {
      id: 'organization_create',
      label: 'Create organization',
      description: 'Create a new organization.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'ownerId', label: 'Owner ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: organizationCreate,
    },
    {
      id: 'organization_update',
      label: 'Update organization',
      description: 'Patch fields on an existing organization.',
      fields: [
        { id: 'orgId', label: 'Organization ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'ownerId', label: 'Owner ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: organizationUpdate,
    },
    {
      id: 'organization_delete',
      label: 'Delete organization',
      description: 'Permanently delete an organization by id.',
      fields: [{ id: 'orgId', label: 'Organization ID', type: 'text', required: true }],
      run: organizationDelete,
    },
    {
      id: 'organization_list_all',
      label: 'List all organizations (paginated)',
      description: 'Walk start/limit pagination and return every organization up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 500)', type: 'number', defaultValue: '100' },
      ],
      run: organizationListAll,
    },
    {
      id: 'activity_get',
      label: 'Get activity',
      description: 'Fetch an activity by id.',
      fields: [{ id: 'activityId', label: 'Activity ID', type: 'text', required: true }],
      run: activityGet,
    },
    {
      id: 'activity_create',
      label: 'Create activity',
      description: 'Create a new activity (call, meeting, task, …).',
      fields: [
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'type', label: 'Type key', type: 'text', placeholder: 'call' },
        { id: 'done', label: 'Done (0/1)', type: 'text' },
        { id: 'dueDate', label: 'Due date (YYYY-MM-DD)', type: 'text' },
        { id: 'dealId', label: 'Deal ID', type: 'number' },
        { id: 'personId', label: 'Person ID', type: 'number' },
        { id: 'orgId', label: 'Organization ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: activityCreate,
    },
    {
      id: 'activity_list_all',
      label: 'List all activities (paginated)',
      description: 'Walk start/limit pagination and return every activity up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 500)', type: 'number', defaultValue: '100' },
        { id: 'done', label: 'Done filter (0/1)', type: 'text' },
        { id: 'type', label: 'Type filter (comma list)', type: 'text' },
      ],
      run: activityListAll,
    },
    {
      id: 'note_get',
      label: 'Get note',
      description: 'Fetch a note by id.',
      fields: [{ id: 'noteId', label: 'Note ID', type: 'text', required: true }],
      run: noteGet,
    },
    {
      id: 'note_create',
      label: 'Create note',
      description: 'Create a new note attached to a deal, person, organization or lead.',
      fields: [
        { id: 'content', label: 'Content', type: 'textarea', required: true },
        { id: 'dealId', label: 'Deal ID', type: 'number' },
        { id: 'personId', label: 'Person ID', type: 'number' },
        { id: 'orgId', label: 'Organization ID', type: 'number' },
        { id: 'leadId', label: 'Lead ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: noteCreate,
    },
    {
      id: 'note_list_all',
      label: 'List all notes (paginated)',
      description: 'Walk start/limit pagination and return every note up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 500)', type: 'number', defaultValue: '100' },
        { id: 'dealId', label: 'Filter deal ID', type: 'text' },
        { id: 'personId', label: 'Filter person ID', type: 'text' },
        { id: 'orgId', label: 'Filter organization ID', type: 'text' },
      ],
      run: noteListAll,
    },
    {
      id: 'lead_get',
      label: 'Get lead',
      description: 'Fetch a lead by id.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }],
      run: leadGet,
    },
    {
      id: 'lead_create',
      label: 'Create lead',
      description: 'Create a new lead (must associate with either a person or an organization).',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'personId', label: 'Person ID', type: 'number' },
        { id: 'orgId', label: 'Organization ID', type: 'number' },
        { id: 'value', label: 'Value amount', type: 'text' },
        { id: 'currency', label: 'Value currency', type: 'text', placeholder: 'USD' },
        { id: 'expectedCloseDate', label: 'Expected close date (YYYY-MM-DD)', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: leadCreate,
    },
    {
      id: 'lead_delete',
      label: 'Delete lead',
      description: 'Permanently delete a lead by id.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }],
      run: leadDelete,
    },
    {
      id: 'lead_list_all',
      label: 'List all leads (paginated)',
      description: 'Walk start/limit pagination and return every lead up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 500)', type: 'number', defaultValue: '100' },
      ],
      run: leadListAll,
    },
  ],
};

registerForgeBlock(block);
export default block;
