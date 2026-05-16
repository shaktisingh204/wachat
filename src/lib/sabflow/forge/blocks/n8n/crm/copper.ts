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
 *   - person.searchByEmail   POST   /people/fetch_by_email
 *   - company.create         POST   /companies
 *   - opportunity.create     POST   /opportunities
 *
 * Out of scope:
 *   - Task / project / activity resources
 *   - LoadOptions for pipelines and statuses
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

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
  ],
};

registerForgeBlock(block);
export default block;
