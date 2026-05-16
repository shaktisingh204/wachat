/**
 * Forge block: Salesforce
 *
 * Source: n8n-master/packages/nodes-base/nodes/Salesforce/Salesforce.node.ts
 *   (+ LeadDescription.ts, ContactDescription.ts, OpportunityDescription.ts,
 *    AccountDescription.ts)
 * Credential type: 'salesforce' — fields used here:
 *   { instanceUrl, accessToken? } — plus the legacy clientId/clientSecret/
 *   username/password fields stored on the credential record (not used at
 *   runtime in this first port).
 *
 * Operations covered (one per major resource):
 *   - lead.get             GET  /sobjects/Lead/{id}
 *   - lead.create          POST /sobjects/Lead
 *   - contact.create       POST /sobjects/Contact
 *   - opportunity.create   POST /sobjects/Opportunity
 *   - account.create       POST /sobjects/Account
 *   - query                GET  /query?q=...   (raw SOQL)
 *
 * Out of scope for this first port:
 *   - OAuth2 JWT bearer / password flows to mint an access token from
 *     clientId/clientSecret/username/password. For Wave 1 we expect the
 *     credential record to already contain a long-lived `accessToken` —
 *     OAuth refresh is a follow-up task on the credentials side.
 *   - LoadOptions for picklists (StageName, LeadSource), record-type lookups
 *   - Update/Delete/Upsert per resource (one op per resource for now)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
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

async function sfApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { instanceUrl, token } = resolveAuth(ctx);
  const res = await apiRequest({
    service: 'Salesforce',
    method,
    url: `${instanceUrl}/services/data/${API_VERSION}${path}`,
    headers: { Authorization: `Bearer ${token}` },
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
  throw new Error('Salesforce: extra fields must be a JSON object');
}

// ── Lead ───────────────────────────────────────────────────────────────────

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.leadId);
  if (!id) throw new Error('Salesforce: leadId is required');
  const data = await sfApi(ctx, 'GET', `/sobjects/Lead/${encodeURIComponent(id)}`);
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

// ── Contact ────────────────────────────────────────────────────────────────

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

// ── Opportunity ────────────────────────────────────────────────────────────

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

// ── Account ────────────────────────────────────────────────────────────────

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

// ── Raw SOQL query ─────────────────────────────────────────────────────────

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
  const { instanceUrl, token } = resolveAuth(ctx);
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
      const res = await apiRequest({
        service: 'Salesforce',
        method: 'GET',
        url,
        headers: { Authorization: `Bearer ${token}` },
      });
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

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_salesforce',
  name: 'Salesforce',
  description: 'Read and write Salesforce leads, contacts, accounts, opportunities and SOQL.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'salesforce' },
  actions: [
    {
      id: 'lead_get',
      label: 'Get lead',
      description: 'Fetch a Lead record by id.',
      fields: [{ id: 'leadId', label: 'Lead ID', type: 'text', required: true }],
      run: leadGet,
    },
    {
      id: 'lead_create',
      label: 'Create lead',
      description: 'Create a new Lead.',
      fields: [
        { id: 'company', label: 'Company', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
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
      description: 'Create a new Contact.',
      fields: [
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'accountId', label: 'Account ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactCreate,
    },
    {
      id: 'opportunity_create',
      label: 'Create opportunity',
      description: 'Create a new Opportunity.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'stageName', label: 'Stage name', type: 'text', required: true, placeholder: 'Prospecting' },
        { id: 'closeDate', label: 'Close date (YYYY-MM-DD)', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'accountId', label: 'Account ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: opportunityCreate,
    },
    {
      id: 'account_create',
      label: 'Create account',
      description: 'Create a new Account.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'industry', label: 'Industry', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: accountCreate,
    },
    {
      id: 'soql_query',
      label: 'Run SOQL query',
      description: 'Execute a raw SOQL string against the REST query endpoint.',
      fields: [
        {
          id: 'soql',
          label: 'SOQL',
          type: 'textarea',
          required: true,
          placeholder: 'SELECT Id, Name FROM Account LIMIT 10',
        },
      ],
      run: soqlQuery,
    },
    {
      id: 'soql_query_all',
      label: 'Run SOQL query (all pages)',
      description: 'Execute SOQL and walk `nextRecordsUrl` until `done` or the cap is reached.',
      fields: [
        {
          id: 'soql',
          label: 'SOQL',
          type: 'textarea',
          required: true,
          placeholder: 'SELECT Id, Name FROM Account',
        },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
      ],
      run: soqlQueryAll,
    },
  ],
};

registerForgeBlock(block);
export default block;
