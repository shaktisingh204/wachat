/**
 * Forge block: Salesforce
 *
 * Source: n8n-master/packages/nodes-base/nodes/Salesforce/Salesforce.node.ts
 *   (+ LeadDescription.ts, ContactDescription.ts, OpportunityDescription.ts,
 *    AccountDescription.ts, CaseDescription.ts, TaskDescription.ts,
 *    AttachmentDescription.ts)
 * Credential type: 'salesforce' — fields used here:
 *   { instanceUrl, accessToken? } — plus the legacy clientId/clientSecret/
 *   username/password fields stored on the credential record (not used at
 *   runtime in this first port).
 *
 * Operations covered:
 *   - lead.get / lead.create / lead.update / lead.delete
 *   - contact.get / contact.create / contact.update / contact.delete
 *   - opportunity.get / opportunity.create / opportunity.update / opportunity.delete
 *   - account.get / account.create / account.update / account.delete
 *   - case.get / case.create / case.update / case.delete
 *   - task.get / task.create / task.update / task.delete
 *   - sobject.upsert        PATCH /sobjects/{type}/{externalIdField}/{externalId}
 *   - query                 GET  /query?q=...   (raw SOQL)
 *   - query_all             GET  /query  + walk nextRecordsUrl
 *   - search                GET  /search?q=...  (raw SOSL)
 *
 * Out of scope for this port:
 *   - OAuth2 JWT bearer / password flows to mint an access token from
 *     clientId/clientSecret/username/password. For Wave 1 we expect the
 *     credential record to already contain a long-lived `accessToken` —
 *     OAuth refresh is a follow-up task on the credentials side.
 *   - LoadOptions for picklists (StageName, LeadSource), record-type lookups
 *   - Attachment binary upload (forge runtime has no binary-stream plumbing)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const API_VERSION = 'v59.0';

function resolveAuth(ctx: ForgeActionContext): { instanceUrl: string; token: string } {
  const cred = requireCredential('Salesforce', ctx.credential);
  const instanceUrl = (cred.instanceUrl || '').replace(/\/+$/, '');
  const token = cred.accessToken || '';
  if (!instanceUrl) {
    throw new Error('Salesforce: credential is missing `instanceUrl` field');
  }
  if (!token) {
    throw new Error(
      'Salesforce: credential is missing `accessToken` — OAuth refresh from clientId/secret is not implemented in this port',
    );
  }
  return { instanceUrl, token };
}

async function sfRequest(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  json?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  // Credential validated by resolveAuth() before any call site.
  const r = await ctx.helpers!.requestWithAuthentication('bearer', {
    method,
    url,
    tokenField: 'accessToken',
    json,
  });
  if (!r.ok) {
    const clip =
      typeof r.data === 'string'
        ? r.data.length > 300
          ? `${r.data.slice(0, 300)}…`
          : r.data
        : JSON.stringify(r.data ?? null).slice(0, 300);
    throw new Error(`Salesforce ${method} ${url} failed (${r.status}): ${clip}`);
  }
  return r;
}

async function sfApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { instanceUrl } = resolveAuth(ctx);
  const res = await sfRequest(ctx, method, `${instanceUrl}/services/data/${API_VERSION}${path}`, json);
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
  throw new Error('Salesforce: extra fields must be a JSON object');
}

/**
 * Shared sobject helpers — Salesforce's REST API is uniform across types so
 * GET/PATCH/DELETE can be expressed once per kind. POST already differs per
 * resource because the body field set is resource-specific.
 */
async function sobjectGet(
  ctx: ForgeActionContext,
  type: string,
  id: string,
): Promise<unknown> {
  return sfApi(ctx, 'GET', `/sobjects/${type}/${encodeURIComponent(id)}`);
}

async function sobjectDelete(
  ctx: ForgeActionContext,
  type: string,
  id: string,
): Promise<unknown> {
  return sfApi(ctx, 'DELETE', `/sobjects/${type}/${encodeURIComponent(id)}`);
}

async function sobjectUpdate(
  ctx: ForgeActionContext,
  type: string,
  id: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  // SF PATCH returns 204 No Content on success; sfApi returns the raw text/json data.
  return sfApi(ctx, 'PATCH', `/sobjects/${type}/${encodeURIComponent(id)}`, body);
}

function requireId(ctx: ForgeActionContext, fieldId: string): string {
  const v = asString(ctx.options[fieldId]);
  if (!v) throw new Error(`Salesforce: ${fieldId} is required`);
  return v;
}

// ── Lead ───────────────────────────────────────────────────────────────────

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'leadId');
  const data = await sobjectGet(ctx, 'Lead', id);
  return { outputs: { lead: data }, logs: [`Salesforce lead get → ${id}`] };
}

async function leadCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Company = asString(ctx.options.company);
  const LastName = asString(ctx.options.lastName);
  if (!Company) throw new Error('Salesforce: company is required');
  if (!LastName) throw new Error('Salesforce: lastName is required');
  const body: Record<string, unknown> = {
    Company,
    LastName,
    ...parseExtra(ctx.options.extra),
  };
  if (asString(ctx.options.firstName)) body.FirstName = asString(ctx.options.firstName);
  if (asString(ctx.options.email)) body.Email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) body.Phone = asString(ctx.options.phone);

  const data = (await sfApi(ctx, 'POST', '/sobjects/Lead', body)) as { id?: string } | null;
  return { outputs: { lead: data, id: data?.id ?? null }, logs: [`Salesforce lead create → ${data?.id ?? '?'}`] };
}

async function leadUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'leadId');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.firstName)) body.FirstName = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) body.LastName = asString(ctx.options.lastName);
  if (asString(ctx.options.company)) body.Company = asString(ctx.options.company);
  if (asString(ctx.options.email)) body.Email = asString(ctx.options.email);
  if (asString(ctx.options.phone)) body.Phone = asString(ctx.options.phone);
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: at least one updatable field must be provided');
  }
  await sobjectUpdate(ctx, 'Lead', id, body);
  return { outputs: { id }, logs: [`Salesforce lead update → ${id}`] };
}

async function leadDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'leadId');
  await sobjectDelete(ctx, 'Lead', id);
  return { outputs: { id, deleted: true }, logs: [`Salesforce lead delete → ${id}`] };
}

// ── Contact ────────────────────────────────────────────────────────────────

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'contactId');
  const data = await sobjectGet(ctx, 'Contact', id);
  return { outputs: { contact: data }, logs: [`Salesforce contact get → ${id}`] };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const LastName = asString(ctx.options.lastName);
  if (!LastName) throw new Error('Salesforce: lastName is required');
  const body: Record<string, unknown> = { LastName, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.firstName)) body.FirstName = asString(ctx.options.firstName);
  if (asString(ctx.options.email)) body.Email = asString(ctx.options.email);
  if (asString(ctx.options.accountId)) body.AccountId = asString(ctx.options.accountId);

  const data = (await sfApi(ctx, 'POST', '/sobjects/Contact', body)) as { id?: string } | null;
  return {
    outputs: { contact: data, id: data?.id ?? null },
    logs: [`Salesforce contact create → ${data?.id ?? '?'}`],
  };
}

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'contactId');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.firstName)) body.FirstName = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) body.LastName = asString(ctx.options.lastName);
  if (asString(ctx.options.email)) body.Email = asString(ctx.options.email);
  if (asString(ctx.options.accountId)) body.AccountId = asString(ctx.options.accountId);
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: at least one updatable field must be provided');
  }
  await sobjectUpdate(ctx, 'Contact', id, body);
  return { outputs: { id }, logs: [`Salesforce contact update → ${id}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'contactId');
  await sobjectDelete(ctx, 'Contact', id);
  return { outputs: { id, deleted: true }, logs: [`Salesforce contact delete → ${id}`] };
}

// ── Opportunity ────────────────────────────────────────────────────────────

async function opportunityGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'opportunityId');
  const data = await sobjectGet(ctx, 'Opportunity', id);
  return { outputs: { opportunity: data }, logs: [`Salesforce opportunity get → ${id}`] };
}

async function opportunityCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Name = asString(ctx.options.name);
  const StageName = asString(ctx.options.stageName);
  const CloseDate = asString(ctx.options.closeDate);
  if (!Name) throw new Error('Salesforce: name is required');
  if (!StageName) throw new Error('Salesforce: stageName is required');
  if (!CloseDate) throw new Error('Salesforce: closeDate is required (YYYY-MM-DD)');
  const body: Record<string, unknown> = {
    Name,
    StageName,
    CloseDate,
    ...parseExtra(ctx.options.extra),
  };
  if (asString(ctx.options.amount)) body.Amount = Number(asString(ctx.options.amount));
  if (asString(ctx.options.accountId)) body.AccountId = asString(ctx.options.accountId);

  const data = (await sfApi(ctx, 'POST', '/sobjects/Opportunity', body)) as { id?: string } | null;
  return {
    outputs: { opportunity: data, id: data?.id ?? null },
    logs: [`Salesforce opportunity create → ${data?.id ?? '?'}`],
  };
}

async function opportunityUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'opportunityId');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.Name = asString(ctx.options.name);
  if (asString(ctx.options.stageName)) body.StageName = asString(ctx.options.stageName);
  if (asString(ctx.options.closeDate)) body.CloseDate = asString(ctx.options.closeDate);
  if (asString(ctx.options.amount)) body.Amount = Number(asString(ctx.options.amount));
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: at least one updatable field must be provided');
  }
  await sobjectUpdate(ctx, 'Opportunity', id, body);
  return { outputs: { id }, logs: [`Salesforce opportunity update → ${id}`] };
}

async function opportunityDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'opportunityId');
  await sobjectDelete(ctx, 'Opportunity', id);
  return { outputs: { id, deleted: true }, logs: [`Salesforce opportunity delete → ${id}`] };
}

// ── Account ────────────────────────────────────────────────────────────────

async function accountGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'accountId');
  const data = await sobjectGet(ctx, 'Account', id);
  return { outputs: { account: data }, logs: [`Salesforce account get → ${id}`] };
}

async function accountCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Name = asString(ctx.options.name);
  if (!Name) throw new Error('Salesforce: name is required');
  const body: Record<string, unknown> = { Name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.website)) body.Website = asString(ctx.options.website);
  if (asString(ctx.options.phone)) body.Phone = asString(ctx.options.phone);
  if (asString(ctx.options.industry)) body.Industry = asString(ctx.options.industry);

  const data = (await sfApi(ctx, 'POST', '/sobjects/Account', body)) as { id?: string } | null;
  return {
    outputs: { account: data, id: data?.id ?? null },
    logs: [`Salesforce account create → ${data?.id ?? '?'}`],
  };
}

async function accountUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'accountId');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.name)) body.Name = asString(ctx.options.name);
  if (asString(ctx.options.website)) body.Website = asString(ctx.options.website);
  if (asString(ctx.options.phone)) body.Phone = asString(ctx.options.phone);
  if (asString(ctx.options.industry)) body.Industry = asString(ctx.options.industry);
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: at least one updatable field must be provided');
  }
  await sobjectUpdate(ctx, 'Account', id, body);
  return { outputs: { id }, logs: [`Salesforce account update → ${id}`] };
}

async function accountDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'accountId');
  await sobjectDelete(ctx, 'Account', id);
  return { outputs: { id, deleted: true }, logs: [`Salesforce account delete → ${id}`] };
}

// ── Case ───────────────────────────────────────────────────────────────────

async function caseGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'caseId');
  const data = await sobjectGet(ctx, 'Case', id);
  return { outputs: { case: data }, logs: [`Salesforce case get → ${id}`] };
}

async function caseCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  // Per CaseDescription, all fields are optional at create; only Subject is meaningful.
  if (asString(ctx.options.subject)) body.Subject = asString(ctx.options.subject);
  if (asString(ctx.options.status)) body.Status = asString(ctx.options.status);
  if (asString(ctx.options.origin)) body.Origin = asString(ctx.options.origin);
  if (asString(ctx.options.priority)) body.Priority = asString(ctx.options.priority);
  if (asString(ctx.options.accountId)) body.AccountId = asString(ctx.options.accountId);
  if (asString(ctx.options.contactId)) body.ContactId = asString(ctx.options.contactId);
  if (asString(ctx.options.description)) body.Description = asString(ctx.options.description);
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: case requires at least one field (subject/status/description/…)');
  }
  const data = (await sfApi(ctx, 'POST', '/sobjects/Case', body)) as { id?: string } | null;
  return { outputs: { case: data, id: data?.id ?? null }, logs: [`Salesforce case create → ${data?.id ?? '?'}`] };
}

async function caseUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'caseId');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.subject)) body.Subject = asString(ctx.options.subject);
  if (asString(ctx.options.status)) body.Status = asString(ctx.options.status);
  if (asString(ctx.options.priority)) body.Priority = asString(ctx.options.priority);
  if (asString(ctx.options.description)) body.Description = asString(ctx.options.description);
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: at least one updatable field must be provided');
  }
  await sobjectUpdate(ctx, 'Case', id, body);
  return { outputs: { id }, logs: [`Salesforce case update → ${id}`] };
}

async function caseDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'caseId');
  await sobjectDelete(ctx, 'Case', id);
  return { outputs: { id, deleted: true }, logs: [`Salesforce case delete → ${id}`] };
}

// ── Task ───────────────────────────────────────────────────────────────────

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'taskId');
  const data = await sobjectGet(ctx, 'Task', id);
  return { outputs: { task: data }, logs: [`Salesforce task get → ${id}`] };
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const Status = asString(ctx.options.status);
  if (!Status) throw new Error('Salesforce: status is required');
  const body: Record<string, unknown> = { Status, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.subject)) body.Subject = asString(ctx.options.subject);
  if (asString(ctx.options.priority)) body.Priority = asString(ctx.options.priority);
  if (asString(ctx.options.activityDate)) body.ActivityDate = asString(ctx.options.activityDate);
  if (asString(ctx.options.whoId)) body.WhoId = asString(ctx.options.whoId);
  if (asString(ctx.options.whatId)) body.WhatId = asString(ctx.options.whatId);
  if (asString(ctx.options.ownerId)) body.OwnerId = asString(ctx.options.ownerId);

  const data = (await sfApi(ctx, 'POST', '/sobjects/Task', body)) as { id?: string } | null;
  return { outputs: { task: data, id: data?.id ?? null }, logs: [`Salesforce task create → ${data?.id ?? '?'}`] };
}

async function taskUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'taskId');
  const body: Record<string, unknown> = { ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.status)) body.Status = asString(ctx.options.status);
  if (asString(ctx.options.subject)) body.Subject = asString(ctx.options.subject);
  if (asString(ctx.options.priority)) body.Priority = asString(ctx.options.priority);
  if (asString(ctx.options.activityDate)) body.ActivityDate = asString(ctx.options.activityDate);
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: at least one updatable field must be provided');
  }
  await sobjectUpdate(ctx, 'Task', id, body);
  return { outputs: { id }, logs: [`Salesforce task update → ${id}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = requireId(ctx, 'taskId');
  await sobjectDelete(ctx, 'Task', id);
  return { outputs: { id, deleted: true }, logs: [`Salesforce task delete → ${id}`] };
}

// ── Generic sobject upsert ─────────────────────────────────────────────────

async function sobjectUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const type = requireId(ctx, 'sobjectType');
  const externalIdField = requireId(ctx, 'externalIdField');
  const externalId = requireId(ctx, 'externalId');
  const body = parseExtra(ctx.options.fields);
  if (Object.keys(body).length === 0) {
    throw new Error('Salesforce: fields JSON is required for upsert');
  }
  const data = await sfApi(
    ctx,
    'PATCH',
    `/sobjects/${type}/${encodeURIComponent(externalIdField)}/${encodeURIComponent(externalId)}`,
    body,
  );
  return { outputs: { result: data }, logs: [`Salesforce upsert → ${type}/${externalIdField}/${externalId}`] };
}

// ── Raw SOQL / SOSL ────────────────────────────────────────────────────────

async function soqlQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.soql);
  if (!q) throw new Error('Salesforce: SOQL string is required');
  const data = (await sfApi(ctx, 'GET', `/query?q=${encodeURIComponent(q)}`)) as {
    records?: unknown[];
    totalSize?: number;
    done?: boolean;
  } | null;
  return {
    outputs: { records: data?.records ?? [], totalSize: data?.totalSize ?? 0, done: data?.done ?? true },
    logs: [`Salesforce SOQL → ${data?.totalSize ?? 0} rows`],
  };
}

async function soqlQueryAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.soql);
  if (!q) throw new Error('Salesforce: SOQL string is required');
  const { instanceUrl } = resolveAuth(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const firstUrl = `${instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(q)}`;

  const records = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      // Salesforce returns `nextRecordsUrl` as a path like
      // "/services/data/v59.0/query/01g…". We prepend instanceUrl on each
      // follow-up; the first page uses the constructed query URL.
      const url = cursor
        ? cursor.startsWith('http')
          ? cursor
          : `${instanceUrl}${cursor}`
        : firstUrl;
      const res = await sfRequest(ctx, 'GET', url);
      const data = res.data as {
        records?: unknown[];
        done?: boolean;
        nextRecordsUrl?: string;
      } | null;
      const items = (data?.records ?? []) as unknown[];
      const nextCursor = data?.done === false ? data?.nextRecordsUrl : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { records, count: records.length },
    logs: [`Salesforce SOQL all → ${records.length} rows`],
  };
}

async function soslSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.sosl);
  if (!q) throw new Error('Salesforce: SOSL string is required');
  const data = (await sfApi(ctx, 'GET', `/search?q=${encodeURIComponent(q)}`)) as {
    searchRecords?: unknown[];
  } | null;
  return {
    outputs: { records: data?.searchRecords ?? [], count: (data?.searchRecords ?? []).length },
    logs: [`Salesforce SOSL → ${(data?.searchRecords ?? []).length} rows`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_salesforce',
  name: 'Salesforce',
  description: 'Read and write Salesforce leads, contacts, accounts, opportunities, cases, tasks and SOQL/SOSL.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'salesforce' },
  actions: [
    // Lead
    { id: 'lead_get', label: 'Get lead', description: 'Fetch a Lead record by id.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }], run: leadGet },
    { id: 'lead_create', label: 'Create lead', description: 'Create a new Lead.',
      fields: [
        { id: 'company', label: 'Company', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: leadCreate },
    { id: 'lead_update', label: 'Update lead', description: 'Patch fields on an existing Lead.',
      fields: [
        { id: 'leadId', label: 'Lead ID', type: 'text', required: true },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: leadUpdate },
    { id: 'lead_delete', label: 'Delete lead', description: 'Permanently delete a Lead.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }], run: leadDelete },

    // Contact
    { id: 'contact_get', label: 'Get contact', description: 'Fetch a Contact record by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }], run: contactGet },
    { id: 'contact_create', label: 'Create contact', description: 'Create a new Contact.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'accountId', label: 'Account ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: contactCreate },
    { id: 'contact_update', label: 'Update contact', description: 'Patch fields on an existing Contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'accountId', label: 'Account ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: contactUpdate },
    { id: 'contact_delete', label: 'Delete contact', description: 'Permanently delete a Contact.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }], run: contactDelete },

    // Opportunity
    { id: 'opportunity_get', label: 'Get opportunity', description: 'Fetch an Opportunity record by id.',
      fields: [{ id: 'opportunityId', label: 'Opportunity ID', type: 'text', required: true }], run: opportunityGet },
    { id: 'opportunity_create', label: 'Create opportunity', description: 'Create a new Opportunity.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'stageName', label: 'Stage name', type: 'text', required: true, placeholder: 'Prospecting' },
        { id: 'closeDate', label: 'Close date (YYYY-MM-DD)', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'accountId', label: 'Account ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: opportunityCreate },
    { id: 'opportunity_update', label: 'Update opportunity', description: 'Patch fields on an existing Opportunity.',
      fields: [
        { id: 'opportunityId', label: 'Opportunity ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'stageName', label: 'Stage name', type: 'text' },
        { id: 'closeDate', label: 'Close date (YYYY-MM-DD)', type: 'text' },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: opportunityUpdate },
    { id: 'opportunity_delete', label: 'Delete opportunity', description: 'Permanently delete an Opportunity.',
      fields: [{ id: 'opportunityId', label: 'Opportunity ID', type: 'text', required: true }], run: opportunityDelete },

    // Account
    { id: 'account_get', label: 'Get account', description: 'Fetch an Account record by id.',
      fields: [{ id: 'accountId', label: 'Account ID', type: 'text', required: true }], run: accountGet },
    { id: 'account_create', label: 'Create account', description: 'Create a new Account.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'industry', label: 'Industry', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: accountCreate },
    { id: 'account_update', label: 'Update account', description: 'Patch fields on an existing Account.',
      fields: [
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'industry', label: 'Industry', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: accountUpdate },
    { id: 'account_delete', label: 'Delete account', description: 'Permanently delete an Account.',
      fields: [{ id: 'accountId', label: 'Account ID', type: 'text', required: true }], run: accountDelete },

    // Case
    { id: 'case_get', label: 'Get case', description: 'Fetch a Case record by id.',
      fields: [{ id: 'caseId', label: 'Case ID', type: 'text', required: true }], run: caseGet },
    { id: 'case_create', label: 'Create case', description: 'Create a new Case.',
      fields: [
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'status', label: 'Status', type: 'text', placeholder: 'New' },
        { id: 'origin', label: 'Origin', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'accountId', label: 'Account ID', type: 'text' },
        { id: 'contactId', label: 'Contact ID', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: caseCreate },
    { id: 'case_update', label: 'Update case', description: 'Patch fields on an existing Case.',
      fields: [
        { id: 'caseId', label: 'Case ID', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'status', label: 'Status', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: caseUpdate },
    { id: 'case_delete', label: 'Delete case', description: 'Permanently delete a Case.',
      fields: [{ id: 'caseId', label: 'Case ID', type: 'text', required: true }], run: caseDelete },

    // Task
    { id: 'task_get', label: 'Get task', description: 'Fetch a Task record by id.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }], run: taskGet },
    { id: 'task_create', label: 'Create task', description: 'Create a new Task.',
      fields: [
        { id: 'status', label: 'Status', type: 'text', required: true, placeholder: 'Not Started' },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'activityDate', label: 'Activity date (YYYY-MM-DD)', type: 'text' },
        { id: 'whoId', label: 'Who ID (Lead/Contact)', type: 'text' },
        { id: 'whatId', label: 'What ID (related)', type: 'text' },
        { id: 'ownerId', label: 'Owner ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: taskCreate },
    { id: 'task_update', label: 'Update task', description: 'Patch fields on an existing Task.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'status', label: 'Status', type: 'text' },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'activityDate', label: 'Activity date (YYYY-MM-DD)', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: taskUpdate },
    { id: 'task_delete', label: 'Delete task', description: 'Permanently delete a Task.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }], run: taskDelete },

    // Generic upsert
    { id: 'sobject_upsert', label: 'Upsert sobject by external ID',
      description: 'PATCH /sobjects/{type}/{externalIdField}/{externalId} — creates if missing, updates if present.',
      fields: [
        { id: 'sobjectType', label: 'SObject type', type: 'text', required: true, placeholder: 'Account' },
        { id: 'externalIdField', label: 'External ID field name', type: 'text', required: true },
        { id: 'externalId', label: 'External ID value', type: 'text', required: true },
        { id: 'fields', label: 'Fields (JSON object)', type: 'json', required: true },
      ], run: sobjectUpsert },

    // SOQL / SOSL
    { id: 'soql_query', label: 'Run SOQL query', description: 'Execute a raw SOQL string against the REST query endpoint.',
      fields: [
        { id: 'soql', label: 'SOQL', type: 'textarea', required: true,
          placeholder: 'SELECT Id, Name FROM Account LIMIT 10' },
      ], run: soqlQuery },
    { id: 'soql_query_all', label: 'Run SOQL query (all pages)',
      description: 'Execute SOQL and walk `nextRecordsUrl` until `done` or the cap is reached.',
      fields: [
        { id: 'soql', label: 'SOQL', type: 'textarea', required: true,
          placeholder: 'SELECT Id, Name FROM Account' },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
      ], run: soqlQueryAll },
    { id: 'sosl_search', label: 'Run SOSL search',
      description: 'Execute a raw SOSL string against /search.',
      fields: [
        { id: 'sosl', label: 'SOSL', type: 'textarea', required: true,
          placeholder: 'FIND {Acme} IN ALL FIELDS RETURNING Account(Id, Name)' },
      ], run: soslSearch },
  ],
};

registerForgeBlock(block);
export default block;
