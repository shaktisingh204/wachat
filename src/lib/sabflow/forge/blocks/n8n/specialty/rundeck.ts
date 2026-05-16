/**
 * Forge block: Rundeck
 *
 * Source: n8n-master/packages/nodes-base/nodes/Rundeck/Rundeck.node.ts
 *
 * Self-hosted Rundeck — auth is an API token via `X-Rundeck-Auth-Token`.
 *
 * Operations covered:
 *   - job.list                 GET    /api/{ver}/project/{project}/jobs
 *   - job.get                  GET    /api/{ver}/job/{id}
 *   - job.run                  POST   /api/{ver}/job/{id}/run
 *   - execution.get            GET    /api/{ver}/execution/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function apiRoot(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.baseUrl).trim();
  if (!url) throw new Error('Rundeck: baseUrl is required');
  const version = asString(ctx.options.apiVersion).trim() || '40';
  return `${url.replace(/\/$/, '')}/api/${version}`;
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiToken);
  if (!token) throw new Error('Rundeck: apiToken is required');
  return { 'X-Rundeck-Auth-Token': token, Accept: 'application/json' };
}

function parseJsonOption(v: unknown, field: string): Record<string, unknown> {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(v));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Rundeck: ${field} must be valid JSON`);
  }
  throw new Error(`Rundeck: ${field} must be a JSON object`);
}

async function jobList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const project = asString(ctx.options.project);
  if (!project) throw new Error('Rundeck: project is required');
  const res = await apiRequest({
    service: 'Rundeck',
    method: 'GET',
    url: `${apiRoot(ctx)}/project/${encodeURIComponent(project)}/jobs`,
    headers: authHeader(ctx),
  });
  return { outputs: { jobs: res.data }, logs: [`Rundeck job list → ${project}`] };
}

async function jobGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.jobId);
  if (!id) throw new Error('Rundeck: jobId is required');
  const res = await apiRequest({
    service: 'Rundeck',
    method: 'GET',
    url: `${apiRoot(ctx)}/job/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { job: res.data }, logs: [`Rundeck job get → ${id}`] };
}

async function jobRun(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.jobId);
  if (!id) throw new Error('Rundeck: jobId is required');
  const body: Record<string, unknown> = {};
  const options = ctx.options.jobOptions;
  if (options != null && options !== '') {
    body.options = parseJsonOption(options, 'jobOptions');
  }
  const filter = asString(ctx.options.nodeFilter).trim();
  if (filter) body.filter = filter;
  const res = await apiRequest({
    service: 'Rundeck',
    method: 'POST',
    url: `${apiRoot(ctx)}/job/${encodeURIComponent(id)}/run`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { execution: res.data }, logs: [`Rundeck job run → ${id}`] };
}

async function executionGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.executionId);
  if (!id) throw new Error('Rundeck: executionId is required');
  const res = await apiRequest({
    service: 'Rundeck',
    method: 'GET',
    url: `${apiRoot(ctx)}/execution/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { execution: res.data }, logs: [`Rundeck execution get → ${id}`] };
}

const CRED_FIELDS = [
  {
    id: 'baseUrl',
    label: 'Base URL',
    type: 'text' as const,
    required: true,
    placeholder: 'https://rundeck.example.com',
  },
  { id: 'apiToken', label: 'API token', type: 'password' as const, required: true },
  {
    id: 'apiVersion',
    label: 'API version',
    type: 'text' as const,
    defaultValue: '40',
    helperText: 'Rundeck API version — defaults to 40.',
  },
];

const block: ForgeBlock = {
  id: 'forge_rundeck',
  name: 'Rundeck',
  description: 'List and run Rundeck jobs and inspect executions on a self-hosted server.',
  iconName: 'LuPlay',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'job_list',
      label: 'List jobs',
      description: 'Fetch jobs in a project.',
      fields: [
        ...CRED_FIELDS,
        { id: 'project', label: 'Project', type: 'text', required: true },
      ],
      run: jobList,
    },
    {
      id: 'job_get',
      label: 'Get job',
      description: 'Fetch a job definition by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'jobId', label: 'Job ID', type: 'text', required: true },
      ],
      run: jobGet,
    },
    {
      id: 'job_run',
      label: 'Run job',
      description: 'Trigger a job execution with optional inputs and node filter.',
      fields: [
        ...CRED_FIELDS,
        { id: 'jobId', label: 'Job ID', type: 'text', required: true },
        {
          id: 'jobOptions',
          label: 'Job options',
          type: 'json',
          placeholder: '{"branch": "main"}',
          helperText: 'Map of option name → value passed to the job.',
        },
        { id: 'nodeFilter', label: 'Node filter', type: 'text', placeholder: 'tags: webserver' },
      ],
      run: jobRun,
    },
    {
      id: 'execution_get',
      label: 'Get execution',
      description: 'Fetch a single execution by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'executionId', label: 'Execution ID', type: 'text', required: true },
      ],
      run: executionGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
