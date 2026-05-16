/**
 * Forge block: Clockify
 *
 * Source: n8n-master/packages/nodes-base/nodes/Clockify/Clockify.node.ts
 *
 * Auth: X-Api-Key header.
 *
 * Operations covered:
 *   - workspace.list      GET /workspaces
 *   - project.list        GET /workspaces/{workspaceId}/projects
 *   - timeEntry.create    POST /workspaces/{workspaceId}/time-entries
 *   - timeEntry.list      GET /workspaces/{workspaceId}/user/{userId}/time-entries
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.clockify.me/api/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Clockify: apiKey is required');
  return { 'X-Api-Key': apiKey };
}

async function workspaceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Clockify',
    method: 'GET',
    url: `${API}/workspaces`,
    headers: authHeaders(ctx),
  });
  return { outputs: { workspaces: res.data }, logs: ['Clockify workspace list'] };
}

async function projectList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ws = asString(ctx.options.workspaceId);
  if (!ws) throw new Error('Clockify: workspaceId is required');
  const res = await apiRequest({
    service: 'Clockify',
    method: 'GET',
    url: `${API}/workspaces/${encodeURIComponent(ws)}/projects`,
    headers: authHeaders(ctx),
  });
  return { outputs: { projects: res.data }, logs: [`Clockify project list → ${ws}`] };
}

async function timeEntryCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ws = asString(ctx.options.workspaceId);
  const start = asString(ctx.options.start);
  if (!ws) throw new Error('Clockify: workspaceId is required');
  if (!start) throw new Error('Clockify: start is required');
  const body: Record<string, unknown> = { start };
  const end = asString(ctx.options.end);
  const description = asString(ctx.options.description);
  const projectId = asString(ctx.options.projectId);
  const taskId = asString(ctx.options.taskId);
  const billable = asString(ctx.options.billable);
  if (end) body.end = end;
  if (description) body.description = description;
  if (projectId) body.projectId = projectId;
  if (taskId) body.taskId = taskId;
  if (billable) body.billable = billable === 'true';
  const res = await apiRequest({
    service: 'Clockify',
    method: 'POST',
    url: `${API}/workspaces/${encodeURIComponent(ws)}/time-entries`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { timeEntry: res.data }, logs: [`Clockify time-entry create → ${ws}`] };
}

async function timeEntryList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ws = asString(ctx.options.workspaceId);
  const userId = asString(ctx.options.userId);
  if (!ws || !userId) throw new Error('Clockify: workspaceId and userId are required');
  const res = await apiRequest({
    service: 'Clockify',
    method: 'GET',
    url: `${API}/workspaces/${encodeURIComponent(ws)}/user/${encodeURIComponent(userId)}/time-entries`,
    headers: authHeaders(ctx),
  });
  return { outputs: { timeEntries: res.data }, logs: [`Clockify time-entry list → ${userId}`] };
}

const block: ForgeBlock = {
  id: 'forge_clockify',
  name: 'Clockify',
  description: 'Track time, list workspaces and projects via Clockify.',
  iconName: 'LuClock',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'workspace_list',
      label: 'List workspaces',
      description: 'Fetch all workspaces visible to the API key.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: workspaceList,
    },
    {
      id: 'project_list',
      label: 'List projects',
      description: 'Fetch projects in a workspace.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workspaceId', label: 'Workspace ID', type: 'text', required: true },
      ],
      run: projectList,
    },
    {
      id: 'time_entry_create',
      label: 'Create time entry',
      description: 'Log a time entry in a workspace.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workspaceId', label: 'Workspace ID', type: 'text', required: true },
        { id: 'start', label: 'Start (ISO 8601)', type: 'text', required: true, placeholder: '2026-05-16T09:00:00Z' },
        { id: 'end', label: 'End (ISO 8601)', type: 'text' },
        { id: 'description', label: 'Description', type: 'text' },
        { id: 'projectId', label: 'Project ID', type: 'text' },
        { id: 'taskId', label: 'Task ID', type: 'text' },
        { id: 'billable', label: 'Billable', type: 'text', placeholder: 'true/false' },
      ],
      run: timeEntryCreate,
    },
    {
      id: 'time_entry_list',
      label: 'List time entries',
      description: 'Fetch a user\'s time entries in a workspace.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'workspaceId', label: 'Workspace ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: timeEntryList,
    },
  ],
};

registerForgeBlock(block);
export default block;
