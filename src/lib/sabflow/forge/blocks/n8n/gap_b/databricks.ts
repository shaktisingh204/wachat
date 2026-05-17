/**
 * Forge block: Databricks
 *
 * Source: n8n-master/packages/nodes-base/nodes/Databricks
 *
 * Base URL: https://{workspace}.cloud.databricks.com/api/2.0
 * Auth: Bearer personal access token.
 *
 * Operations covered:
 *   - cluster.list       GET  /clusters/list
 *   - cluster.get        GET  /clusters/get?cluster_id=...
 *   - job.run_now        POST /jobs/run-now
 *   - job.runs_list      GET  /jobs/runs/list
 *   - sql.execute        POST /sql/statements
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function workspaceBase(ctx: ForgeActionContext): string {
  const workspace = asString(ctx.options.workspace);
  if (!workspace) throw new Error('Databricks: workspace is required');
  // Accept either the bare workspace host or a full URL.
  if (/^https?:\/\//i.test(workspace)) return workspace.replace(/\/$/, '') + '/api/2.0';
  return `https://${workspace}.cloud.databricks.com/api/2.0`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.token);
  if (!token) throw new Error('Databricks: token is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function clusterList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Databricks',
    method: 'GET',
    url: `${workspaceBase(ctx)}/clusters/list`,
    headers: authHeaders(ctx),
  });
  const body = res.data as { clusters?: unknown[] };
  const clusters = body?.clusters ?? [];
  return {
    outputs: { clusters, count: Array.isArray(clusters) ? clusters.length : 0 },
    logs: [`Databricks clusters list → ${Array.isArray(clusters) ? clusters.length : 0}`],
  };
}

async function clusterGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.clusterId);
  if (!id) throw new Error('Databricks: clusterId is required');
  const res = await apiRequest({
    service: 'Databricks',
    method: 'GET',
    url: `${workspaceBase(ctx)}/clusters/get?cluster_id=${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { cluster: res.data },
    logs: [`Databricks cluster get → ${id}`],
  };
}

async function jobRunNow(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const jobId = asNumber(ctx.options.jobId);
  if (jobId === undefined) throw new Error('Databricks: jobId is required');
  const paramsRaw = asString(ctx.options.notebookParams);
  const notebookParams = paramsRaw ? (JSON.parse(paramsRaw) as Record<string, unknown>) : undefined;
  const res = await apiRequest({
    service: 'Databricks',
    method: 'POST',
    url: `${workspaceBase(ctx)}/jobs/run-now`,
    headers: authHeaders(ctx),
    json: { job_id: jobId, notebook_params: notebookParams },
  });
  return {
    outputs: { run: res.data },
    logs: [`Databricks job run_now → ${jobId}`],
  };
}

async function jobRunsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const jobId = asString(ctx.options.jobId);
  const limit = asString(ctx.options.limit);
  if (jobId) params.set('job_id', jobId);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Databricks',
    method: 'GET',
    url: `${workspaceBase(ctx)}/jobs/runs/list${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  const body = res.data as { runs?: unknown[] };
  const runs = body?.runs ?? [];
  return {
    outputs: { runs, count: Array.isArray(runs) ? runs.length : 0 },
    logs: [`Databricks runs list → ${Array.isArray(runs) ? runs.length : 0}`],
  };
}

async function sqlExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const warehouseId = asString(ctx.options.warehouseId);
  const statement = asString(ctx.options.statement);
  if (!warehouseId) throw new Error('Databricks: warehouseId is required');
  if (!statement) throw new Error('Databricks: statement is required');
  const res = await apiRequest({
    service: 'Databricks',
    method: 'POST',
    url: `${workspaceBase(ctx)}/sql/statements`,
    headers: authHeaders(ctx),
    json: {
      warehouse_id: warehouseId,
      statement,
      wait_timeout: asString(ctx.options.waitTimeout) || '30s',
    },
  });
  return {
    outputs: { result: res.data },
    logs: [`Databricks sql execute → ${warehouseId}`],
  };
}

const inlineCreds = [
  {
    id: 'workspace',
    label: 'Workspace host',
    type: 'text' as const,
    required: true,
    placeholder: 'dbc-xxxx-xxxx (or full URL)',
    helperText: 'Either the bare subdomain or a full https URL.',
  },
  { id: 'token', label: 'Personal access token', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_databricks',
  name: 'Databricks',
  description: 'Manage Databricks clusters, jobs and SQL statements over the REST 2.0 API.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'cluster_list',
      label: 'List clusters',
      description: 'GET /clusters/list.',
      fields: [...inlineCreds],
      run: clusterList,
    },
    {
      id: 'cluster_get',
      label: 'Get cluster',
      description: 'GET /clusters/get?cluster_id=…',
      fields: [
        ...inlineCreds,
        { id: 'clusterId', label: 'Cluster ID', type: 'text', required: true },
      ],
      run: clusterGet,
    },
    {
      id: 'job_run_now',
      label: 'Run job now',
      description: 'POST /jobs/run-now.',
      fields: [
        ...inlineCreds,
        { id: 'jobId', label: 'Job ID', type: 'number', required: true },
        { id: 'notebookParams', label: 'Notebook params (JSON)', type: 'textarea' },
      ],
      run: jobRunNow,
    },
    {
      id: 'job_runs_list',
      label: 'List job runs',
      description: 'GET /jobs/runs/list.',
      fields: [
        ...inlineCreds,
        { id: 'jobId', label: 'Job ID', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: jobRunsList,
    },
    {
      id: 'sql_execute',
      label: 'Execute SQL',
      description: 'POST /sql/statements.',
      fields: [
        ...inlineCreds,
        { id: 'warehouseId', label: 'Warehouse ID', type: 'text', required: true },
        { id: 'statement', label: 'SQL statement', type: 'textarea', required: true },
        { id: 'waitTimeout', label: 'Wait timeout', type: 'text', placeholder: '30s' },
      ],
      run: sqlExecute,
    },
  ],
};

registerForgeBlock(block);
export default block;
