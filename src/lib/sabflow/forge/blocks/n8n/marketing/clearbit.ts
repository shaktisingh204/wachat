/**
 * Forge block: Clearbit
 *
 * Source: n8n-master/packages/nodes-base/nodes/Clearbit/Clearbit.node.ts
 * Credential type: 'clearbit' — { apiKey } sent as Bearer token.
 *
 * Operations covered:
 *   - person.get          (Enrichment API by email)
 *   - company.get         (Enrichment API by domain)
 *   - company.autocomplete (Autocomplete API suggestions by name)
 *   - discovery.list      (Discovery API search)
 *
 * Out of scope (deferred):
 *   - reveal / prospector endpoints — Clearbit gated these behind paid
 *     add-ons that most flow authors won't have access to; revisit on demand.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Clearbit', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('Clearbit: credential is missing `apiKey`');
  return { Authorization: `Bearer ${key}` };
}

async function call(
  ctx: ForgeActionContext,
  api: 'person' | 'company' | 'discovery' | 'autocomplete',
  path: string,
  query?: Record<string, string | undefined>,
): Promise<unknown> {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
        .join('&')
    : '';
  const res = await apiRequest({
    service: 'Clearbit',
    method: 'GET',
    url: `https://${api}.clearbit.com${path}${qs}`,
    headers: authHeader(ctx),
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function personGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Clearbit: email is required');
  const data = await call(ctx, 'person', '/v2/people/find', { email });
  return { outputs: { person: data }, logs: [`Clearbit person → ${email}`] };
}

async function companyGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('Clearbit: domain is required');
  const data = await call(ctx, 'company', '/v2/companies/find', { domain });
  return { outputs: { company: data }, logs: [`Clearbit company → ${domain}`] };
}

async function companyAutocomplete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Clearbit: name is required');
  // Autocomplete API mirrors n8n's `'autocomplete'` host token; same Bearer header.
  const data = await call(ctx, 'autocomplete', '/v1/companies/suggest', { query: name });
  return { outputs: { result: data }, logs: [`Clearbit company autocomplete → ${name}`] };
}

async function discoveryList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Clearbit: query is required');
  const data = await call(ctx, 'discovery', '/v1/companies/search', {
    query,
    limit: asString(ctx.options.limit) || undefined,
    page: asString(ctx.options.page) || undefined,
  });
  return { outputs: { result: data }, logs: [`Clearbit discovery → ${query}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_clearbit',
  name: 'Clearbit',
  description: 'Enrich people, companies and discover new accounts with Clearbit.',
  iconName: 'LuBuilding2',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'clearbit',
  },
  actions: [
    {
      id: 'person_get',
      label: 'Get person',
      description: 'Enrich a person from their email address.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: personGet,
    },
    {
      id: 'company_get',
      label: 'Get company',
      description: 'Enrich a company from its domain.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
      ],
      run: companyGet,
    },
    {
      id: 'company_autocomplete',
      label: 'Autocomplete companies',
      description: 'Suggest companies matching a partial name.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'segm' },
      ],
      run: companyAutocomplete,
    },
    {
      id: 'discovery_list',
      label: 'Discover companies',
      description: 'Search for companies matching a Discovery API query.',
      fields: [
        { id: 'query', label: 'Query', type: 'text', required: true, placeholder: 'tech:salesforce employees:>100' },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: discoveryList,
    },
  ],
};

registerForgeBlock(block);
export default block;
