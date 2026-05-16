/**
 * Forge block: Flow (legacy)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Flow/Flow.node.ts
 *
 * NOTE: Flow (getflow.com) was sunsetted in 2019; this port is preserved for
 * any historical integrations that still hit cached endpoints. Auth: Bearer
 * access token (inline password field).
 *
 * Operations covered:
 *   - task.create     POST /api/v2/tasks
 *   - task.list       GET  /api/v2/tasks
 *   - project.list    GET  /api/v2/projects
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.getflow.com/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Flow: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.taskName);
  const organizationId = asString(ctx.options.organizationId);
  if (!name) throw new Error('Flow: taskName is required');
  if (!organizationId) throw new Error('Flow: organizationId is required');
  const task: Record<string, unknown> = { name, organization_id: organizationId };
  const projectId = asString(ctx.options.projectId);
  const description = asString(ctx.options.description);
  const dueOn = asString(ctx.options.dueOn);
  if (projectId) task.project_id = projectId;
  if (description) task.description = description;
  if (dueOn) task.due_on = dueOn;
  const res = await apiRequest({
    service: 'Flow',
    method: 'POST',
    url: `${API}/tasks`,
    headers: authHeader(ctx),
    json: { task },
  });
  return { outputs: { task: res.data }, logs: [`Flow task create → ${name}`] };
}

async function taskList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const organizationId = asString(ctx.options.organizationId);
  if (!organizationId) throw new Error('Flow: organizationId is required');
  const params = new URLSearchParams({ organization_id: organizationId });
  const projectId = asString(ctx.options.projectId);
  const limit = asString(ctx.options.limit);
  if (projectId) params.set('project_id', projectId);
  if (limit) params.set('limit', limit);
  const res = await apiRequest({
    service: 'Flow',
    method: 'GET',
    url: `${API}/tasks?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { tasks: res.data }, logs: ['Flow task list'] };
}

async function projectList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const organizationId = asString(ctx.options.organizationId);
  if (!organizationId) throw new Error('Flow: organizationId is required');
  const res = await apiRequest({
    service: 'Flow',
    method: 'GET',
    url: `${API}/projects?organization_id=${encodeURIComponent(organizationId)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { projects: res.data }, logs: ['Flow project list'] };
}

const block: ForgeBlock = {
  id: 'forge_flow',
  name: 'Flow',
  description: 'Manage tasks and projects on Flow (getflow.com).',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a new task in an organization.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'organizationId', label: 'Organization ID', type: 'text', required: true },
        { id: 'taskName', label: 'Task name', type: 'text', required: true },
        { id: 'projectId', label: 'Project ID', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'dueOn', label: 'Due on (YYYY-MM-DD)', type: 'text' },
      ],
      run: taskCreate,
    },
    {
      id: 'task_list',
      label: 'List tasks',
      description: 'List tasks for an organization.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'organizationId', label: 'Organization ID', type: 'text', required: true },
        { id: 'projectId', label: 'Project ID', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: taskList,
    },
    {
      id: 'project_list',
      label: 'List projects',
      description: 'List projects for an organization.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'organizationId', label: 'Organization ID', type: 'text', required: true },
      ],
      run: projectList,
    },
  ],
};

registerForgeBlock(block);
export default block;
