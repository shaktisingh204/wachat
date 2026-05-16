/**
 * Forge block: n8n API
 *
 * Source: n8n-master/packages/nodes-base/nodes/N8n/N8n.node.ts
 *
 * Auth: `X-N8N-API-KEY` header (inline password field). The user supplies the
 * base URL of a remote n8n instance (e.g. https://n8n.example.com/api/v1).
 *
 * Operations covered:
 *   - workflow.list      GET  /workflows
 *   - workflow.get       GET  /workflows/{id}
 *   - workflow.run-once  POST /workflows/{id}/execute
 *   - execution.list     GET  /executions
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('n8n API: apiKey is required');
  return { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' };
}

function baseUrl(ctx: ForgeActionContext): string {
  const raw = asString(ctx.options.baseUrl);
  if (!raw) throw new Error('n8n API: baseUrl is required');
  return raw.replace(/\/+$/, '');
}

async function workflowList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const active = asString(ctx.options.active);
  if (limit) params.set('limit', limit);
  if (active) params.set('active', active);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'n8n API',
    method: 'GET',
    url: `${baseUrl(ctx)}/workflows${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { workflows: res.data }, logs: ['n8n workflow list'] };
}

async function workflowGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.workflowId);
  if (!id) throw new Error('n8n API: workflowId is required');
  const res = await apiRequest({
    service: 'n8n API',
    method: 'GET',
    url: `${baseUrl(ctx)}/workflows/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { workflow: res.data }, logs: [`n8n workflow get → ${id}`] };
}

async function workflowRunOnce(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.workflowId);
  if (!id) throw new Error('n8n API: workflowId is required');
  const res = await apiRequest({
    service: 'n8n API',
    method: 'POST',
    url: `${baseUrl(ctx)}/workflows/${encodeURIComponent(id)}/execute`,
    headers: authHeaders(ctx),
    json: {},
  });
  return { outputs: { execution: res.data }, logs: [`n8n workflow run-once → ${id}`] };
}

async function executionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const workflowId = asString(ctx.options.workflowId);
  const status = asString(ctx.options.status);
  if (limit) params.set('limit', limit);
  if (workflowId) params.set('workflowId', workflowId);
  if (status) params.set('status', status);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'n8n API',
    method: 'GET',
    url: `${baseUrl(ctx)}/executions${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { executions: res.data }, logs: ['n8n execution list'] };
}

const block: ForgeBlock = {
  id: 'forge_n8n_api',
  name: 'n8n API',
  description: 'Call the REST API of a remote n8n instance.',
  iconName: 'LuWorkflow',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'workflow_list',
      label: 'List workflows',
      description: 'List workflows on the remote n8n instance.',
      fields: [
        { id: 'baseUrl', label: 'Base URL (e.g. https://n8n.example.com/api/v1)', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'active', label: 'Active only (true/false)', type: 'text' },
      ],
      run: workflowList,
    },
    {
      id: 'workflow_get',
      label: 'Get workflow',
      description: 'Fetch a single workflow by id.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workflowId', label: 'Workflow ID', type: 'text', required: true },
      ],
      run: workflowGet,
    },
    {
      id: 'workflow_run_once',
      label: 'Run workflow once',
      description: 'Trigger a manual execution of a workflow.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workflowId', label: 'Workflow ID', type: 'text', required: true },
      ],
      run: workflowRunOnce,
    },
    {
      id: 'execution_list',
      label: 'List executions',
      description: 'List recent executions.',
      fields: [
        { id: 'baseUrl', label: 'Base URL', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workflowId', label: 'Workflow ID (optional)', type: 'text' },
        { id: 'status', label: 'Status (success/error/waiting)', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: executionList,
    },
  ],
};

registerForgeBlock(block);
export default block;
