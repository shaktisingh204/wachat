/**
 * Step parity-2 — ten net-new integrations that close additional gaps the
 * earlier parity batch missed.  Each block ships its primary action (the
 * 80/20 cut); broader API surface is reachable via the generic HTTP block.
 *
 *   1.  HubSpot CRM       — create_contact
 *   2.  Pipedrive         — list_deals
 *   3.  Notion            — query_database
 *   4.  Calendly          — list_event_types
 *   5.  PandaDoc          — create_document
 *   6.  DocuSign          — create_envelope
 *   7.  Pinecone          — upsert_vector
 *   8.  Algolia           — save_object
 *   9.  MeiliSearch       — index_document
 *   10. Cloudinary        — upload_url (signed)
 */

import { createHash } from 'node:crypto';

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

/* ── helpers ──────────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

async function jsonRequest(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}): Promise<unknown> {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: { Accept: 'application/json', ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  const data: unknown = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const detail =
      typeof data === 'string' ? data : data ? JSON.stringify(data).slice(0, 400) : '';
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail}`);
  }
  return data;
}

function writeOutput(ctx: ForgeActionContext, value: unknown): Record<string, unknown> {
  const key = str(ctx.options.outputVariable);
  return key ? { [key]: value, result: value } : { result: value };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/* ── 1. HubSpot CRM — create contact ──────────────────────────────────── */

async function hubspotCreateContact(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken =
    ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!accessToken) throw new Error('HubSpot: select a credential (private-app token)');

  const email = str(ctx.options.email);
  if (!email) throw new Error('HubSpot: email is required');

  const properties: Record<string, unknown> = {
    email,
    firstname: str(ctx.options.firstName) || undefined,
    lastname: str(ctx.options.lastName) || undefined,
    phone: str(ctx.options.phone) || undefined,
    company: str(ctx.options.company) || undefined,
    website: str(ctx.options.website) || undefined,
  };
  const extra = asRecord(ctx.options.properties);
  if (extra) Object.assign(properties, extra);
  for (const k of Object.keys(properties)) {
    if (properties[k] === undefined || properties[k] === '') delete properties[k];
  }

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.hubapi.com/crm/v3/objects/contacts',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: { properties },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`HubSpot: created contact ${email}`],
  };
}

registerForgeBlock({
  id: 'forge_hubspot',
  name: 'HubSpot CRM',
  description: 'Create a HubSpot contact record via the CRM v3 API.',
  iconName: 'LuUserPlus',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'hubspot' },
  actions: [
    {
      id: 'create_contact',
      label: 'Create contact',
      description: 'POST /crm/v3/objects/contacts with the given properties.',
      fields: [
        { id: 'email',          label: 'Email', type: 'text', required: true },
        { id: 'firstName',      label: 'First name', type: 'text' },
        { id: 'lastName',       label: 'Last name', type: 'text' },
        { id: 'phone',          label: 'Phone', type: 'text' },
        { id: 'company',        label: 'Company', type: 'text' },
        { id: 'website',        label: 'Website', type: 'text' },
        { id: 'properties',     label: 'Extra properties (JSON object)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: hubspotCreateContact,
    },
  ],
} satisfies ForgeBlock);

/* ── 2. Pipedrive — list deals ────────────────────────────────────────── */

async function pipedriveListDeals(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiToken =
    ctx.credential?.apiToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!apiToken) throw new Error('Pipedrive: select a credential (api_token)');

  const companyDomain =
    ctx.credential?.companyDomain ??
    ctx.credential?.domain ??
    (str(ctx.options.companyDomain) || 'api');
  const status = str(ctx.options.status) || 'all_not_deleted';
  const limit = Math.max(1, Math.min(500, Number(ctx.options.limit) || 100));
  const start = Math.max(0, Number(ctx.options.start) || 0);

  const params = new URLSearchParams({
    api_token: apiToken,
    status,
    limit: String(limit),
    start: String(start),
  });
  const ownerId = str(ctx.options.ownerId);
  if (ownerId) params.set('owner_id', ownerId);
  const filterId = str(ctx.options.filterId);
  if (filterId) params.set('filter_id', filterId);

  const baseHost = companyDomain.includes('.') ? companyDomain : `${companyDomain}.pipedrive.com`;
  const data = await jsonRequest({
    method: 'GET',
    url: `https://${baseHost}/api/v1/deals?${params.toString()}`,
    headers: {},
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Pipedrive: listed deals (status=${status}, limit=${limit})`],
  };
}

registerForgeBlock({
  id: 'forge_pipedrive_ext',
  name: 'Pipedrive (Deals)',
  description: 'List deals from Pipedrive using an api_token credential.',
  iconName: 'LuTrendingUp',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pipedrive' },
  actions: [
    {
      id: 'list_deals',
      label: 'List deals',
      description: 'GET /api/v1/deals with pagination + status filter.',
      fields: [
        { id: 'companyDomain', label: 'Company subdomain (overrides credential)', type: 'text', placeholder: 'acme' },
        { id: 'status',        label: 'Status (open / won / lost / deleted / all_not_deleted)', type: 'text' },
        { id: 'limit',         label: 'Limit (1–500)', type: 'number' },
        { id: 'start',         label: 'Start (offset)', type: 'number' },
        { id: 'ownerId',       label: 'Owner ID (optional)', type: 'text' },
        { id: 'filterId',      label: 'Filter ID (optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: pipedriveListDeals,
    },
  ],
} satisfies ForgeBlock);

/* ── 3. Notion — query database ───────────────────────────────────────── */

async function notionQueryDatabase(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.integrationToken ??
    ctx.credential?.accessToken ??
    ctx.credential?.token ??
    ctx.credential?.apiKey;
  if (!token) throw new Error('Notion: select a credential (integration token)');

  const databaseId = str(ctx.options.databaseId);
  if (!databaseId) throw new Error('Notion: databaseId is required');

  const body: Record<string, unknown> = {};
  const filter = asRecord(ctx.options.filter);
  if (filter) body.filter = filter;
  const sortsRaw = ctx.options.sorts;
  if (Array.isArray(sortsRaw)) body.sorts = sortsRaw;
  const startCursor = str(ctx.options.startCursor);
  if (startCursor) body.start_cursor = startCursor;
  const pageSize = Number(ctx.options.pageSize);
  if (Number.isFinite(pageSize) && pageSize > 0) {
    body.page_size = Math.min(100, Math.max(1, Math.round(pageSize)));
  }

  const version = str(ctx.options.notionVersion) || '2022-06-28';
  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.notion.com/v1/databases/${encodeURIComponent(databaseId)}/query`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': version,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Notion: queried database ${databaseId}`],
  };
}

registerForgeBlock({
  id: 'forge_notion_query',
  name: 'Notion (Query DB)',
  description: 'Run a Notion database query (filter + sort + paginate).',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'notion' },
  actions: [
    {
      id: 'query_database',
      label: 'Query database',
      description: 'POST /v1/databases/{id}/query with optional filter & sorts.',
      fields: [
        { id: 'databaseId',    label: 'Database ID', type: 'text', required: true },
        { id: 'filter',        label: 'Filter (JSON)', type: 'json' },
        { id: 'sorts',         label: 'Sorts (JSON array)', type: 'json' },
        { id: 'startCursor',   label: 'Start cursor (pagination)', type: 'text' },
        { id: 'pageSize',      label: 'Page size (1–100)', type: 'number' },
        { id: 'notionVersion', label: 'Notion-Version header', type: 'text', placeholder: '2022-06-28' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: notionQueryDatabase,
    },
  ],
} satisfies ForgeBlock);

/* ── 4. Calendly — list event types ───────────────────────────────────── */

async function calendlyListEventTypes(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token =
    ctx.credential?.accessToken ?? ctx.credential?.token ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Calendly: select a credential (personal access token / OAuth)');

  let userUri = str(ctx.options.userUri);
  if (!userUri) {
    const me = await jsonRequest({
      method: 'GET',
      url: 'https://api.calendly.com/users/me',
      headers: { Authorization: `Bearer ${token}` },
    });
    const meResource = asRecord(asRecord(me)?.resource);
    userUri = str(meResource?.uri);
    if (!userUri) throw new Error('Calendly: could not resolve current user uri');
  }

  const params = new URLSearchParams({ user: userUri });
  const active = ctx.options.activeOnly;
  if (active === true) params.set('active', 'true');
  else if (active === false) params.set('active', 'false');
  const count = Number(ctx.options.count);
  if (Number.isFinite(count) && count > 0) {
    params.set('count', String(Math.min(100, Math.max(1, Math.round(count)))));
  }
  const pageToken = str(ctx.options.pageToken);
  if (pageToken) params.set('page_token', pageToken);

  const data = await jsonRequest({
    method: 'GET',
    url: `https://api.calendly.com/event_types?${params.toString()}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Calendly: listed event types for ${userUri}`],
  };
}

registerForgeBlock({
  id: 'forge_calendly',
  name: 'Calendly',
  description: 'List Calendly event types for a user / organization.',
  iconName: 'LuCalendarClock',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'calendly' },
  actions: [
    {
      id: 'list_event_types',
      label: 'List event types',
      description: 'GET /event_types?user={uri} — uses /users/me when blank.',
      fields: [
        { id: 'userUri',    label: 'User URI (defaults to current user)', type: 'text' },
        { id: 'activeOnly', label: 'Active only', type: 'toggle' },
        { id: 'count',      label: 'Count (1–100)', type: 'number' },
        { id: 'pageToken',  label: 'Page token', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: calendlyListEventTypes,
    },
  ],
} satisfies ForgeBlock);

/* ── 5. PandaDoc — create document ────────────────────────────────────── */

async function pandadocCreateDocument(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey =
    ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!apiKey) throw new Error('PandaDoc: select a credential (API key)');

  const name = str(ctx.options.name);
  const templateUuid = str(ctx.options.templateUuid);
  if (!name) throw new Error('PandaDoc: document name is required');
  if (!templateUuid) throw new Error('PandaDoc: templateUuid is required');

  const recipientsRaw = ctx.options.recipients;
  const recipients: unknown[] = Array.isArray(recipientsRaw)
    ? recipientsRaw
    : (() => {
        const r = asRecord(recipientsRaw);
        return r ? [r] : [];
      })();
  if (recipients.length === 0) {
    throw new Error('PandaDoc: at least one recipient is required');
  }

  const body: Record<string, unknown> = {
    name,
    template_uuid: templateUuid,
    recipients,
  };
  const tokens = ctx.options.tokens;
  if (Array.isArray(tokens)) body.tokens = tokens;
  const fields = asRecord(ctx.options.fields);
  if (fields) body.fields = fields;
  const metadata = asRecord(ctx.options.metadata);
  if (metadata) body.metadata = metadata;
  const tags = ctx.options.tags;
  if (Array.isArray(tags)) body.tags = tags;

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.pandadoc.com/public/v1/documents',
    headers: {
      Authorization: `API-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`PandaDoc: created document "${name}" from template ${templateUuid}`],
  };
}

registerForgeBlock({
  id: 'forge_pandadoc',
  name: 'PandaDoc',
  description: 'Create a PandaDoc document from a template.',
  iconName: 'LuFileSignature',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pandadoc' as never },
  actions: [
    {
      id: 'create_document',
      label: 'Create document',
      description: 'POST /public/v1/documents from a template + recipients.',
      fields: [
        { id: 'name',         label: 'Document name', type: 'text', required: true },
        { id: 'templateUuid', label: 'Template UUID', type: 'text', required: true },
        { id: 'recipients',   label: 'Recipients (JSON array of {email,first_name,...})', type: 'json', required: true },
        { id: 'tokens',       label: 'Tokens (JSON array)', type: 'json' },
        { id: 'fields',       label: 'Fields (JSON object)', type: 'json' },
        { id: 'metadata',     label: 'Metadata (JSON object)', type: 'json' },
        { id: 'tags',         label: 'Tags (JSON array)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: pandadocCreateDocument,
    },
  ],
} satisfies ForgeBlock);

/* ── 6. DocuSign — create envelope ────────────────────────────────────── */

async function docusignCreateEnvelope(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken =
    ctx.credential?.accessToken ?? ctx.credential?.token;
  if (!accessToken) {
    throw new Error('DocuSign: select an OAuth credential (accessToken)');
  }
  const basePath =
    ctx.credential?.basePath ??
    (str(ctx.options.basePath) || 'https://demo.docusign.net/restapi');
  const accountId =
    ctx.credential?.accountId ?? str(ctx.options.accountId);
  if (!accountId) throw new Error('DocuSign: accountId is required');

  const emailSubject = str(ctx.options.emailSubject) || 'Please sign this document';
  const status = str(ctx.options.status) || 'sent';

  const documentsRaw = ctx.options.documents;
  if (!Array.isArray(documentsRaw) || documentsRaw.length === 0) {
    throw new Error('DocuSign: documents (JSON array) is required');
  }
  const recipientsRaw = asRecord(ctx.options.recipients);
  if (!recipientsRaw) {
    throw new Error('DocuSign: recipients (JSON object, e.g. { signers: [...] }) is required');
  }

  const body: Record<string, unknown> = {
    emailSubject,
    status,
    documents: documentsRaw,
    recipients: recipientsRaw,
  };
  const emailBlurb = str(ctx.options.emailBlurb);
  if (emailBlurb) body.emailBlurb = emailBlurb;

  const url = `${basePath.replace(/\/$/, '')}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes`;
  const data = await jsonRequest({
    method: 'POST',
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`DocuSign: created envelope (status=${status}) for account ${accountId}`],
  };
}

registerForgeBlock({
  id: 'forge_docusign',
  name: 'DocuSign',
  description: 'Create a DocuSign envelope and send it for signature.',
  iconName: 'LuFileCheck2',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'docusign' as never },
  actions: [
    {
      id: 'create_envelope',
      label: 'Create envelope',
      description: 'POST {basePath}/v2.1/accounts/{accountId}/envelopes.',
      fields: [
        { id: 'basePath',     label: 'Base path (overrides credential)', type: 'text', placeholder: 'https://demo.docusign.net/restapi' },
        { id: 'accountId',    label: 'Account ID (overrides credential)', type: 'text' },
        { id: 'emailSubject', label: 'Email subject', type: 'text' },
        { id: 'emailBlurb',   label: 'Email blurb', type: 'textarea' },
        { id: 'status',       label: 'Status (created / sent)', type: 'text' },
        { id: 'documents',    label: 'Documents (JSON array)', type: 'json', required: true },
        { id: 'recipients',   label: 'Recipients (JSON object — { signers: [...] })', type: 'json', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: docusignCreateEnvelope,
    },
  ],
} satisfies ForgeBlock);

/* ── 7. Pinecone — upsert vectors ─────────────────────────────────────── */

async function pineconeUpsertVector(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Pinecone: select a credential (API key)');
  const host =
    ctx.credential?.host ?? str(ctx.options.host);
  if (!host) {
    throw new Error('Pinecone: index host is required (e.g. my-index-xxxx.svc.us-east1-aws.pinecone.io)');
  }
  const namespace = str(ctx.options.namespace);

  let vectors: unknown[];
  const vectorsRaw = ctx.options.vectors;
  if (Array.isArray(vectorsRaw)) {
    vectors = vectorsRaw;
  } else {
    // Single-vector shortcut: id + values [+ metadata].
    const id = str(ctx.options.id);
    const valuesRaw = ctx.options.values;
    const values =
      Array.isArray(valuesRaw)
        ? valuesRaw.map(Number).filter((n) => Number.isFinite(n))
        : typeof valuesRaw === 'string'
          ? valuesRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
          : [];
    if (!id || values.length === 0) {
      throw new Error('Pinecone: provide either vectors (array) or id + values');
    }
    const single: Record<string, unknown> = { id, values };
    const metadata = asRecord(ctx.options.metadata);
    if (metadata) single.metadata = metadata;
    vectors = [single];
  }

  const body: Record<string, unknown> = { vectors };
  if (namespace) body.namespace = namespace;

  const hostUrl = host.startsWith('http') ? host : `https://${host}`;
  const data = await jsonRequest({
    method: 'POST',
    url: `${hostUrl.replace(/\/$/, '')}/vectors/upsert`,
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Pinecone: upserted ${vectors.length} vector(s) into ${host}${namespace ? `/${namespace}` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_pinecone',
  name: 'Pinecone',
  description: 'Upsert one or more vectors into a Pinecone index.',
  iconName: 'LuBoxes',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pinecone' as never },
  actions: [
    {
      id: 'upsert_vector',
      label: 'Upsert vector(s)',
      description: 'POST {host}/vectors/upsert with vectors + optional namespace.',
      fields: [
        { id: 'host',      label: 'Index host (overrides credential)', type: 'text', placeholder: 'my-index-xxxx.svc.us-east1-aws.pinecone.io' },
        { id: 'namespace', label: 'Namespace (optional)', type: 'text' },
        { id: 'id',        label: 'Single vector id (when not using vectors[])', type: 'text' },
        { id: 'values',    label: 'Single vector values (JSON array or CSV)', type: 'json' },
        { id: 'metadata',  label: 'Single vector metadata (JSON object)', type: 'json' },
        { id: 'vectors',   label: 'Vectors (JSON array of {id,values,metadata})', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: pineconeUpsertVector,
    },
  ],
} satisfies ForgeBlock);

/* ── 8. Algolia — save object ─────────────────────────────────────────── */

async function algoliaSaveObject(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const appId =
    ctx.credential?.applicationId ?? ctx.credential?.appId ?? str(ctx.options.appId);
  const apiKey =
    ctx.credential?.adminApiKey ?? ctx.credential?.apiKey ?? ctx.credential?.writeApiKey;
  if (!appId || !apiKey) {
    throw new Error('Algolia: credential must include applicationId + admin/write API key');
  }
  const indexName = str(ctx.options.indexName);
  if (!indexName) throw new Error('Algolia: indexName is required');

  const object = asRecord(ctx.options.object);
  if (!object) throw new Error('Algolia: object (JSON) is required');

  const objectId = str(ctx.options.objectId);
  const method: 'POST' | 'PUT' = objectId ? 'PUT' : 'POST';
  const url = objectId
    ? `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/${encodeURIComponent(objectId)}`
    : `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}`;

  const data = await jsonRequest({
    method,
    url,
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: object,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Algolia: ${method} ${indexName}${objectId ? `/${objectId}` : ''}`],
  };
}

registerForgeBlock({
  id: 'forge_algolia',
  name: 'Algolia',
  description: 'Save (add or replace) an object in an Algolia index.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'algolia' as never },
  actions: [
    {
      id: 'save_object',
      label: 'Save object',
      description: 'POST /1/indexes/{indexName} — or PUT with an explicit objectID.',
      fields: [
        { id: 'appId',     label: 'Application ID (overrides credential)', type: 'text' },
        { id: 'indexName', label: 'Index name', type: 'text', required: true },
        { id: 'objectId',  label: 'Object ID (optional — switches to PUT)', type: 'text' },
        { id: 'object',    label: 'Object body (JSON)', type: 'json', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: algoliaSaveObject,
    },
  ],
} satisfies ForgeBlock);

/* ── 9. MeiliSearch — index document ──────────────────────────────────── */

async function meilisearchIndexDocument(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey =
    ctx.credential?.apiKey ?? ctx.credential?.masterKey ?? ctx.credential?.token;
  const host =
    ctx.credential?.host ?? ctx.credential?.url ?? str(ctx.options.host);
  if (!host) {
    throw new Error('MeiliSearch: host is required (e.g. https://meili.example.com)');
  }
  const indexName = str(ctx.options.index);
  if (!indexName) throw new Error('MeiliSearch: index is required');

  let documents: unknown[];
  const docsRaw = ctx.options.documents;
  if (Array.isArray(docsRaw)) {
    documents = docsRaw;
  } else {
    const single = asRecord(docsRaw) ?? asRecord(ctx.options.document);
    if (!single) {
      throw new Error('MeiliSearch: documents (JSON array) or document (JSON object) is required');
    }
    documents = [single];
  }

  const primaryKey = str(ctx.options.primaryKey);
  const params = new URLSearchParams();
  if (primaryKey) params.set('primaryKey', primaryKey);
  const qs = params.toString();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const baseUrl = host.replace(/\/$/, '');
  const url = `${baseUrl}/indexes/${encodeURIComponent(indexName)}/documents${qs ? `?${qs}` : ''}`;
  const data = await jsonRequest({
    method: 'POST',
    url,
    headers,
    body: documents,
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`MeiliSearch: indexed ${documents.length} document(s) into ${indexName}`],
  };
}

registerForgeBlock({
  id: 'forge_meilisearch',
  name: 'MeiliSearch',
  description: 'Add or replace documents in a MeiliSearch index.',
  iconName: 'LuFileSearch',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'meilisearch' as never },
  actions: [
    {
      id: 'index_document',
      label: 'Index document(s)',
      description: 'POST /indexes/{index}/documents with bearer auth.',
      fields: [
        { id: 'host',       label: 'Host URL (overrides credential)', type: 'text', placeholder: 'https://meili.example.com' },
        { id: 'index',      label: 'Index name', type: 'text', required: true },
        { id: 'primaryKey', label: 'Primary key (optional)', type: 'text' },
        { id: 'document',   label: 'Single document (JSON object)', type: 'json' },
        { id: 'documents',  label: 'Documents (JSON array — overrides single)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: meilisearchIndexDocument,
    },
  ],
} satisfies ForgeBlock);

/* ── 10. Cloudinary — signed upload (url) ─────────────────────────────── */

async function cloudinaryUploadUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cloudName =
    ctx.credential?.cloudName ?? str(ctx.options.cloudName);
  const apiKey = ctx.credential?.apiKey;
  const apiSecret = ctx.credential?.apiSecret;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary: credential must include cloudName + apiKey + apiSecret');
  }

  const fileUrl = str(ctx.options.fileUrl);
  if (!fileUrl) throw new Error('Cloudinary: fileUrl is required');

  const resourceType =
    (str(ctx.options.resourceType) || 'image').toLowerCase();
  const publicId = str(ctx.options.publicId);
  const folder = str(ctx.options.folder);
  const tags = str(ctx.options.tags);
  const overwrite = ctx.options.overwrite === true ? 'true' : ctx.options.overwrite === false ? 'false' : '';

  const timestamp = Math.floor(Date.now() / 1000);

  // Signature: alphabetised non-empty params (excluding api_key + file) + apiSecret, sha1 hex.
  const signed: Record<string, string> = { timestamp: String(timestamp) };
  if (publicId) signed.public_id = publicId;
  if (folder) signed.folder = folder;
  if (tags) signed.tags = tags;
  if (overwrite) signed.overwrite = overwrite;

  const toSign = Object.keys(signed)
    .sort()
    .map((k) => `${k}=${signed[k]}`)
    .join('&');
  const signature = createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');

  const form = new URLSearchParams({
    file: fileUrl,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
    ...signed,
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${encodeURIComponent(resourceType)}/upload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(60_000),
    },
  );
  const text = await res.text();
  const data: unknown = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const detail =
      typeof data === 'string' ? data : data ? JSON.stringify(data).slice(0, 400) : '';
    throw new Error(`Cloudinary ${res.status}: ${detail}`);
  }
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Cloudinary: uploaded ${fileUrl} to ${cloudName} (${resourceType})`],
  };
}

registerForgeBlock({
  id: 'forge_cloudinary',
  name: 'Cloudinary',
  description: 'Upload a remote URL to Cloudinary with a signed request.',
  iconName: 'LuImageUp',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'cloudinary' as never },
  actions: [
    {
      id: 'upload_url',
      label: 'Upload from URL',
      description: 'POST /v1_1/{cloud}/{resource}/upload with signed params.',
      fields: [
        { id: 'cloudName',    label: 'Cloud name (overrides credential)', type: 'text' },
        { id: 'fileUrl',      label: 'Source file URL', type: 'text', required: true },
        { id: 'resourceType', label: 'Resource type (image / video / raw / auto)', type: 'text' },
        { id: 'publicId',     label: 'Public ID (optional)', type: 'text' },
        { id: 'folder',       label: 'Folder (optional)', type: 'text' },
        { id: 'tags',         label: 'Tags (comma-separated)', type: 'text' },
        { id: 'overwrite',    label: 'Overwrite existing asset', type: 'toggle' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: cloudinaryUploadUrl,
    },
  ],
} satisfies ForgeBlock);

export const STEP_PLUS_PARITY_BLOCK_IDS = [
  'forge_hubspot',
  'forge_pipedrive_ext',
  'forge_notion_query',
  'forge_calendly',
  'forge_pandadoc',
  'forge_docusign',
  'forge_pinecone',
  'forge_algolia',
  'forge_meilisearch',
  'forge_cloudinary',
] as const;
