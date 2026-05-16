/**
 * Forge block: Google Tasks
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Task/GoogleTasks.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - task.list    GET    /tasks/v1/lists/{tasklist}/tasks
 *   - task.create  POST   /tasks/v1/lists/{tasklist}/tasks
 *   - task.update  PATCH  /tasks/v1/lists/{tasklist}/tasks/{task}
 *   - task.delete  DELETE /tasks/v1/lists/{tasklist}/tasks/{task}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SERVICE = 'Google Tasks';
const CACHE = 'google_tasks';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

function taskList(opts: Record<string, unknown>): string {
  return encodeURIComponent(asString(opts.tasklist) || '@default');
}

// ── Actions ────────────────────────────────────────────────────────────────

async function taskListAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const params = new URLSearchParams();
  const maxResults = asString(ctx.options.maxResults);
  const showCompleted = asString(ctx.options.showCompleted);
  if (maxResults) params.set('maxResults', maxResults);
  if (showCompleted) params.set('showCompleted', showCompleted);
  const qs = params.toString();
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://tasks.googleapis.com/tasks/v1/lists/${taskList(ctx.options)}/tasks${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Tasks list'] };
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const title = asString(ctx.options.title);
  if (!title) throw new Error(`${SERVICE}: title is required`);
  const body: Record<string, unknown> = { title };
  const notes = asString(ctx.options.notes);
  const due = asString(ctx.options.due);
  if (notes) body.notes = notes;
  if (due) body.due = due;
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `https://tasks.googleapis.com/tasks/v1/lists/${taskList(ctx.options)}/tasks`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Tasks create → ${title}`] };
}

async function taskUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error(`${SERVICE}: taskId is required`);
  const body: Record<string, unknown> = {};
  const title = asString(ctx.options.title);
  const notes = asString(ctx.options.notes);
  const due = asString(ctx.options.due);
  const status = asString(ctx.options.status);
  if (title) body.title = title;
  if (notes) body.notes = notes;
  if (due) body.due = due;
  if (status) body.status = status;
  const res = await apiRequest({
    service: SERVICE,
    method: 'PATCH',
    url: `https://tasks.googleapis.com/tasks/v1/lists/${taskList(ctx.options)}/tasks/${encodeURIComponent(taskId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Tasks update → ${taskId}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error(`${SERVICE}: taskId is required`);
  await apiRequest({
    service: SERVICE,
    method: 'DELETE',
    url: `https://tasks.googleapis.com/tasks/v1/lists/${taskList(ctx.options)}/tasks/${encodeURIComponent(taskId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { taskId }, logs: [`Tasks delete → ${taskId}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_tasks',
  name: 'Google Tasks',
  description: 'List, create, update and delete Google Tasks.',
  iconName: 'LuListTodo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'task_list',
      label: 'List tasks',
      description: 'List tasks on a tasklist (default `@default`).',
      fields: [
        ...authFields,
        { id: 'tasklist', label: 'Tasklist ID', type: 'text', defaultValue: '@default' },
        { id: 'maxResults', label: 'Max results', type: 'number' },
        { id: 'showCompleted', label: 'Show completed (true/false)', type: 'text' },
      ],
      run: taskListAction,
    },
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a task on the chosen tasklist.',
      fields: [
        ...authFields,
        { id: 'tasklist', label: 'Tasklist ID', type: 'text', defaultValue: '@default' },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'notes', label: 'Notes', type: 'textarea' },
        { id: 'due', label: 'Due (RFC3339)', type: 'text' },
      ],
      run: taskCreate,
    },
    {
      id: 'task_update',
      label: 'Update task',
      description: 'Patch fields on an existing task.',
      fields: [
        ...authFields,
        { id: 'tasklist', label: 'Tasklist ID', type: 'text', defaultValue: '@default' },
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'notes', label: 'Notes', type: 'textarea' },
        { id: 'due', label: 'Due (RFC3339)', type: 'text' },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'needsAction', value: 'needsAction' },
            { label: 'completed', value: 'completed' },
          ],
        },
      ],
      run: taskUpdate,
    },
    {
      id: 'task_delete',
      label: 'Delete task',
      description: 'Delete a task by id.',
      fields: [
        ...authFields,
        { id: 'tasklist', label: 'Tasklist ID', type: 'text', defaultValue: '@default' },
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
      ],
      run: taskDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
