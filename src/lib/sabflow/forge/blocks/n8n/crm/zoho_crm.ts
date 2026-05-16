/**
 * Forge block: Zoho CRM
 *
 * Source: n8n-master/packages/nodes-base/nodes/Zoho/ZohoCrm.node.ts
 *   (+ GenericFunctions.ts, descriptions/*)
 * Credential type: 'zoho_crm' — fields: { clientId, clientSecret, refreshToken, baseUrl? }
 *   Auth: exchange refresh token for access token at the Zoho accounts host.
 *
 * Operations covered:
 *   - lead.get            GET    /crm/v2/Leads/{id}
 *   - lead.create         POST   /crm/v2/Leads
 *   - contact.create      POST   /crm/v2/Contacts
 *   - deal.create         POST   /crm/v2/Deals
 *   - account.create      POST   /crm/v2/Accounts
 *
 * Out of scope:
 *   - Access-token caching across runs (we refresh on every call — Zoho
 *     allows ~10 refresh calls per minute which is fine for flow latency).
 *   - LoadOptions for picklists and assignment rules.
 *   - Module-level metadata fetch.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

type ZohoAuth = {
  apiBase: string;
  accessToken: string;
};

function accountsHostFor(apiBase: string): string {
  // Default to Zoho's most common region (.com) unless the API base hints at
  // another datacenter. Users on .eu / .in / .com.au should set their own
  // `baseUrl` in the credential (e.g. https://www.zohoapis.eu).
  try {
    const host = new URL(apiBase).host;
    const m = host.match(/zohoapis\.(.+)$/);
    if (m && m[1]) return `https://accounts.zoho.${m[1]}`;
  } catch {
    /* ignore */
  }
  return 'https://accounts.zoho.com';
}

async function getZohoAuth(ctx: ForgeActionContext): Promise<ZohoAuth> {
  const cred = requireCredential('Zoho CRM', ctx.credential);
  const clientId = cred.clientId;
  const clientSecret = cred.clientSecret;
  const refreshToken = cred.refreshToken;
  const apiBase = (cred.baseUrl || 'https://www.zohoapis.com').replace(/\/+$/, '');
  if (!clientId) throw new Error('Zoho CRM: credential is missing `clientId`');
  if (!clientSecret) throw new Error('Zoho CRM: credential is missing `clientSecret`');
  if (!refreshToken) throw new Error('Zoho CRM: credential is missing `refreshToken`');

  const key = cacheKeyFor('zoho_crm', refreshToken);
  const cached = getCachedToken(key);
  if (cached) return { apiBase, accessToken: cached };

  const accountsHost = accountsHostFor(apiBase);
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: 'Zoho CRM',
    tokenUrl: `${accountsHost}/oauth/v2/token`,
    refreshToken,
    clientId,
    clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return { apiBase, accessToken };
}

async function zohoApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { apiBase, accessToken } = await getZohoAuth(ctx);
  const res = await apiRequest({
    service: 'Zoho CRM',
    method,
    url: `${apiBase}/crm/v2${path}`,
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    json,
  });
  return res.data;
}

function firstRecordId(resp: unknown): string | null {
  const r = resp as { data?: Array<{ details?: { id?: string } }> } | null;
  return r?.data?.[0]?.details?.id ?? null;
}

// ── Lead ───────────────────────────────────────────────────────────────────

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Zoho CRM: leadId is required');
  const data = await zohoApi(ctx, 'GET', `/Leads/${encodeURIComponent(id)}`);
  return { outputs: { lead: data }, logs: [`Zoho lead get → ${id}`] };
}

async function leadCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Last_Name = asString(ctx.options.lastName);
  const Company = asString(ctx.options.company);
  if (!Last_Name) throw new Error('Zoho CRM: lastName is required');
  if (!Company) throw new Error('Zoho CRM: company is required');
  const record: Record<string, unknown> = { Last_Name, Company, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.firstName)) record.First_Name = asString(ctx.options.firstName);
  if (asString(ctx.options.email)) record.Email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) record.Phone = asString(ctx.options.phone);

  const data = await zohoApi(ctx, 'POST', '/Leads', { data: [record] });
  return { outputs: { lead: data, id: firstRecordId(data) }, logs: [`Zoho lead create → ${firstRecordId(data) ?? '?'}`] };
}

// ── Contact ────────────────────────────────────────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Last_Name = asString(ctx.options.lastName);
  if (!Last_Name) throw new Error('Zoho CRM: lastName is required');
  const record: Record<string, unknown> = { Last_Name, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.firstName)) record.First_Name = asString(ctx.options.firstName);
  if (asString(ctx.options.email)) record.Email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) record.Phone = asString(ctx.options.phone);

  const data = await zohoApi(ctx, 'POST', '/Contacts', { data: [record] });
  return {
    outputs: { contact: data, id: firstRecordId(data) },
    logs: [`Zoho contact create → ${firstRecordId(data) ?? '?'}`],
  };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Deal_Name = asString(ctx.options.dealName);
  const Stage = asString(ctx.options.stage);
  if (!Deal_Name) throw new Error('Zoho CRM: dealName is required');
  if (!Stage) throw new Error('Zoho CRM: stage is required');
  const record: Record<string, unknown> = { Deal_Name, Stage, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.amount)) record.Amount = Number(asString(ctx.options.amount));
  if (asString(ctx.options.closingDate)) record.Closing_Date = asString(ctx.options.closingDate);
  if (asString(ctx.options.accountName)) record.Account_Name = asString(ctx.options.accountName);

  const data = await zohoApi(ctx, 'POST', '/Deals', { data: [record] });
  return { outputs: { deal: data, id: firstRecordId(data) }, logs: [`Zoho deal create → ${firstRecordId(data) ?? '?'}`] };
}

// ── Account ────────────────────────────────────────────────────────────────

async function accountCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Account_Name = asString(ctx.options.accountName);
  if (!Account_Name) throw new Error('Zoho CRM: accountName is required');
  const record: Record<string, unknown> = { Account_Name, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.website)) record.Website = asString(ctx.options.website);
  if (asString(ctx.options.phone)) record.Phone = asString(ctx.options.phone);
  if (asString(ctx.options.industry)) record.Industry = asString(ctx.options.industry);

  const data = await zohoApi(ctx, 'POST', '/Accounts', { data: [record] });
  return {
    outputs: { account: data, id: firstRecordId(data) },
    logs: [`Zoho account create → ${firstRecordId(data) ?? '?'}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_zoho_crm',
  name: 'Zoho CRM',
  description: 'Create and fetch Zoho CRM leads, contacts, deals and accounts.',
  iconName: 'LuBriefcase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'zoho_crm' },
  actions: [
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
      description: 'Create a new lead.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'company', label: 'Company', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: leadCreate,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a new contact.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactCreate,
    },
    {
      id: 'deal_create',
      label: 'Create deal',
      description: 'Create a new deal.',
      fields: [
        { id: 'dealName', label: 'Deal name', type: 'text', required: true },
        { id: 'stage', label: 'Stage', type: 'text', required: true, placeholder: 'Qualification' },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'closingDate', label: 'Closing date (YYYY-MM-DD)', type: 'text' },
        { id: 'accountName', label: 'Account name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: dealCreate,
    },
    {
      id: 'account_create',
      label: 'Create account',
      description: 'Create a new account.',
      fields: [
        { id: 'accountName', label: 'Account name', type: 'text', required: true },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'industry', label: 'Industry', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: accountCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
