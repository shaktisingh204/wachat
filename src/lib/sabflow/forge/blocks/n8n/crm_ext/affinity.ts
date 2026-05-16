/**
 * Forge block: Affinity
 *
 * Source: n8n-master/packages/nodes-base/nodes/Affinity/Affinity.node.ts
 * Credential type: 'affinity' — fields: { apiKey }
 *
 * Affinity uses HTTP Basic with an empty username — `:<apiKey>`.
 *
 * Operations (subset):
 *   - person.list           GET  /persons
 *   - person.get            GET  /persons/{id}
 *   - person.create         POST /persons
 *   - organization.create   POST /organizations
 *   - opportunity.list      GET  /opportunities
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.affinity.co';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Affinity', ctx.credential);
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('Affinity: credential is missing `apiKey` field');
  const basic = btoa(`:${apiKey}`);
  return { Authorization: `Basic ${basic}` };
}

async function affinityApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Affinity',
    method,
    url: `${BASE}${path}`,
    headers: authHeaders(ctx),
    json,
  });
  return res.data;
}

function parseEmails(raw: unknown): string[] {
  const s = asString(raw).trim();
  if (!s) return [];
  // Allow JSON array or comma-separated.
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v.map(asString).filter(Boolean);
  } catch {
    /* fall through */
  }
  return s
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

function parseOrganizationIds(raw: unknown): number[] {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return v.map(Number).filter(Number.isFinite);
  } catch {
    /* fall through */
  }
  return s
    .split(',')
    .map((p) => Number(p.trim()))
    .filter(Number.isFinite);
}

// ── Person actions ─────────────────────────────────────────────────────────

async function personList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const qs = new URLSearchParams();
  const term = asString(ctx.options.term);
  const pageSize = asString(ctx.options.pageSize);
  if (term) qs.set('term', term);
  if (pageSize) qs.set('page_size', pageSize);
  const path = qs.size ? `/persons?${qs.toString()}` : '/persons';
  const data = await affinityApi(ctx, 'GET', path);
  return { outputs: { result: data }, logs: ['Affinity person list'] };
}

async function personGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Affinity: personId is required');
  const data = await affinityApi(ctx, 'GET', `/persons/${encodeURIComponent(id)}`);
  return { outputs: { person: data }, logs: [`Affinity person get → ${id}`] };
}

async function personCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const emails = parseEmails(ctx.options.emails);
  if (!firstName) throw new Error('Affinity: firstName is required');
  if (!lastName) throw new Error('Affinity: lastName is required');
  if (emails.length === 0) throw new Error('Affinity: at least one email is required');

  const body: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    emails,
  };
  const orgIds = parseOrganizationIds(ctx.options.organizationIds);
  if (orgIds.length) body.organization_ids = orgIds;

  const data = (await affinityApi(ctx, 'POST', '/persons', body)) as { id?: number } | null;
  return {
    outputs: { person: data, id: data?.id ?? null },
    logs: [`Affinity person create → ${data?.id ?? '?'}`],
  };
}

// ── Organization / opportunity actions ────────────────────────────────────

async function organizationCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Affinity: name is required');
  const body: Record<string, unknown> = { name };
  const domain = asString(ctx.options.domain);
  if (domain) body.domain = domain;
  const personIds = parseOrganizationIds(ctx.options.personIds); // reuse comma/JSON parser
  if (personIds.length) body.person_ids = personIds;

  const data = (await affinityApi(ctx, 'POST', '/organizations', body)) as
    | { id?: number }
    | null;
  return {
    outputs: { organization: data, id: data?.id ?? null },
    logs: [`Affinity organization create → ${data?.id ?? '?'}`],
  };
}

async function opportunityList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const qs = new URLSearchParams();
  const term = asString(ctx.options.term);
  const pageSize = asString(ctx.options.pageSize);
  if (term) qs.set('term', term);
  if (pageSize) qs.set('page_size', pageSize);
  const path = qs.size ? `/opportunities?${qs.toString()}` : '/opportunities';
  const data = await affinityApi(ctx, 'GET', path);
  return { outputs: { result: data }, logs: ['Affinity opportunity list'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_affinity',
  name: 'Affinity',
  description: 'Manage Affinity persons, organizations and opportunities.',
  iconName: 'LuNetwork',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'affinity' },
  actions: [
    {
      id: 'person_list',
      label: 'List persons',
      fields: [
        { id: 'term', label: 'Search term', type: 'text' },
        { id: 'pageSize', label: 'Page size', type: 'number', defaultValue: 50 },
      ],
      run: personList,
    },
    {
      id: 'person_get',
      label: 'Get person',
      fields: [{ id: 'personId', label: 'Person ID', type: 'text', required: true }],
      run: personGet,
    },
    {
      id: 'person_create',
      label: 'Create person',
      fields: [
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        {
          id: 'emails',
          label: 'Emails',
          type: 'text',
          required: true,
          helperText: 'Comma-separated or JSON array.',
        },
        {
          id: 'organizationIds',
          label: 'Organization IDs',
          type: 'text',
          helperText: 'Comma-separated numeric ids.',
        },
      ],
      run: personCreate,
    },
    {
      id: 'organization_create',
      label: 'Create organization',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'domain', label: 'Domain', type: 'text' },
        {
          id: 'personIds',
          label: 'Person IDs',
          type: 'text',
          helperText: 'Comma-separated numeric ids.',
        },
      ],
      run: organizationCreate,
    },
    {
      id: 'opportunity_list',
      label: 'List opportunities',
      fields: [
        { id: 'term', label: 'Search term', type: 'text' },
        { id: 'pageSize', label: 'Page size', type: 'number', defaultValue: 50 },
      ],
      run: opportunityList,
    },
  ],
};

registerForgeBlock(block);
export default block;
