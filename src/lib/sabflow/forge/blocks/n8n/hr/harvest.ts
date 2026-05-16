/**
 * Forge block: Harvest
 *
 * Source: n8n-master/packages/nodes-base/nodes/Harvest/Harvest.node.ts
 *
 * Auth: Bearer accessToken + Harvest-Account-ID header.
 *
 * Operations covered:
 *   - timeEntry.create    POST /time_entries
 *   - timeEntry.list      GET /time_entries
 *   - project.list        GET /projects
 *   - contact.list        GET /contacts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.harvestapp.com/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  const account = asString(ctx.options.accountId);
  if (!token) throw new Error('Harvest: accessToken is required');
  if (!account) throw new Error('Harvest: accountId is required');
  return {
    Authorization: `Bearer ${token}`,
    'Harvest-Account-ID': account,
    'User-Agent': 'SabFlow Forge (sabnode@example.com)',
  };
}

async function timeEntryCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const taskId = asString(ctx.options.taskId);
  const spentDate = asString(ctx.options.spentDate);
  if (!projectId || !taskId || !spentDate) {
    throw new Error('Harvest: projectId, taskId and spentDate are required');
  }
  const body: Record<string, unknown> = {
    project_id: Number(projectId),
    task_id: Number(taskId),
    spent_date: spentDate,
  };
  const hours = asString(ctx.options.hours);
  const notes = asString(ctx.options.notes);
  if (hours) body.hours = Number(hours);
  if (notes) body.notes = notes;
  const res = await apiRequest({
    service: 'Harvest',
    method: 'POST',
    url: `${API}/time_entries`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { timeEntry: res.data }, logs: [`Harvest time-entry create → ${projectId}/${taskId}`] };
}

async function timeEntryList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const userId = asString(ctx.options.userId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (userId) params.set('user_id', userId);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Harvest',
    method: 'GET',
    url: `${API}/time_entries${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { timeEntries: res.data }, logs: ['Harvest time-entry list'] };
}

async function projectList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Harvest',
    method: 'GET',
    url: `${API}/projects`,
    headers: authHeaders(ctx),
  });
  return { outputs: { projects: res.data }, logs: ['Harvest project list'] };
}

async function contactList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Harvest',
    method: 'GET',
    url: `${API}/contacts`,
    headers: authHeaders(ctx),
  });
  return { outputs: { contacts: res.data }, logs: ['Harvest contact list'] };
}

const block: ForgeBlock = {
  id: 'forge_harvest',
  name: 'Harvest',
  description: 'Track time, list projects and contacts via Harvest.',
  iconName: 'LuClock',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'time_entry_create',
      label: 'Create time entry',
      description: 'Log a time entry against a project/task.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'spentDate', label: 'Spent date (YYYY-MM-DD)', type: 'text', required: true },
        { id: 'hours', label: 'Hours', type: 'number' },
        { id: 'notes', label: 'Notes', type: 'text' },
      ],
      run: timeEntryCreate,
    },
    {
      id: 'time_entry_list',
      label: 'List time entries',
      description: 'Fetch time entries with optional filters.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'from', label: 'From (YYYY-MM-DD)', type: 'text' },
        { id: 'to', label: 'To (YYYY-MM-DD)', type: 'text' },
        { id: 'userId', label: 'User ID', type: 'text' },
      ],
      run: timeEntryList,
    },
    {
      id: 'project_list',
      label: 'List projects',
      description: 'Fetch all projects.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
      ],
      run: projectList,
    },
    {
      id: 'contact_list',
      label: 'List contacts',
      description: 'Fetch all contacts.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
      ],
      run: contactList,
    },
  ],
};

registerForgeBlock(block);
export default block;
