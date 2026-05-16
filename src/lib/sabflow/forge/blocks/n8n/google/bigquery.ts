/**
 * Forge block: Google BigQuery
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/BigQuery/{GoogleBigQuery.node.ts, v2}
 * Credential type: 'google_bigquery' — { clientId, clientSecret, refreshToken }
 *
 * Operations:
 *   - query.run     POST /bigquery/v2/projects/{projectId}/queries
 *   - dataset.list  GET  /bigquery/v2/projects/{projectId}/datasets
 *   - table.list    GET  /bigquery/v2/projects/{projectId}/datasets/{datasetId}/tables
 *   - table.get     GET  /bigquery/v2/projects/{projectId}/datasets/{datasetId}/tables/{tableId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://bigquery.googleapis.com/bigquery/v2';
const SERVICE = 'Google BigQuery';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, GOOGLE_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function queryRun(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const query = asString(ctx.options.query);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!query) throw new Error(`${SERVICE}: query is required`);
  const useLegacySql = ctx.options.useLegacySql === true || ctx.options.useLegacySql === 'true';
  const maxResults = asNumber(ctx.options.maxResults);
  const body: Record<string, unknown> = { query, useLegacySql };
  if (typeof maxResults === 'number') body.maxResults = maxResults;
  const data = await call(ctx, 'POST', `/projects/${encodeURIComponent(projectId)}/queries`, body);
  return { outputs: { result: data }, logs: [`BigQuery query → project ${projectId}`] };
}

async function datasetList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  const data = await call(ctx, 'GET', `/projects/${encodeURIComponent(projectId)}/datasets`);
  return { outputs: { result: data }, logs: [`BigQuery dataset list → ${projectId}`] };
}

async function tableList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const datasetId = asString(ctx.options.datasetId);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!datasetId) throw new Error(`${SERVICE}: datasetId is required`);
  const data = await call(
    ctx,
    'GET',
    `/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(datasetId)}/tables`,
  );
  return { outputs: { result: data }, logs: [`BigQuery table list → ${datasetId}`] };
}

async function tableGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const datasetId = asString(ctx.options.datasetId);
  const tableId = asString(ctx.options.tableId);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!datasetId) throw new Error(`${SERVICE}: datasetId is required`);
  if (!tableId) throw new Error(`${SERVICE}: tableId is required`);
  const data = await call(
    ctx,
    'GET',
    `/projects/${encodeURIComponent(projectId)}/datasets/${encodeURIComponent(datasetId)}/tables/${encodeURIComponent(tableId)}`,
  );
  return { outputs: { result: data }, logs: [`BigQuery table get → ${tableId}`] };
}

const block: ForgeBlock = {
  id: 'forge_google_bigquery',
  name: 'Google BigQuery',
  description: 'Run queries and list datasets/tables in Google BigQuery.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'google_bigquery' },
  actions: [
    {
      id: 'query_run',
      label: 'Run query',
      description: 'Run a SQL query against BigQuery.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'query', label: 'SQL query', type: 'code', required: true },
        { id: 'useLegacySql', label: 'Use Legacy SQL', type: 'toggle', defaultValue: false },
        { id: 'maxResults', label: 'Max results', type: 'number' },
      ],
      run: queryRun,
    },
    {
      id: 'dataset_list',
      label: 'List datasets',
      description: 'List all datasets in a project.',
      fields: [{ id: 'projectId', label: 'Project ID', type: 'text', required: true }],
      run: datasetList,
    },
    {
      id: 'table_list',
      label: 'List tables',
      description: 'List tables in a dataset.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'datasetId', label: 'Dataset ID', type: 'text', required: true },
      ],
      run: tableList,
    },
    {
      id: 'table_get',
      label: 'Get table',
      description: 'Get a table by ID.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'datasetId', label: 'Dataset ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
      ],
      run: tableGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
