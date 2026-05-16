/**
 * Forge block: ClickUp
 *
 * Source: n8n-master/packages/nodes-base/nodes/ClickUp/ClickUp.node.ts (1632 LOC)
 * Credential type: 'clickup' (CREDENTIAL_FIELD_SCHEMAS → { apiToken }).
 *
 * Operations covered (task + comment subset):
 *   - task.create   POST   /api/v2/list/{listId}/task
 *   - task.get      GET    /api/v2/task/{taskId}
 *   - task.update   PUT    /api/v2/task/{taskId}
 *   - task.delete   DELETE /api/v2/task/{taskId}
 *   - comment.create POST  /api/v2/task/{taskId}/comment
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.clickup.com/api/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('ClickUp', ctx.credential);
  const token = cred.apiToken ?? cred.accessToken;
  if (!token) throw new Error('ClickUp: credential is missing `apiToken`');
  return { Authorization: token };
}

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const name = asString(ctx.options.name);
  if (!listId) throw new Error('ClickUp: listId is required');
  if (!name) throw new Error('ClickUp: name is required');

  const body: Record<string, unknown> = { name };
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const status = asString(ctx.options.status);
  if (status) body.status = status;
  const priority = asString(ctx.options.priority);
  if (priority) body.priority = Number(priority);
  const dueDate = asString(ctx.options.dueDate);
  if (dueDate) body.due_date = Number(dueDate);
  const assignees = asString(ctx.options.assignees);
  if (assignees) {
    body.assignees = assignees
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s));
  }

  const res = await apiRequest({
    service: 'ClickUp',
    method: 'POST',
    url: `${BASE}/list/${encodeURIComponent(listId)}/task`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { task: res.data }, logs: [`ClickUp task create → ${(res.data as { id?: string })?.id ?? '?'}`] };
}

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error('ClickUp: taskId is required');
  const res = await apiRequest({
    service: 'ClickUp',
    method: 'GET',
    url: `${BASE}/task/${encodeURIComponent(taskId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { task: res.data }, logs: [`ClickUp task get → ${taskId}`] };
}

async function taskUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error('ClickUp: taskId is required');
  const body: Record<string, unknown> = {};
  const name = asString(ctx.options.name);
  if (name) body.name = name;
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const status = asString(ctx.options.status);
  if (status) body.status = status;
  const priority = asString(ctx.options.priority);
  if (priority) body.priority = Number(priority);
  const dueDate = asString(ctx.options.dueDate);
  if (dueDate) body.due_date = Number(dueDate);

  if (Object.keys(body).length === 0) {
    throw new Error('ClickUp: at least one updatable field must be set');
  }
  const res = await apiRequest({
    service: 'ClickUp',
    method: 'PUT',
    url: `${BASE}/task/${encodeURIComponent(taskId)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { task: res.data }, logs: [`ClickUp task update → ${taskId}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error('ClickUp: taskId is required');
  await apiRequest({
    service: 'ClickUp',
    method: 'DELETE',
    url: `${BASE}/task/${encodeURIComponent(taskId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`ClickUp task delete → ${taskId}`] };
}

async function commentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  const commentText = asString(ctx.options.commentText);
  if (!taskId) throw new Error('ClickUp: taskId is required');
  if (!commentText) throw new Error('ClickUp: commentText is required');

  const body: Record<string, unknown> = { comment_text: commentText };
  const assignee = asString(ctx.options.assignee);
  if (assignee) body.assignee = Number(assignee);
  const notifyAll = ctx.options.notifyAll;
  body.notify_all = notifyAll === true || notifyAll === 'true';

  const res = await apiRequest({
    service: 'ClickUp',
    method: 'POST',
    url: `${BASE}/task/${encodeURIComponent(taskId)}/comment`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { comment: res.data }, logs: [`ClickUp comment → ${taskId}`] };
}

const block: ForgeBlock = {
  id: 'forge_clickup',
  name: 'ClickUp',
  description: 'Create, update and comment on ClickUp tasks from a flow.',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'clickup' },
  actions: [
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a new task in a list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'text' },
        {
          id: 'priority',
          label: 'Priority (1=Urgent..4=Low)',
          type: 'select',
          options: [
            { label: '(none)', value: '' },
            { label: 'Urgent', value: '1' },
            { label: 'High', value: '2' },
            { label: 'Normal', value: '3' },
            { label: 'Low', value: '4' },
          ],
        },
        { id: 'dueDate', label: 'Due date (epoch ms)', type: 'text' },
        { id: 'assignees', label: 'Assignee user IDs (comma separated)', type: 'text' },
      ],
      run: taskCreate,
    },
    {
      id: 'task_get',
      label: 'Get task',
      description: 'Fetch a single task by id.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }],
      run: taskGet,
    },
    {
      id: 'task_update',
      label: 'Update task',
      description: 'Patch a task. Only set fields are sent.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'text' },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'Urgent', value: '1' },
            { label: 'High', value: '2' },
            { label: 'Normal', value: '3' },
            { label: 'Low', value: '4' },
          ],
        },
        { id: 'dueDate', label: 'Due date (epoch ms)', type: 'text' },
      ],
      run: taskUpdate,
    },
    {
      id: 'task_delete',
      label: 'Delete task',
      description: 'Permanently delete a task.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }],
      run: taskDelete,
    },
    {
      id: 'comment_create',
      label: 'Add comment to task',
      description: 'Post a comment on a task.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'commentText', label: 'Comment', type: 'textarea', required: true },
        { id: 'assignee', label: 'Assignee user ID', type: 'text' },
        { id: 'notifyAll', label: 'Notify all', type: 'toggle' },
      ],
      run: commentCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
