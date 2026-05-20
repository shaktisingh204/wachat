/**
 * Forge block: Hunter
 *
 * Source: n8n-master/packages/nodes-base/nodes/Hunter/Hunter.node.ts
 * Credential type: 'hunter' — { apiKey } sent as query param `api_key`.
 *
 * Operations covered:
 *   - domainSearch        (single page)
 *   - domainSearchAll     (walks offset/limit until meta.results is reached)
 *   - emailFinder
 *   - emailVerifier
 *
 * Out of scope (deferred):
 *   - email-count / leads / leads-list endpoints — those need their own
 *     credential plan and aren't covered by the standard Hunter API key.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.hunter.io/v2';

function getKey(ctx: ForgeActionContext): string {
  const cred = requireCredential('Hunter', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('Hunter: credential is missing `apiKey`');
  return key;
}

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === null) continue;
    usp.set(k, String(v));
  }
  return `${BASE}${path}?${usp.toString()}`;
}

async function call(ctx: ForgeActionContext, path: string, params: Record<string, string | number | undefined>): Promise<unknown> {
  const url = buildUrl(path, { ...params, api_key: getKey(ctx) });
  const res = await apiRequest({ service: 'Hunter', method: 'GET', url });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function domainSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  const company = asString(ctx.options.company);
  if (!domain && !company) throw new Error('Hunter: domain or company is required');
  const data = await call(ctx, '/domain-search', {
    domain: domain || undefined,
    company: company || undefined,
    limit: asNumber(ctx.options.limit),
    offset: asNumber(ctx.options.offset),
    type: asString(ctx.options.type) || undefined,
  });
  return { outputs: { result: data }, logs: [`Hunter domain search → ${domain || company}`] };
}

async function domainSearchAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  const company = asString(ctx.options.company);
  if (!domain && !company) throw new Error('Hunter: domain or company is required');
  const type = asString(ctx.options.type) || undefined;
  const maxItems = asNumber(ctx.options.maxItems) ?? 200;

  // Hunter pagination is offset/limit-based and exposes a `meta.results` total —
  // we encode the offset directly into the cursor (string) and bail when the
  // returned page is empty or we've hit `meta.results`.
  const emails = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const offset = cursor ? Number(cursor) : 0;
      const data = (await call(ctx, '/domain-search', {
        domain: domain || undefined,
        company: company || undefined,
        type,
        limit: 100,
        offset,
      })) as { data?: { emails?: unknown[] }; meta?: { results?: number } };
      const items = data.data?.emails ?? [];
      const total = data.meta?.results ?? 0;
      const next = offset + items.length;
      const nextCursor = items.length > 0 && next < total ? String(next) : undefined;
      return { items, nextCursor };
    },
  });
  return { outputs: { emails, count: emails.length }, logs: [`Hunter domain search all → ${emails.length}`] };
}

async function emailFinder(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (!domain) throw new Error('Hunter: domain is required');
  if (!firstName || !lastName) {
    throw new Error('Hunter: firstName and lastName are required');
  }
  const data = await call(ctx, '/email-finder', {
    domain,
    first_name: firstName,
    last_name: lastName,
  });
  return { outputs: { result: data }, logs: [`Hunter email finder → ${firstName} ${lastName}@${domain}`] };
}

async function emailVerifier(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Hunter: email is required');
  const data = await call(ctx, '/email-verifier', { email });
  return { outputs: { result: data }, logs: [`Hunter email verify → ${email}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_hunter',
  name: 'Hunter',
  description: 'Find and verify professional email addresses with Hunter.io.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'hunter',
  },
  actions: [
    {
      id: 'domain_search',
      label: 'Domain search',
      description: 'List email addresses for a domain or company.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'offset', label: 'Offset', type: 'number' },
        {
          id: 'type',
          label: 'Email type',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'Personal', value: 'personal' },
            { label: 'Generic', value: 'generic' },
          ],
        },
      ],
      run: domainSearch,
    },
    {
      id: 'domain_search_all',
      label: 'Domain search (all)',
      description: 'Walk every page of domain-search results up to a cap.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'maxItems', label: 'Max items', type: 'number', defaultValue: 200 },
        {
          id: 'type',
          label: 'Email type',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'Personal', value: 'personal' },
            { label: 'Generic', value: 'generic' },
          ],
        },
      ],
      run: domainSearchAll,
    },
    {
      id: 'email_finder',
      label: 'Email finder',
      description: 'Find a person’s email address from a domain and name.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
      ],
      run: emailFinder,
    },
    {
      id: 'email_verifier',
      label: 'Email verifier',
      description: 'Verify deliverability of an email address.',
      fields: [
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: emailVerifier,
    },
  ],
};

registerForgeBlock(block);
export default block;
