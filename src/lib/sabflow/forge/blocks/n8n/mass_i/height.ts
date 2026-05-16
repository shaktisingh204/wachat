/**
 * Forge block: Height
 *
 * API: https://www.height.app/api
 * Auth: `Authorization: api-key <api_key>`.
 *
 * Operations covered:
 *   - task.create               POST   /tasks
 *   - task.get                  GET    /tasks/{id}
 *   - task.list                 GET    /tasks
 *   - list.list                 GET    /lists
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.height.app';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Height: apiKey is required');
  return { Authorization: `api-key ${key}` };
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const listIds = asString(ctx.options.listIds);
  if (!name || !listIds) throw new Error('Height: name and listIds (CSV) are required');
  const body: Record<string, unknown> = {
    name,
    listIds: listIds.split(',').map((s) => s.trim()).filter(Boolean),
  };
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const res = await apiRequest({
    service: 'Height',
    method: 'POST',
    url: `${API}/tasks`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { task: res.data }, logs: [`Height task create → ${name}`] };
}

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Height: taskId is required');
  const res = await apiRequest({
    service: 'Height',
    method: 'GET',
    url: `${API}/tasks/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { task: res.data }, logs: [`Height task get → ${id}`] };
}

async function taskList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const filters = asString(ctx.options.filters);
  if (filters) params.set('filters', filters);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Height',
    method: 'GET',
    url: `${API}/tasks${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { tasks: res.data }, logs: ['Height task list'] };
}

async function listList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Height',
    method: 'GET',
    url: `${API}/lists`,
    headers: authHeader(ctx),
  });
  return { outputs: { lists: res.data }, logs: ['Height list list'] };
}

const block: ForgeBlock = {
  id: 'forge_height',
  name: 'Height',
  description: 'Height tasks and lists.',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a new task.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'listIds', label: 'List IDs (CSV)', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
      ],
      run: taskCreate,
    },
    {
      id: 'task_get',
      label: 'Get task',
      description: 'Fetch a task by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
      ],
      run: taskGet,
    },
    {
      id: 'task_list',
      label: 'List tasks',
      description: 'List tasks with optional filter JSON.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'filters', label: 'Filters JSON', type: 'textarea' },
      ],
      run: taskList,
    },
    {
      id: 'list_list',
      label: 'List lists',
      description: 'List all lists.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: listList,
    },
  ],
};

registerForgeBlock(block);
export default block;
