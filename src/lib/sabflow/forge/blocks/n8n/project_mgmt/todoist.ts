/**
 * Forge block: Todoist
 *
 * Source: n8n-master/packages/nodes-base/nodes/Todoist/Todoist.node.ts
 * Credential type: 'todoist' (CREDENTIAL_FIELD_SCHEMAS → { apiToken }).
 *
 * Operations covered (task + comment subset, REST v2):
 *   - task.create   POST   /rest/v2/tasks
 *   - task.get      GET    /rest/v2/tasks/{id}
 *   - task.update   POST   /rest/v2/tasks/{id}
 *   - task.delete   DELETE /rest/v2/tasks/{id}
 *   - task.close    POST   /rest/v2/tasks/{id}/close
 *   - comment.create POST  /rest/v2/comments
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.todoist.com/rest/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Todoist', ctx.credential);
  const token = cred.apiToken ?? cred.accessToken;
  if (!token) throw new Error('Todoist: credential is missing `apiToken`');
  return { Authorization: `Bearer ${token}` };
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Todoist: content is required');
  const body: Record<string, unknown> = { content };
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const projectId = asString(ctx.options.projectId);
  if (projectId) body.project_id = projectId;
  const dueString = asString(ctx.options.dueString);
  if (dueString) body.due_string = dueString;
  const priority = asString(ctx.options.priority);
  if (priority) body.priority = Number(priority);
  const labels = asString(ctx.options.labels);
  if (labels) body.labels = labels.split(',').map((s) => s.trim()).filter(Boolean);

  const res = await apiRequest({
    service: 'Todoist',
    method: 'POST',
    url: `${BASE}/tasks`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { task: res.data }, logs: [`Todoist task create → ${(res.data as { id?: string })?.id}`] };
}

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Todoist: id is required');
  const res = await apiRequest({
    service: 'Todoist',
    method: 'GET',
    url: `${BASE}/tasks/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { task: res.data }, logs: [`Todoist task get → ${id}`] };
}

async function taskUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Todoist: id is required');
  const body: Record<string, unknown> = {};
  const content = asString(ctx.options.content);
  if (content) body.content = content;
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const dueString = asString(ctx.options.dueString);
  if (dueString) body.due_string = dueString;
  const priority = asString(ctx.options.priority);
  if (priority) body.priority = Number(priority);
  const labels = asString(ctx.options.labels);
  if (labels) body.labels = labels.split(',').map((s) => s.trim()).filter(Boolean);

  if (Object.keys(body).length === 0) {
    throw new Error('Todoist: at least one updatable field must be set');
  }
  const res = await apiRequest({
    service: 'Todoist',
    method: 'POST',
    url: `${BASE}/tasks/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { task: res.data }, logs: [`Todoist task update → ${id}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Todoist: id is required');
  await apiRequest({
    service: 'Todoist',
    method: 'DELETE',
    url: `${BASE}/tasks/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`Todoist task delete → ${id}`] };
}

async function taskClose(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Todoist: id is required');
  await apiRequest({
    service: 'Todoist',
    method: 'POST',
    url: `${BASE}/tasks/${encodeURIComponent(id)}/close`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`Todoist task close → ${id}`] };
}

async function commentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  const projectId = asString(ctx.options.projectId);
  const content = asString(ctx.options.content);
  if (!content) throw new Error('Todoist: content is required');
  if (!taskId && !projectId) throw new Error('Todoist: either taskId or projectId is required');

  const body: Record<string, unknown> = { content };
  if (taskId) body.task_id = taskId;
  else if (projectId) body.project_id = projectId;

  const res = await apiRequest({
    service: 'Todoist',
    method: 'POST',
    url: `${BASE}/comments`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { comment: res.data }, logs: [`Todoist comment → ${taskId || projectId}`] };
}

const block: ForgeBlock = {
  id: 'forge_todoist',
  name: 'Todoist',
  description: 'Create, update and complete Todoist tasks from a flow.',
  iconName: 'LuCheckSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'todoist' },
  actions: [
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a new task.',
      fields: [
        { id: 'content', label: 'Content', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'projectId', label: 'Project ID', type: 'text' },
        { id: 'dueString', label: 'Due (natural language e.g. "tomorrow")', type: 'text' },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: '(default)', value: '' },
            { label: 'Urgent (4)', value: '4' },
            { label: 'High (3)', value: '3' },
            { label: 'Medium (2)', value: '2' },
            { label: 'Normal (1)', value: '1' },
          ],
        },
        { id: 'labels', label: 'Labels (comma separated)', type: 'text' },
      ],
      run: taskCreate,
    },
    {
      id: 'task_get',
      label: 'Get task',
      description: 'Fetch a single task by id.',
      fields: [{ id: 'id', label: 'Task ID', type: 'text', required: true }],
      run: taskGet,
    },
    {
      id: 'task_update',
      label: 'Update task',
      description: 'Patch a task. Only set fields are sent.',
      fields: [
        { id: 'id', label: 'Task ID', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'dueString', label: 'Due (natural language)', type: 'text' },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'Urgent (4)', value: '4' },
            { label: 'High (3)', value: '3' },
            { label: 'Medium (2)', value: '2' },
            { label: 'Normal (1)', value: '1' },
          ],
        },
        { id: 'labels', label: 'Labels (comma separated)', type: 'text' },
      ],
      run: taskUpdate,
    },
    {
      id: 'task_delete',
      label: 'Delete task',
      description: 'Permanently delete a task.',
      fields: [{ id: 'id', label: 'Task ID', type: 'text', required: true }],
      run: taskDelete,
    },
    {
      id: 'task_close',
      label: 'Complete task',
      description: 'Mark a task as complete.',
      fields: [{ id: 'id', label: 'Task ID', type: 'text', required: true }],
      run: taskClose,
    },
    {
      id: 'comment_create',
      label: 'Add comment',
      description: 'Post a comment on a task or project.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text' },
        { id: 'projectId', label: 'Project ID', type: 'text' },
        { id: 'content', label: 'Comment', type: 'textarea', required: true },
      ],
      run: commentCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
