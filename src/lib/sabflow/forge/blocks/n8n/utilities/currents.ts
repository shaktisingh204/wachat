/**
 * Forge block: Currents
 *
 * Source: n8n-master/packages/nodes-base/nodes/Currents/Currents.node.ts
 *
 * Auth: `Authorization: Bearer <apiKey>` against https://api.currents.dev/v1.
 *
 * Operations covered:
 *   - project.list        GET /projects
 *   - project.get         GET /projects/{projectId}
 *   - run.get             GET /runs/{runId}
 *   - run.cancel          PUT /runs/{runId}/cancel
 *   - instance.get        GET /instances/{instanceId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.currents.dev/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Currents: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function projectList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Currents',
    method: 'GET',
    url: `${API}/projects`,
    headers: authHeaders(ctx),
  });
  return { outputs: { projects: res.data }, logs: ['Currents project list'] };
}

async function projectGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.projectId);
  if (!id) throw new Error('Currents: projectId is required');
  const res = await apiRequest({
    service: 'Currents',
    method: 'GET',
    url: `${API}/projects/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { project: res.data }, logs: [`Currents project get → ${id}`] };
}

async function runGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.runId);
  if (!id) throw new Error('Currents: runId is required');
  const res = await apiRequest({
    service: 'Currents',
    method: 'GET',
    url: `${API}/runs/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { run: res.data }, logs: [`Currents run get → ${id}`] };
}

async function runCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.runId);
  if (!id) throw new Error('Currents: runId is required');
  const res = await apiRequest({
    service: 'Currents',
    method: 'PUT',
    url: `${API}/runs/${encodeURIComponent(id)}/cancel`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data, success: true }, logs: [`Currents run cancel → ${id}`] };
}

async function instanceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.instanceId);
  if (!id) throw new Error('Currents: instanceId is required');
  const res = await apiRequest({
    service: 'Currents',
    method: 'GET',
    url: `${API}/instances/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { instance: res.data }, logs: [`Currents instance get → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_currents',
  name: 'Currents',
  description: 'Currents test orchestration: projects, runs and instances.',
  iconName: 'LuFlaskConical',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'project_list',
      label: 'List projects',
      description: 'List all Currents projects.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: projectList,
    },
    {
      id: 'project_get',
      label: 'Get project',
      description: 'Fetch a single project by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
      ],
      run: projectGet,
    },
    {
      id: 'run_get',
      label: 'Get run',
      description: 'Fetch a single test run.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'runId', label: 'Run ID', type: 'text', required: true },
      ],
      run: runGet,
    },
    {
      id: 'run_cancel',
      label: 'Cancel run',
      description: 'Cancel a running test run.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'runId', label: 'Run ID', type: 'text', required: true },
      ],
      run: runCancel,
    },
    {
      id: 'instance_get',
      label: 'Get instance',
      description: 'Fetch a single spec file execution instance.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'instanceId', label: 'Instance ID', type: 'text', required: true },
      ],
      run: instanceGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
