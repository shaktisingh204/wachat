/**
 * Forge block: Microsoft ToDo (Graph)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/ToDo/MicrosoftToDo.node.ts
 * Credential type: 'microsoft_todo' — { clientId, clientSecret, refreshToken }
 *
 * Operations (Graph v1.0):
 *   - list.list   GET    /me/todo/lists
 *   - task.list   GET    /me/todo/lists/{listId}/tasks
 *   - task.create POST   /me/todo/lists/{listId}/tasks
 *   - task.delete DELETE /me/todo/lists/{listId}/tasks/{taskId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://graph.microsoft.com/v1.0';
const SERVICE = 'Microsoft ToDo';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, MICROSOFT_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function listList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', `/me/todo/lists`);
  return { outputs: { result: data }, logs: ['ToDo lists'] };
}

async function taskList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  if (!listId) throw new Error(`${SERVICE}: listId is required`);
  const data = await call(ctx, 'GET', `/me/todo/lists/${encodeURIComponent(listId)}/tasks`);
  return { outputs: { result: data }, logs: [`ToDo tasks → ${listId}`] };
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const title = asString(ctx.options.title);
  if (!listId) throw new Error(`${SERVICE}: listId is required`);
  if (!title) throw new Error(`${SERVICE}: title is required`);
  const body: Record<string, unknown> = { title };
  const bodyContent = asString(ctx.options.body);
  if (bodyContent) body.body = { content: bodyContent, contentType: 'text' };
  const dueDateTime = asString(ctx.options.dueDateTime);
  if (dueDateTime) {
    body.dueDateTime = { dateTime: dueDateTime, timeZone: asString(ctx.options.timeZone) || 'UTC' };
  }
  const data = await call(
    ctx,
    'POST',
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
    body,
  );
  return { outputs: { result: data }, logs: [`ToDo task create → ${title}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const taskId = asString(ctx.options.taskId);
  if (!listId) throw new Error(`${SERVICE}: listId is required`);
  if (!taskId) throw new Error(`${SERVICE}: taskId is required`);
  const data = await call(
    ctx,
    'DELETE',
    `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
  );
  return { outputs: { result: data }, logs: [`ToDo task delete → ${taskId}`] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_todo',
  name: 'Microsoft ToDo',
  description: 'List task lists; list, create and delete tasks in Microsoft ToDo.',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'microsoft_todo' },
  actions: [
    {
      id: 'list_list',
      label: 'List task lists',
      description: 'List the signed-in user\'s ToDo lists.',
      fields: [],
      run: listList,
    },
    {
      id: 'task_list',
      label: 'List tasks',
      description: 'List tasks in a ToDo list.',
      fields: [{ id: 'listId', label: 'List ID', type: 'text', required: true }],
      run: taskList,
    },
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a task on a list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'body', label: 'Body', type: 'textarea' },
        { id: 'dueDateTime', label: 'Due (ISO 8601)', type: 'text' },
        { id: 'timeZone', label: 'Time zone', type: 'text', defaultValue: 'UTC' },
      ],
      run: taskCreate,
    },
    {
      id: 'task_delete',
      label: 'Delete task',
      description: 'Delete a task by ID.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
      ],
      run: taskDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
