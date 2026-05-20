/**
 * Forge block: Tapfiliate
 *
 * Source: n8n-master/packages/nodes-base/nodes/Tapfiliate/Tapfiliate.node.ts
 * Credential type: 'tapfiliate' — { apiKey } sent as `Api-Key: <key>` header.
 *
 * Operations covered:
 *   - affiliate.create / get / delete / list
 *   - affiliate_metadata.add / update / remove
 *   - program_affiliate.add / get / list / approve / disapprove
 *   - conversion.create
 *
 * Out of scope (deferred):
 *   - loadOptions for `programId` — n8n's `getPrograms` requires UI plumbing
 *     we haven't ported; users paste the program id (same as the other
 *     "Name or ID" fields in this block).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://api.tapfiliate.com/1.6';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Tapfiliate', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('Tapfiliate: credential is missing `apiKey`');
  return { 'Api-Key': key };
}

function buildUrl(path: string, qs?: Record<string, string | undefined>): string {
  const u = new URL(`${BASE}${path}`);
  if (qs) {
    for (const [k, v] of Object.entries(qs)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
  qs?: Record<string, string | undefined>,
): Promise<unknown> {
  const res = await apiRequest({
    service: 'Tapfiliate',
    method,
    url: buildUrl(path, qs),
    headers: authHeader(ctx),
    json,
  });
  return res.data;
}

// Tapfiliate paginates by `?page=N` and signals next via `Link` header containing `rel="next"`.
async function listAll(
  ctx: ForgeActionContext,
  path: string,
  baseQs: Record<string, string | undefined>,
  maxItems?: number,
): Promise<unknown[]> {
  return paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ?? '1';
      const res = await apiRequest({
        service: 'Tapfiliate',
        method: 'GET',
        url: buildUrl(path, { ...baseQs, page }),
        headers: authHeader(ctx),
      });
      const items = Array.isArray(res.data) ? (res.data as unknown[]) : [];
      const link = res.headers.get('link') ?? '';
      const hasNext = /\brel="?next"?/i.test(link);
      const nextCursor = hasNext ? String(Number(page) + 1) : undefined;
      return { items, nextCursor };
    },
  });
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

async function affiliateDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.affiliateId);
  if (!id) throw new Error('Tapfiliate: affiliateId is required');
  await call(ctx, 'DELETE', `/affiliates/${encodeURIComponent(id)}/`);
  return { outputs: { success: true }, logs: [`Tapfiliate affiliate delete → ${id}`] };
}

async function affiliateList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  // n8n exposes `filters` as `affiliate_group_id`, `click_id`, `email`,
  // `parent_id`, `referral_code`, `source_id` — mirrored 1:1 so saved
  // workflows can be re-imported.
  const qs: Record<string, string | undefined> = {
    affiliate_group_id: asString(ctx.options.affiliateGroupId) || undefined,
    click_id: asString(ctx.options.clickId) || undefined,
    email: asString(ctx.options.email) || undefined,
    parent_id: asString(ctx.options.parentId) || undefined,
    referral_code: asString(ctx.options.referralCode) || undefined,
    source_id: asString(ctx.options.sourceId) || undefined,
  };
  const returnAll = ctx.options.returnAll === true;
  const limit = asNumber(ctx.options.limit);
  const items = returnAll
    ? await listAll(ctx, '/affiliates/', qs)
    : await listAll(ctx, '/affiliates/', qs, limit ?? 100);
  return { outputs: { affiliates: items, count: items.length }, logs: [`Tapfiliate affiliate list → ${items.length}`] };
}

// PUT /affiliates/{id}/meta-data/{key} — n8n loops over a `metadataUi` collection;
// our `key-value-list` field already gives the same shape, so iterate it.
async function metadataAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.affiliateId);
  if (!id) throw new Error('Tapfiliate: affiliateId is required');
  const raw = ctx.options.metadata;
  const entries: Array<{ key: string; value: string }> = Array.isArray(raw)
    ? (raw as Array<{ key?: unknown; value?: unknown }>)
        .map((e) => ({ key: asString(e?.key), value: asString(e?.value) }))
        .filter((e) => e.key)
    : [];
  if (entries.length === 0) throw new Error('Tapfiliate: metadata must contain at least one key');
  for (const { key, value } of entries) {
    await call(ctx, 'PUT', `/affiliates/${encodeURIComponent(id)}/meta-data/${encodeURIComponent(key)}/`, { value });
  }
  return { outputs: { success: true, count: entries.length }, logs: [`Tapfiliate metadata add → ${entries.length}`] };
}

async function metadataUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.affiliateId);
  const key = asString(ctx.options.key);
  const value = asString(ctx.options.value);
  if (!id) throw new Error('Tapfiliate: affiliateId is required');
  if (!key) throw new Error('Tapfiliate: key is required');
  // n8n hits PUT /affiliates/{id}/meta-data/ with { [key]: value } — mirror that exact shape.
  const data = await call(ctx, 'PUT', `/affiliates/${encodeURIComponent(id)}/meta-data/`, { [key]: value });
  return { outputs: { result: data }, logs: [`Tapfiliate metadata update → ${key}`] };
}

async function metadataRemove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.affiliateId);
  const key = asString(ctx.options.key);
  if (!id) throw new Error('Tapfiliate: affiliateId is required');
  if (!key) throw new Error('Tapfiliate: key is required');
  await call(ctx, 'DELETE', `/affiliates/${encodeURIComponent(id)}/meta-data/${encodeURIComponent(key)}/`);
  return { outputs: { success: true }, logs: [`Tapfiliate metadata remove → ${key}`] };
}

async function programAffiliateAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const programId = asString(ctx.options.programId);
  const affiliateId = asString(ctx.options.affiliateId);
  if (!programId) throw new Error('Tapfiliate: programId is required');
  if (!affiliateId) throw new Error('Tapfiliate: affiliateId is required');
  const body: Record<string, unknown> = { affiliate: { id: affiliateId } };
  if (ctx.options.approved !== undefined && ctx.options.approved !== '') {
    body.approved = ctx.options.approved === true || ctx.options.approved === 'true';
  }
  const coupon = asString(ctx.options.coupon);
  if (coupon) body.coupon = coupon;
  const data = await call(ctx, 'POST', `/programs/${encodeURIComponent(programId)}/affiliates/`, body);
  return { outputs: { programAffiliate: data }, logs: [`Tapfiliate program-affiliate add → ${programId}/${affiliateId}`] };
}

async function programAffiliateApprove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const programId = asString(ctx.options.programId);
  const affiliateId = asString(ctx.options.affiliateId);
  if (!programId) throw new Error('Tapfiliate: programId is required');
  if (!affiliateId) throw new Error('Tapfiliate: affiliateId is required');
  const data = await call(
    ctx,
    'PUT',
    `/programs/${encodeURIComponent(programId)}/affiliates/${encodeURIComponent(affiliateId)}/approved/`,
  );
  return { outputs: { result: data }, logs: [`Tapfiliate program-affiliate approve → ${affiliateId}`] };
}

async function programAffiliateDisapprove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const programId = asString(ctx.options.programId);
  const affiliateId = asString(ctx.options.affiliateId);
  if (!programId) throw new Error('Tapfiliate: programId is required');
  if (!affiliateId) throw new Error('Tapfiliate: affiliateId is required');
  await call(
    ctx,
    'DELETE',
    `/programs/${encodeURIComponent(programId)}/affiliates/${encodeURIComponent(affiliateId)}/approved/`,
  );
  return { outputs: { success: true }, logs: [`Tapfiliate program-affiliate disapprove → ${affiliateId}`] };
}

async function programAffiliateGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const programId = asString(ctx.options.programId);
  const affiliateId = asString(ctx.options.affiliateId);
  if (!programId) throw new Error('Tapfiliate: programId is required');
  if (!affiliateId) throw new Error('Tapfiliate: affiliateId is required');
  const data = await call(
    ctx,
    'GET',
    `/programs/${encodeURIComponent(programId)}/affiliates/${encodeURIComponent(affiliateId)}/`,
  );
  return { outputs: { programAffiliate: data }, logs: [`Tapfiliate program-affiliate get → ${affiliateId}`] };
}

async function programAffiliateList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const programId = asString(ctx.options.programId);
  if (!programId) throw new Error('Tapfiliate: programId is required');
  const qs: Record<string, string | undefined> = {
    affiliate_group_id: asString(ctx.options.affiliateGroupId) || undefined,
    email: asString(ctx.options.email) || undefined,
    parent_id: asString(ctx.options.parentId) || undefined,
    source_id: asString(ctx.options.sourceId) || undefined,
  };
  const returnAll = ctx.options.returnAll === true;
  const limit = asNumber(ctx.options.limit);
  const path = `/programs/${encodeURIComponent(programId)}/affiliates/`;
  const items = returnAll ? await listAll(ctx, path, qs) : await listAll(ctx, path, qs, limit ?? 100);
  return {
    outputs: { programAffiliates: items, count: items.length },
    logs: [`Tapfiliate program-affiliate list → ${items.length}`],
  };
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
      id: 'affiliate_delete',
      label: 'Delete affiliate',
      description: 'Delete an affiliate by id.',
      fields: [
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
      ],
      run: affiliateDelete,
    },
    {
      id: 'affiliate_list',
      label: 'List affiliates',
      description: 'List affiliates with optional filters.',
      fields: [
        { id: 'returnAll', label: 'Return all', type: 'toggle', defaultValue: false },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
        { id: 'affiliateGroupId', label: 'Affiliate group ID', type: 'text' },
        { id: 'clickId', label: 'Click ID', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'parentId', label: 'Parent ID', type: 'text' },
        { id: 'referralCode', label: 'Referral code', type: 'text' },
        { id: 'sourceId', label: 'Source ID', type: 'text' },
      ],
      run: affiliateList,
    },
    {
      id: 'metadata_add',
      label: 'Add affiliate metadata',
      description: 'PUT one or more meta-data keys onto an affiliate.',
      fields: [
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
        { id: 'metadata', label: 'Metadata', type: 'key-value-list', required: true },
      ],
      run: metadataAdd,
    },
    {
      id: 'metadata_update',
      label: 'Update affiliate metadata',
      description: 'Update a single meta-data key on an affiliate.',
      fields: [
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'text', required: true },
      ],
      run: metadataUpdate,
    },
    {
      id: 'metadata_remove',
      label: 'Remove affiliate metadata',
      description: 'Delete a single meta-data key from an affiliate.',
      fields: [
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
        { id: 'key', label: 'Key', type: 'text', required: true },
      ],
      run: metadataRemove,
    },
    {
      id: 'program_affiliate_add',
      label: 'Add affiliate to program',
      description: 'Attach an affiliate to a program.',
      fields: [
        { id: 'programId', label: 'Program ID', type: 'text', required: true },
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
        { id: 'approved', label: 'Approved', type: 'toggle', defaultValue: true },
        { id: 'coupon', label: 'Coupon', type: 'text' },
      ],
      run: programAffiliateAdd,
    },
    {
      id: 'program_affiliate_approve',
      label: 'Approve program affiliate',
      description: 'Approve an affiliate for a specific program.',
      fields: [
        { id: 'programId', label: 'Program ID', type: 'text', required: true },
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
      ],
      run: programAffiliateApprove,
    },
    {
      id: 'program_affiliate_disapprove',
      label: 'Disapprove program affiliate',
      description: 'Disapprove an affiliate for a specific program.',
      fields: [
        { id: 'programId', label: 'Program ID', type: 'text', required: true },
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
      ],
      run: programAffiliateDisapprove,
    },
    {
      id: 'program_affiliate_get',
      label: 'Get program affiliate',
      description: 'Fetch a single affiliate within a program.',
      fields: [
        { id: 'programId', label: 'Program ID', type: 'text', required: true },
        { id: 'affiliateId', label: 'Affiliate ID', type: 'text', required: true },
      ],
      run: programAffiliateGet,
    },
    {
      id: 'program_affiliate_list',
      label: 'List program affiliates',
      description: 'List affiliates inside a program.',
      fields: [
        { id: 'programId', label: 'Program ID', type: 'text', required: true },
        { id: 'returnAll', label: 'Return all', type: 'toggle', defaultValue: false },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
        { id: 'affiliateGroupId', label: 'Affiliate group ID', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'parentId', label: 'Parent ID', type: 'text' },
        { id: 'sourceId', label: 'Source ID', type: 'text' },
      ],
      run: programAffiliateList,
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
