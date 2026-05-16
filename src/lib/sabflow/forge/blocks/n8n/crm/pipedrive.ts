/**
 * Forge block: Pipedrive
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pipedrive/Pipedrive.node.ts
 *   (+ v1/PipedriveV1.node.ts, v1/GenericFunctions.ts)
 * Credential type: 'pipedrive' — fields: { apiToken, companyDomain? }
 *   Pipedrive authenticates via `?api_token=...` query string per the n8n
 *   PipedriveApi credential.
 *
 * Operations covered (subset of resource matrix):
 *   - person.get            GET    /persons/{id}
 *   - person.create         POST   /persons
 *   - person.update         PUT    /persons/{id}
 *   - deal.get              GET    /deals/{id}
 *   - deal.create           POST   /deals
 *   - organization.create   POST   /organizations
 *
 * Out of scope:
 *   - getAll with pagination
 *   - OAuth2 alternative auth flow
 *   - Activity, note, file, lead resources
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

async function personListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const filterId = asString(ctx.options.filterId);

  const persons = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const qs: Record<string, string> = { limit: pageSize, start: cursor ?? '0' };
      if (filterId) qs.filter_id = filterId;
      const url = buildUrl(ctx, '/persons', qs);
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
        throw new Error(`Pipedrive GET /persons: ${body.error ?? 'unknown error'}`);
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

// ── Organization ───────────────────────────────────────────────────────────

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

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_pipedrive',
  name: 'Pipedrive',
  description: 'Manage Pipedrive persons, deals and organizations from a flow.',
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
  ],
};

registerForgeBlock(block);
export default block;
