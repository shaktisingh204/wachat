/**
 * Forge block: Azure Cosmos DB (SQL API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/AzureCosmosDb/AzureCosmosDb.node.ts
 *
 * Auth: Azure AD OAuth2 refresh-token grant against the Cosmos DB resource
 *   (https://cosmos.azure.com). clientId/clientSecret/refreshToken inline.
 *   Every request also needs the `x-ms-version: 2018-12-31` header per the
 *   Cosmos REST contract.
 *
 * REST base: https://{account}.documents.azure.com/dbs/{database}/colls/{collection}
 *
 * Operations:
 *   - document.create POST  /docs
 *   - document.get    GET   /docs/{id}    (requires x-ms-documentdb-partitionkey)
 *   - document.query  POST  /docs         (x-ms-documentdb-isquery: True, query JSON)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const SERVICE = 'Azure Cosmos DB';

function readCred(ctx: ForgeActionContext): Record<string, string> {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

function baseUrl(ctx: ForgeActionContext): string {
  const account = asString(ctx.options.account);
  const database = asString(ctx.options.database);
  const collection = asString(ctx.options.collection);
  if (!account) throw new Error(`${SERVICE}: account is required`);
  if (!database) throw new Error(`${SERVICE}: database is required`);
  if (!collection) throw new Error(`${SERVICE}: collection is required`);
  return `https://${account}.documents.azure.com/dbs/${encodeURIComponent(database)}/colls/${encodeURIComponent(collection)}`;
}

function partitionKeyHeader(pk: string): string {
  // Cosmos expects a stringified JSON array, e.g. `["myKey"]`.
  return JSON.stringify([pk]);
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

const targetFields = [
  { id: 'account', label: 'Account name', type: 'text' as const, required: true },
  { id: 'database', label: 'Database', type: 'text' as const, required: true },
  { id: 'collection', label: 'Collection (container)', type: 'text' as const, required: true },
];

async function documentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), MICROSOFT_TOKEN_URL);
  const partitionKey = asString(ctx.options.partitionKey);
  const docRaw = asString(ctx.options.document).trim();
  if (!partitionKey) throw new Error(`${SERVICE}: partitionKey value is required`);
  if (!docRaw) throw new Error(`${SERVICE}: document is required`);
  let document: unknown;
  try {
    document = JSON.parse(docRaw);
  } catch {
    throw new Error(`${SERVICE}: document must be valid JSON`);
  }
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `${baseUrl(ctx)}/docs`,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ms-version': '2018-12-31',
      'x-ms-documentdb-partitionkey': partitionKeyHeader(partitionKey),
    },
    json: document,
  });
  return { outputs: { result: res.data }, logs: ['Cosmos document create'] };
}

async function documentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), MICROSOFT_TOKEN_URL);
  const id = asString(ctx.options.id);
  const partitionKey = asString(ctx.options.partitionKey);
  if (!id) throw new Error(`${SERVICE}: id is required`);
  if (!partitionKey) throw new Error(`${SERVICE}: partitionKey value is required`);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `${baseUrl(ctx)}/docs/${encodeURIComponent(id)}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ms-version': '2018-12-31',
      'x-ms-documentdb-partitionkey': partitionKeyHeader(partitionKey),
    },
  });
  return { outputs: { result: res.data }, logs: [`Cosmos document get → ${id}`] };
}

async function documentQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), MICROSOFT_TOKEN_URL);
  const query = asString(ctx.options.query);
  if (!query) throw new Error(`${SERVICE}: query is required`);
  const paramsRaw = asString(ctx.options.parameters).trim();
  let parameters: unknown = [];
  if (paramsRaw) {
    try {
      parameters = JSON.parse(paramsRaw);
    } catch {
      throw new Error(`${SERVICE}: parameters must be valid JSON array`);
    }
    if (!Array.isArray(parameters)) {
      throw new Error(`${SERVICE}: parameters must be a JSON array`);
    }
  }
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `${baseUrl(ctx)}/docs`,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-ms-version': '2018-12-31',
      'x-ms-documentdb-isquery': 'True',
      'Content-Type': 'application/query+json',
      'x-ms-documentdb-query-enablecrosspartition': 'True',
    },
    json: { query, parameters },
  });
  return { outputs: { result: res.data }, logs: ['Cosmos query'] };
}

const block: ForgeBlock = {
  id: 'forge_azure_cosmos_db',
  name: 'Azure Cosmos DB',
  description: 'Create, fetch, and query documents in an Azure Cosmos DB SQL container.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'document_create',
      label: 'Create document',
      description: 'Insert a new document into the collection.',
      fields: [
        ...authFields,
        ...targetFields,
        { id: 'partitionKey', label: 'Partition key value', type: 'text', required: true },
        { id: 'document', label: 'Document (JSON)', type: 'json', required: true },
      ],
      run: documentCreate,
    },
    {
      id: 'document_get',
      label: 'Get document',
      description: 'Retrieve a document by id (partition key required).',
      fields: [
        ...authFields,
        ...targetFields,
        { id: 'id', label: 'Document ID', type: 'text', required: true },
        { id: 'partitionKey', label: 'Partition key value', type: 'text', required: true },
      ],
      run: documentGet,
    },
    {
      id: 'document_query',
      label: 'Query documents',
      description: 'Run a cross-partition SQL query.',
      fields: [
        ...authFields,
        ...targetFields,
        { id: 'query', label: 'SQL query', type: 'textarea', required: true, placeholder: 'SELECT * FROM c WHERE c.type = @type' },
        { id: 'parameters', label: 'Parameters (JSON array)', type: 'json', placeholder: '[{"name":"@type","value":"foo"}]' },
      ],
      run: documentQuery,
    },
  ],
};

registerForgeBlock(block);
export default block;
