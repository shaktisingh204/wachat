/**
 * Forge block: Onfleet
 *
 * Source: n8n-master/packages/nodes-base/nodes/Onfleet/Onfleet.node.ts
 *
 * Auth: Basic (apiKey:) on `https://onfleet.com/api/v2`.
 *
 * Operations covered:
 *   - task.create   POST /tasks
 *   - task.get      GET  /tasks/{id}
 *   - task.list     GET  /tasks/all
 *   - worker.list   GET  /workers
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://onfleet.com/api/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Onfleet: apiKey is required');
  return {
    Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    Accept: 'application/json',
  };
}

function parseJsonField(label: string, raw: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Onfleet: invalid JSON for ${label} (${(err as Error).message})`);
  }
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const destination = parseJsonField('destination', asString(ctx.options.destination));
  const recipients = parseJsonField('recipients', asString(ctx.options.recipients));
  if (!destination) throw new Error('Onfleet: destination JSON is required');
  const body: Record<string, unknown> = { destination };
  if (recipients) body.recipients = recipients;
  const notes = asString(ctx.options.notes);
  const completeAfter = asString(ctx.options.completeAfter);
  const completeBefore = asString(ctx.options.completeBefore);
  if (notes) body.notes = notes;
  if (completeAfter) body.completeAfter = Number(completeAfter);
  if (completeBefore) body.completeBefore = Number(completeBefore);
  const res = await apiRequest({
    service: 'Onfleet',
    method: 'POST',
    url: `${API}/tasks`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { task: res.data }, logs: ['Onfleet task create'] };
}

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Onfleet: taskId is required');
  const res = await apiRequest({
    service: 'Onfleet',
    method: 'GET',
    url: `${API}/tasks/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { task: res.data }, logs: [`Onfleet task get → ${id}`] };
}

async function taskList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const state = asString(ctx.options.state);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (state) params.set('state', state);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Onfleet',
    method: 'GET',
    url: `${API}/tasks/all${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { tasks: res.data }, logs: ['Onfleet task list'] };
}

async function workerList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Onfleet',
    method: 'GET',
    url: `${API}/workers`,
    headers: authHeaders(ctx),
  });
  return { outputs: { workers: res.data }, logs: ['Onfleet worker list'] };
}

const block: ForgeBlock = {
  id: 'forge_onfleet',
  name: 'Onfleet',
  description: 'Manage Onfleet last-mile delivery tasks and workers.',
  iconName: 'LuTruck',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a delivery task.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'destination', label: 'Destination JSON', type: 'text', required: true, placeholder: '{"address":{"unparsed":"123 Main St"}}' },
        { id: 'recipients', label: 'Recipients JSON', type: 'text', placeholder: '[{"name":"Jane","phone":"+15551112222"}]' },
        { id: 'notes', label: 'Notes', type: 'text' },
        { id: 'completeAfter', label: 'Complete after (ms epoch)', type: 'number' },
        { id: 'completeBefore', label: 'Complete before (ms epoch)', type: 'number' },
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
      description: 'List tasks in a date window with optional state filter.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'from', label: 'From (ms epoch)', type: 'text' },
        { id: 'to', label: 'To (ms epoch)', type: 'text' },
        { id: 'state', label: 'State', type: 'text', placeholder: '0,1,2,3' },
      ],
      run: taskList,
    },
    {
      id: 'worker_list',
      label: 'List workers',
      description: 'Fetch all workers.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: workerList,
    },
  ],
};

registerForgeBlock(block);
export default block;
