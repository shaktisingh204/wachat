/**
 * Forge block: Tapfiliate
 *
 * Source: n8n-master/packages/nodes-base/nodes/Tapfiliate/Tapfiliate.node.ts
 * Credential type: 'tapfiliate' — { apiKey } sent as `Api-Key: <key>` header.
 *
 * Operations covered:
 *   - affiliate.create
 *   - affiliate.get
 *   - conversion.create
 *
 * Out of scope (deferred):
 *   - program-affiliate add/remove, affiliate-metadata
 *   - paginated listing
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.tapfiliate.com/1.6';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Tapfiliate', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('Tapfiliate: credential is missing `apiKey`');
  return { 'Api-Key': key };
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Tapfiliate',
    method,
    url: `${BASE}${path}`,
    headers: authHeader(ctx),
    json,
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function affiliateCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstname = asString(ctx.options.firstname);
  const lastname = asString(ctx.options.lastname);
  const email = asString(ctx.options.email);
  if (!firstname) throw new Error('Tapfiliate: firstname is required');
  if (!lastname) throw new Error('Tapfiliate: lastname is required');
  if (!email) throw new Error('Tapfiliate: email is required');
  const body: Record<string, unknown> = { firstname, lastname, email };
  const company = asString(ctx.options.company);
  if (company) body.company = company;
  const data = await call(ctx, 'POST', '/affiliates/', body);
  return { outputs: { affiliate: data }, logs: [`Tapfiliate affiliate create → ${email}`] };
}

async function affiliateGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.affiliateId);
  if (!id) throw new Error('Tapfiliate: affiliateId is required');
  const data = await call(ctx, 'GET', `/affiliates/${encodeURIComponent(id)}/`);
  return { outputs: { affiliate: data }, logs: [`Tapfiliate affiliate get → ${id}`] };
}

async function conversionCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const clickId = asString(ctx.options.clickId);
  const externalId = asString(ctx.options.externalId);
  if (!clickId) throw new Error('Tapfiliate: clickId is required');
  if (!externalId) throw new Error('Tapfiliate: externalId is required');
  const body: Record<string, unknown> = {
    click_id: clickId,
    external_id: externalId,
  };
  const amount = asNumber(ctx.options.amount);
  if (amount !== undefined) body.amount = amount;
  const currency = asString(ctx.options.currency);
  if (currency) body.currency = currency;
  const data = await call(ctx, 'POST', '/conversions/', body);
  return { outputs: { conversion: data }, logs: [`Tapfiliate conversion → ${externalId}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_tapfiliate',
  name: 'Tapfiliate',
  description: 'Manage affiliates and record conversions in Tapfiliate.',
  iconName: 'LuHandshake',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'tapfiliate',
  },
  actions: [
    {
      id: 'affiliate_create',
      label: 'Create affiliate',
      description: 'Create a new affiliate in the program.',
      fields: [
        { id: 'firstname', label: 'First name', type: 'text', required: true },
        { id: 'lastname', label: 'Last name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'company', label: 'Company', type: 'text' },
      ],
      run: affiliateCreate,
    },
    {
      id: 'affiliate_get',
      label: 'Get affiliate',
      description: 'Fetch an affiliate by id.',
      fields: [
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
      ],
      run: affiliateGet,
    },
    {
      id: 'conversion_create',
      label: 'Create conversion',
      description: 'Record a new conversion against a click id.',
      fields: [
        { id: 'clickId', label: 'Click ID', type: 'text', required: true },
        { id: 'externalId', label: 'External ID', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'currency', label: 'Currency (ISO 4217)', type: 'text', placeholder: 'USD' },
      ],
      run: conversionCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
