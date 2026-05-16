/**
 * Forge block: Asana
 *
 * Source: n8n-master/packages/nodes-base/nodes/Asana/Asana.node.ts (2484 LOC)
 * Credential type: 'asana' (CREDENTIAL_FIELD_SCHEMAS → { accessToken }).
 *
 * Operations covered (task + comment subset):
 *   - task.create        POST /tasks
 *   - task.get           GET  /tasks/{taskId}
 *   - task.update        PUT  /tasks/{taskId}
 *   - task.delete        DELETE /tasks/{taskId}
 *   - task.search        GET  /workspaces/{workspaceId}/tasks/search
 *   - comment.create     POST /tasks/{taskId}/stories
 *
 * Deferred:
 *   - project, section, tag, user, subtask resources
 *   - getAll pagination (use task.search instead for now)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const BASE = 'https://app.asana.com/api/1.0';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Asana', ctx.credential);
  const token = cred.accessToken ?? cred.apiKey;
  if (!token) throw new Error('Asana: credential is missing `accessToken`');
  return { Authorization: `Bearer ${token}` };
}

function pruneUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v;
  }
  return out;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workspace = asString(ctx.options.workspace);
  const name = asString(ctx.options.name);
  if (!workspace) throw new Error('Asana: workspace is required');
  if (!name) throw new Error('Asana: name is required');

  const data: Record<string, unknown> = pruneUndefined({
    workspace,
    name,
    notes: asString(ctx.options.notes) || undefined,
    assignee: asString(ctx.options.assignee) || undefined,
    due_on: asString(ctx.options.dueOn) || undefined,
    completed: ctx.options.completed === true || ctx.options.completed === 'true' ? true : undefined,
  });
  const projects = asString(ctx.options.projects);
  if (projects) data.projects = projects.split(',').map((p) => p.trim()).filter(Boolean);

  const res = await apiRequest({
    service: 'Asana',
    method: 'POST',
    url: `${BASE}/tasks`,
    headers: authHeaders(ctx),
    json: { data },
  });
  const body = res.data as { data: { gid: string; name: string } };
  return { outputs: { task: body.data }, logs: [`Asana task create → ${body.data?.gid}`] };
}

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error('Asana: taskId is required');
  const res = await apiRequest({
    service: 'Asana',
    method: 'GET',
    url: `${BASE}/tasks/${encodeURIComponent(taskId)}`,
    headers: authHeaders(ctx),
  });
  const body = res.data as { data: unknown };
  return { outputs: { task: body.data }, logs: [`Asana task get → ${taskId}`] };
}

async function taskUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error('Asana: taskId is required');

  const data: Record<string, unknown> = pruneUndefined({
    name: asString(ctx.options.name) || undefined,
    notes: asString(ctx.options.notes) || undefined,
    assignee: asString(ctx.options.assignee) || undefined,
    due_on: asString(ctx.options.dueOn) || undefined,
    completed:
      ctx.options.completed === true || ctx.options.completed === 'true'
        ? true
        : ctx.options.completed === false || ctx.options.completed === 'false'
          ? false
          : undefined,
  });
  if (Object.keys(data).length === 0) {
    throw new Error('Asana: at least one updatable field must be set');
  }

  const res = await apiRequest({
    service: 'Asana',
    method: 'PUT',
    url: `${BASE}/tasks/${encodeURIComponent(taskId)}`,
    headers: authHeaders(ctx),
    json: { data },
  });
  const body = res.data as { data: unknown };
  return { outputs: { task: body.data }, logs: [`Asana task update → ${taskId}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  if (!taskId) throw new Error('Asana: taskId is required');
  await apiRequest({
    service: 'Asana',
    method: 'DELETE',
    url: `${BASE}/tasks/${encodeURIComponent(taskId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`Asana task delete → ${taskId}`] };
}

async function taskSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workspace = asString(ctx.options.workspace);
  const text = asString(ctx.options.text);
  if (!workspace) throw new Error('Asana: workspace is required');
  const params = new URLSearchParams();
  if (text) params.set('text', text);
  const url = `${BASE}/workspaces/${encodeURIComponent(workspace)}/tasks/search${params.toString() ? `?${params}` : ''}`;
  const res = await apiRequest({
    service: 'Asana',
    method: 'GET',
    url,
    headers: authHeaders(ctx),
  });
  const body = res.data as { data: unknown[] };
  return { outputs: { tasks: body.data ?? [] }, logs: [`Asana task search → ${(body.data ?? []).length} hits`] };
}

async function taskListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const project = asString(ctx.options.project);
  if (!project) throw new Error('Asana: project is required');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';

  const tasks = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const qs = new URLSearchParams();
      qs.set('project', project);
      qs.set('limit', pageSize);
      if (cursor) qs.set('offset', cursor);
      const res = await apiRequest({
        service: 'Asana',
        method: 'GET',
        url: `${BASE}/tasks?${qs.toString()}`,
        headers: authHeaders(ctx),
      });
      const body = res.data as {
        data?: unknown[];
        next_page?: { offset?: string } | null;
      };
      const items = body.data ?? [];
      const nextCursor = body.next_page?.offset ?? undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { tasks, count: tasks.length },
    logs: [`Asana task list all → ${tasks.length}`],
  };
}

async function commentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const taskId = asString(ctx.options.taskId);
  const text = asString(ctx.options.text);
  if (!taskId) throw new Error('Asana: taskId is required');
  if (!text) throw new Error('Asana: text is required');
  const res = await apiRequest({
    service: 'Asana',
    method: 'POST',
    url: `${BASE}/tasks/${encodeURIComponent(taskId)}/stories`,
    headers: authHeaders(ctx),
    json: { data: { text } },
  });
  const body = res.data as { data: unknown };
  return { outputs: { comment: body.data }, logs: [`Asana comment → ${taskId}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_asana',
  name: 'Asana',
  description: 'Create, update and comment on Asana tasks from a flow.',
  iconName: 'LuClipboardList',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'asana' },
  actions: [
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a new task in a workspace.',
      fields: [
        { id: 'workspace', label: 'Workspace ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'notes', label: 'Notes', type: 'textarea' },
        { id: 'assignee', label: 'Assignee (gid or "me")', type: 'text' },
        { id: 'projects', label: 'Project IDs (comma separated)', type: 'text' },
        { id: 'dueOn', label: 'Due on (YYYY-MM-DD)', type: 'text' },
        { id: 'completed', label: 'Completed', type: 'toggle' },
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
      description: 'Patch an existing task. Only set fields are sent.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'notes', label: 'Notes', type: 'textarea' },
        { id: 'assignee', label: 'Assignee', type: 'text' },
        { id: 'dueOn', label: 'Due on (YYYY-MM-DD)', type: 'text' },
        {
          id: 'completed',
          label: 'Completed',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'True', value: 'true' },
            { label: 'False', value: 'false' },
          ],
        },
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
      id: 'task_search',
      label: 'Search tasks',
      description: 'Search tasks in a workspace by text.',
      fields: [
        { id: 'workspace', label: 'Workspace ID', type: 'text', required: true },
        { id: 'text', label: 'Search text', type: 'text' },
      ],
      run: taskSearch,
    },
    {
      id: 'task_list_all',
      label: 'List all tasks in project (paginated)',
      description: 'Walk Asana\'s `next_page.offset` cursor and return every task in a project up to the cap.',
      fields: [
        { id: 'project', label: 'Project ID', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
      ],
      run: taskListAll,
    },
    {
      id: 'comment_create',
      label: 'Add comment to task',
      description: 'Post a comment (story) on a task.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'text', label: 'Comment', type: 'textarea', required: true },
      ],
      run: commentCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
