/**
 * Forge block: Zoho CRM
 *
 * Source: n8n-master/packages/nodes-base/nodes/Zoho/ZohoCrm.node.ts
 *   (+ GenericFunctions.ts, descriptions/*)
 * Credential type: 'zoho_crm' — fields: { clientId, clientSecret, refreshToken, baseUrl? }
 *   Auth: exchange refresh token for access token at the Zoho accounts host.
 *
 * Operations covered:
 *   - lead.get / lead.create / lead.update / lead.delete / lead.upsert / lead.list_all / lead.search
 *   - contact.get / contact.create / contact.update / contact.delete / contact.upsert / contact.list_all / contact.search
 *   - deal.get / deal.create / deal.update / deal.delete / deal.upsert / deal.list_all / deal.search
 *   - account.get / account.create / account.update / account.delete / account.upsert / account.list_all / account.search
 *
 * Out of scope:
 *   - LoadOptions for picklists and assignment rules.
 *   - Module-level metadata fetch (getFields) — surface via raw HTTP if needed.
 *   - Product attach / Inventory module sub-resources.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';
import { paginateAll } from '../_shared/paginate';

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
  qs?: Record<string, string>,
): Promise<unknown> {
  const { apiBase, accessToken } = await getZohoAuth(ctx);
  const url = new URL(`${apiBase}/crm/v2${path}`);
  if (qs) {
    for (const [k, v] of Object.entries(qs)) {
      if (v !== '') url.searchParams.set(k, v);
    }
  }
  const res = await apiRequest({
    service: 'Zoho CRM',
    method,
    url: url.toString(),
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    json,
  });
  return res.data;
}

function firstRecordId(resp: unknown): string | null {
  const r = resp as { data?: Array<{ details?: { id?: string } }> } | null;
  return r?.data?.[0]?.details?.id ?? null;
}

/**
 * Walk Zoho's page/per_page pagination. The list response payload is
 * `{ data: [...], info: { more_records: boolean, page, per_page } }`.
 * Per n8n's zohoApiRequestAllItems, the per_page cap is 200.
 */
async function zohoListAll(
  ctx: ForgeActionContext,
  module: string,
  maxItems: number,
  extraQs?: Record<string, string>,
): Promise<unknown[]> {
  const { apiBase, accessToken } = await getZohoAuth(ctx);
  return paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ?? '1';
      const url = new URL(`${apiBase}/crm/v2/${module}`);
      url.searchParams.set('per_page', '200');
      url.searchParams.set('page', page);
      if (extraQs) {
        for (const [k, v] of Object.entries(extraQs)) {
          if (v !== '') url.searchParams.set(k, v);
        }
      }
      const res = await apiRequest({
        service: 'Zoho CRM',
        method: 'GET',
        url: url.toString(),
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const body = res.data as {
        data?: unknown[];
        info?: { more_records?: boolean };
      } | null;
      const items = (body?.data ?? []) as unknown[];
      const nextCursor = body?.info?.more_records ? String(Number(page) + 1) : undefined;
      return { items, nextCursor };
    },
  });
}

// ── Generic per-module helpers ─────────────────────────────────────────────

type Module = 'Leads' | 'Contacts' | 'Deals' | 'Accounts';

async function moduleGet(
  ctx: ForgeActionContext,
  module: Module,
  id: string,
): Promise<unknown> {
  return zohoApi(ctx, 'GET', `/${module}/${encodeURIComponent(id)}`);
}

async function moduleUpdate(
  ctx: ForgeActionContext,
  module: Module,
  id: string,
  record: Record<string, unknown>,
): Promise<unknown> {
  return zohoApi(ctx, 'PUT', `/${module}/${encodeURIComponent(id)}`, { data: [record] });
}

async function moduleDelete(
  ctx: ForgeActionContext,
  module: Module,
  id: string,
): Promise<unknown> {
  return zohoApi(ctx, 'DELETE', `/${module}/${encodeURIComponent(id)}`);
}

async function moduleUpsert(
  ctx: ForgeActionContext,
  module: Module,
  record: Record<string, unknown>,
): Promise<unknown> {
  return zohoApi(ctx, 'POST', `/${module}/upsert`, { data: [record] });
}

async function moduleSearch(
  ctx: ForgeActionContext,
  module: Module,
  qs: Record<string, string>,
): Promise<unknown> {
  // Zoho search supports criteria / email / phone / word query strings.
  return zohoApi(ctx, 'GET', `/${module}/search`, undefined, qs);
}

function buildSearchQs(ctx: ForgeActionContext): Record<string, string> {
  const qs: Record<string, string> = {};
  if (asString(ctx.options.criteria)) qs.criteria = asString(ctx.options.criteria);
  if (asString(ctx.options.email)) qs.email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) qs.phone = asString(ctx.options.phone);
  if (asString(ctx.options.word)) qs.word = asString(ctx.options.word);
  if (Object.keys(qs).length === 0) {
    throw new Error('Zoho CRM: provide at least one of criteria, email, phone or word');
  }
  return qs;
}

function requireOpt(ctx: ForgeActionContext, fieldId: string, label: string): string {
  const v = asString(ctx.options[fieldId]);
  if (!v) throw new Error(`Zoho CRM: ${label} is required`);
  return v;
}

// ── Lead ───────────────────────────────────────────────────────────────────

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'leadId', 'leadId');
  const data = await moduleGet(ctx, 'Leads', id);
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

async function leadUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'leadId', 'leadId');
  const record: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.lastName)) record.Last_Name = asString(ctx.options.lastName);
  if (asString(ctx.options.firstName)) record.First_Name = asString(ctx.options.firstName);
  if (asString(ctx.options.company)) record.Company = asString(ctx.options.company);
  if (asString(ctx.options.email)) record.Email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) record.Phone = asString(ctx.options.phone);
  if (Object.keys(record).length === 0) {
    throw new Error('Zoho CRM: at least one updatable field must be provided');
  }
  const data = await moduleUpdate(ctx, 'Leads', id, record);
  return { outputs: { lead: data, id: firstRecordId(data) ?? id }, logs: [`Zoho lead update → ${id}`] };
}

async function leadDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'leadId', 'leadId');
  const data = await moduleDelete(ctx, 'Leads', id);
  return { outputs: { result: data, id }, logs: [`Zoho lead delete → ${id}`] };
}

async function leadUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Last_Name = asString(ctx.options.lastName);
  const Company = asString(ctx.options.company);
  if (!Last_Name) throw new Error('Zoho CRM: lastName is required');
  if (!Company) throw new Error('Zoho CRM: company is required');
  const record: Record<string, unknown> = { Last_Name, Company, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.email)) record.Email = asString(ctx.options.email);
  const data = await moduleUpsert(ctx, 'Leads', record);
  return { outputs: { lead: data, id: firstRecordId(data) }, logs: [`Zoho lead upsert → ${firstRecordId(data) ?? '?'}`] };
}

async function leadListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const leads = await zohoListAll(ctx, 'Leads', maxItems);
  return { outputs: { leads, count: leads.length }, logs: [`Zoho lead list all → ${leads.length}`] };
}

async function leadSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await moduleSearch(ctx, 'Leads', buildSearchQs(ctx));
  return { outputs: { result: data }, logs: ['Zoho lead search'] };
}

// ── Contact ────────────────────────────────────────────────────────────────

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'contactId', 'contactId');
  const data = await moduleGet(ctx, 'Contacts', id);
  return { outputs: { contact: data }, logs: [`Zoho contact get → ${id}`] };
}

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

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'contactId', 'contactId');
  const record: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.lastName)) record.Last_Name = asString(ctx.options.lastName);
  if (asString(ctx.options.firstName)) record.First_Name = asString(ctx.options.firstName);
  if (asString(ctx.options.email)) record.Email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) record.Phone = asString(ctx.options.phone);
  if (Object.keys(record).length === 0) {
    throw new Error('Zoho CRM: at least one updatable field must be provided');
  }
  const data = await moduleUpdate(ctx, 'Contacts', id, record);
  return { outputs: { contact: data, id: firstRecordId(data) ?? id }, logs: [`Zoho contact update → ${id}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'contactId', 'contactId');
  const data = await moduleDelete(ctx, 'Contacts', id);
  return { outputs: { result: data, id }, logs: [`Zoho contact delete → ${id}`] };
}

async function contactUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Last_Name = asString(ctx.options.lastName);
  if (!Last_Name) throw new Error('Zoho CRM: lastName is required');
  const record: Record<string, unknown> = { Last_Name, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.email)) record.Email = asString(ctx.options.email);
  const data = await moduleUpsert(ctx, 'Contacts', record);
  return { outputs: { contact: data, id: firstRecordId(data) }, logs: [`Zoho contact upsert → ${firstRecordId(data) ?? '?'}`] };
}

async function contactListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const items = await zohoListAll(ctx, 'Contacts', maxItems);
  return { outputs: { contacts: items, count: items.length }, logs: [`Zoho contact list all → ${items.length}`] };
}

async function contactSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await moduleSearch(ctx, 'Contacts', buildSearchQs(ctx));
  return { outputs: { result: data }, logs: ['Zoho contact search'] };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'dealId', 'dealId');
  const data = await moduleGet(ctx, 'Deals', id);
  return { outputs: { deal: data }, logs: [`Zoho deal get → ${id}`] };
}

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

async function dealUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'dealId', 'dealId');
  const record: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.dealName)) record.Deal_Name = asString(ctx.options.dealName);
  if (asString(ctx.options.stage)) record.Stage = asString(ctx.options.stage);
  if (asString(ctx.options.amount)) record.Amount = Number(asString(ctx.options.amount));
  if (asString(ctx.options.closingDate)) record.Closing_Date = asString(ctx.options.closingDate);
  if (Object.keys(record).length === 0) {
    throw new Error('Zoho CRM: at least one updatable field must be provided');
  }
  const data = await moduleUpdate(ctx, 'Deals', id, record);
  return { outputs: { deal: data, id: firstRecordId(data) ?? id }, logs: [`Zoho deal update → ${id}`] };
}

async function dealDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'dealId', 'dealId');
  const data = await moduleDelete(ctx, 'Deals', id);
  return { outputs: { result: data, id }, logs: [`Zoho deal delete → ${id}`] };
}

async function dealUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Deal_Name = asString(ctx.options.dealName);
  const Stage = asString(ctx.options.stage);
  if (!Deal_Name) throw new Error('Zoho CRM: dealName is required');
  if (!Stage) throw new Error('Zoho CRM: stage is required');
  const record: Record<string, unknown> = { Deal_Name, Stage, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  const data = await moduleUpsert(ctx, 'Deals', record);
  return { outputs: { deal: data, id: firstRecordId(data) }, logs: [`Zoho deal upsert → ${firstRecordId(data) ?? '?'}`] };
}

async function dealListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const items = await zohoListAll(ctx, 'Deals', maxItems);
  return { outputs: { deals: items, count: items.length }, logs: [`Zoho deal list all → ${items.length}`] };
}

async function dealSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await moduleSearch(ctx, 'Deals', buildSearchQs(ctx));
  return { outputs: { result: data }, logs: ['Zoho deal search'] };
}

// ── Account ────────────────────────────────────────────────────────────────

async function accountGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'accountId', 'accountId');
  const data = await moduleGet(ctx, 'Accounts', id);
  return { outputs: { account: data }, logs: [`Zoho account get → ${id}`] };
}

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

async function accountUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'accountId', 'accountId');
  const record: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  if (asString(ctx.options.accountName)) record.Account_Name = asString(ctx.options.accountName);
  if (asString(ctx.options.website)) record.Website = asString(ctx.options.website);
  if (asString(ctx.options.phone)) record.Phone = asString(ctx.options.phone);
  if (asString(ctx.options.industry)) record.Industry = asString(ctx.options.industry);
  if (Object.keys(record).length === 0) {
    throw new Error('Zoho CRM: at least one updatable field must be provided');
  }
  const data = await moduleUpdate(ctx, 'Accounts', id, record);
  return { outputs: { account: data, id: firstRecordId(data) ?? id }, logs: [`Zoho account update → ${id}`] };
}

async function accountDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireOpt(ctx, 'accountId', 'accountId');
  const data = await moduleDelete(ctx, 'Accounts', id);
  return { outputs: { result: data, id }, logs: [`Zoho account delete → ${id}`] };
}

async function accountUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Account_Name = asString(ctx.options.accountName);
  if (!Account_Name) throw new Error('Zoho CRM: accountName is required');
  const record: Record<string, unknown> = { Account_Name, ...parseJsonObject(ctx.options.extra, 'Zoho CRM: extra fields') };
  const data = await moduleUpsert(ctx, 'Accounts', record);
  return { outputs: { account: data, id: firstRecordId(data) }, logs: [`Zoho account upsert → ${firstRecordId(data) ?? '?'}`] };
}

async function accountListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const items = await zohoListAll(ctx, 'Accounts', maxItems);
  return { outputs: { accounts: items, count: items.length }, logs: [`Zoho account list all → ${items.length}`] };
}

async function accountSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await moduleSearch(ctx, 'Accounts', buildSearchQs(ctx));
  return { outputs: { result: data }, logs: ['Zoho account search'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const searchFields = [
  { id: 'criteria', label: 'Criteria (Zoho expression)', type: 'text' as const, placeholder: '(Email:equals:foo@bar.com)' },
  { id: 'email', label: 'Email', type: 'text' as const },
  { id: 'phone', label: 'Phone', type: 'text' as const },
  { id: 'word', label: 'Word', type: 'text' as const },
];

const block: ForgeBlock = {
  id: 'forge_zoho_crm',
  name: 'Zoho CRM',
  description: 'CRUD Zoho CRM leads, contacts, deals and accounts plus upsert, search and paginated list.',
  iconName: 'LuBriefcase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'zoho_crm' },
  actions: [
    // Lead
    { id: 'lead_get', label: 'Get lead', description: 'Fetch a lead by id.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }], run: leadGet },
    { id: 'lead_create', label: 'Create lead', description: 'Create a new lead.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'company', label: 'Company', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: leadCreate },
    { id: 'lead_update', label: 'Update lead', description: 'Patch fields on an existing lead.',
      fields: [
        { id: 'leadId', label: 'Lead ID', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: leadUpdate },
    { id: 'lead_delete', label: 'Delete lead', description: 'Permanently delete a lead.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }], run: leadDelete },
    { id: 'lead_upsert', label: 'Upsert lead', description: 'Create-or-update by unique fields.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'company', label: 'Company', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: leadUpsert },
    { id: 'lead_list_all', label: 'List all leads (paginated)',
      description: 'Walk Zoho page/per_page pagination and return every lead up to the cap.',
      fields: [{ id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' }],
      run: leadListAll },
    { id: 'lead_search', label: 'Search leads', description: 'Search by criteria, email, phone or word.',
      fields: searchFields, run: leadSearch },

    // Contact
    { id: 'contact_get', label: 'Get contact', description: 'Fetch a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }], run: contactGet },
    { id: 'contact_create', label: 'Create contact', description: 'Create a new contact.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: contactCreate },
    { id: 'contact_update', label: 'Update contact', description: 'Patch fields on an existing contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: contactUpdate },
    { id: 'contact_delete', label: 'Delete contact', description: 'Permanently delete a contact.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }], run: contactDelete },
    { id: 'contact_upsert', label: 'Upsert contact', description: 'Create-or-update by unique fields.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: contactUpsert },
    { id: 'contact_list_all', label: 'List all contacts (paginated)',
      description: 'Walk Zoho page/per_page pagination and return every contact up to the cap.',
      fields: [{ id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' }],
      run: contactListAll },
    { id: 'contact_search', label: 'Search contacts', description: 'Search by criteria, email, phone or word.',
      fields: searchFields, run: contactSearch },

    // Deal
    { id: 'deal_get', label: 'Get deal', description: 'Fetch a deal by id.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }], run: dealGet },
    { id: 'deal_create', label: 'Create deal', description: 'Create a new deal.',
      fields: [
        { id: 'dealName', label: 'Deal name', type: 'text', required: true },
        { id: 'stage', label: 'Stage', type: 'text', required: true, placeholder: 'Qualification' },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'closingDate', label: 'Closing date (YYYY-MM-DD)', type: 'text' },
        { id: 'accountName', label: 'Account name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: dealCreate },
    { id: 'deal_update', label: 'Update deal', description: 'Patch fields on an existing deal.',
      fields: [
        { id: 'dealId', label: 'Deal ID', type: 'text', required: true },
        { id: 'dealName', label: 'Deal name', type: 'text' },
        { id: 'stage', label: 'Stage', type: 'text' },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'closingDate', label: 'Closing date (YYYY-MM-DD)', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: dealUpdate },
    { id: 'deal_delete', label: 'Delete deal', description: 'Permanently delete a deal.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }], run: dealDelete },
    { id: 'deal_upsert', label: 'Upsert deal', description: 'Create-or-update by unique fields.',
      fields: [
        { id: 'dealName', label: 'Deal name', type: 'text', required: true },
        { id: 'stage', label: 'Stage', type: 'text', required: true },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: dealUpsert },
    { id: 'deal_list_all', label: 'List all deals (paginated)',
      description: 'Walk Zoho page/per_page pagination and return every deal up to the cap.',
      fields: [{ id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' }],
      run: dealListAll },
    { id: 'deal_search', label: 'Search deals', description: 'Search by criteria, email, phone or word.',
      fields: searchFields, run: dealSearch },

    // Account
    { id: 'account_get', label: 'Get account', description: 'Fetch an account by id.',
      fields: [{ id: 'accountId', label: 'Account ID', type: 'text', required: true }], run: accountGet },
    { id: 'account_create', label: 'Create account', description: 'Create a new account.',
      fields: [
        { id: 'accountName', label: 'Account name', type: 'text', required: true },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'industry', label: 'Industry', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: accountCreate },
    { id: 'account_update', label: 'Update account', description: 'Patch fields on an existing account.',
      fields: [
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'accountName', label: 'Account name', type: 'text' },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'industry', label: 'Industry', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: accountUpdate },
    { id: 'account_delete', label: 'Delete account', description: 'Permanently delete an account.',
      fields: [{ id: 'accountId', label: 'Account ID', type: 'text', required: true }], run: accountDelete },
    { id: 'account_upsert', label: 'Upsert account', description: 'Create-or-update by unique fields.',
      fields: [
        { id: 'accountName', label: 'Account name', type: 'text', required: true },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: accountUpsert },
    { id: 'account_list_all', label: 'List all accounts (paginated)',
      description: 'Walk Zoho page/per_page pagination and return every account up to the cap.',
      fields: [{ id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' }],
      run: accountListAll },
    { id: 'account_search', label: 'Search accounts', description: 'Search by criteria, email, phone or word.',
      fields: searchFields, run: accountSearch },
  ],
};

registerForgeBlock(block);
export default block;
