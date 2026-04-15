'use server';

export async function executeTodoistAction(
  action: string,
  inputs: Record<string, any>
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { token, ...params } = inputs;

  if (!token) return { error: 'token is required' };

  const base = 'https://api.todoist.com/rest/v2';

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>,
    query?: Record<string, string>
  ) {
    let fullUrl = `${base}${path}`;
    if (query) fullUrl += `?${new URLSearchParams(query).toString()}`;
    const res = await fetch(fullUrl, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { success: true };
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Todoist ${method} ${path} failed (${res.status}): ${text}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : { success: true };
  }

  try {
    switch (action) {
      case 'getProjects': {
        const data = await req('GET', '/projects');
        return { output: { projects: data } };
      }

      case 'getProject': {
        const { projectId } = params;
        if (!projectId) return { error: 'projectId is required' };
        const data = await req('GET', `/projects/${projectId}`);
        return { output: data };
      }

      case 'createProject': {
        const { name, parentId, color } = params;
        if (!name) return { error: 'name is required' };
        const body: Record<string, any> = { name };
        if (parentId) body.parent_id = parentId;
        if (color) body.color = color;
        const data = await req('POST', '/projects', body);
        return { output: data };
      }

      case 'updateProject': {
        const { projectId, name, color } = params;
        if (!projectId) return { error: 'projectId is required' };
        const body: Record<string, any> = {};
        if (name) body.name = name;
        if (color) body.color = color;
        const data = await req('POST', `/projects/${projectId}`, body);
        return { output: data };
      }

      case 'deleteProject': {
        const { projectId } = params;
        if (!projectId) return { error: 'projectId is required' };
        const data = await req('DELETE', `/projects/${projectId}`);
        return { output: data };
      }

      case 'getTasks': {
        const { projectId, filter, limit } = params;
        const query: Record<string, string> = {};
        if (projectId) query.project_id = String(projectId);
        if (filter) query.filter = filter;
        if (limit) query.limit = String(limit);
        const data = await req('GET', '/tasks', undefined, Object.keys(query).length ? query : undefined);
        return { output: { tasks: data } };
      }

      case 'getTask': {
        const { taskId } = params;
        if (!taskId) return { error: 'taskId is required' };
        const data = await req('GET', `/tasks/${taskId}`);
        return { output: data };
      }

      case 'createTask': {
        const { content, description, projectId, due_string, priority = 1, labels } = params;
        if (!content) return { error: 'content is required' };
        const body: Record<string, any> = { content, priority };
        if (description) body.description = description;
        if (projectId) body.project_id = projectId;
        if (due_string) body.due_string = due_string;
        if (labels) body.labels = Array.isArray(labels) ? labels : [labels];
        const data = await req('POST', '/tasks', body);
        return { output: data };
      }

      case 'updateTask': {
        const { taskId, content, description, due_string, priority } = params;
        if (!taskId) return { error: 'taskId is required' };
        const body: Record<string, any> = {};
        if (content) body.content = content;
        if (description) body.description = description;
        if (due_string) body.due_string = due_string;
        if (priority !== undefined) body.priority = priority;
        const data = await req('POST', `/tasks/${taskId}`, body);
        return { output: data };
      }

      case 'completeTask': {
        const { taskId } = params;
        if (!taskId) return { error: 'taskId is required' };
        const data = await req('POST', `/tasks/${taskId}/close`);
        return { output: data };
      }

      case 'reopenTask': {
        const { taskId } = params;
        if (!taskId) return { error: 'taskId is required' };
        const data = await req('POST', `/tasks/${taskId}/reopen`);
        return { output: data };
      }

      case 'deleteTask': {
        const { taskId } = params;
        if (!taskId) return { error: 'taskId is required' };
        const data = await req('DELETE', `/tasks/${taskId}`);
        return { output: data };
      }

      case 'getComments': {
        const { taskId } = params;
        if (!taskId) return { error: 'taskId is required' };
        const data = await req('GET', '/comments', undefined, { task_id: String(taskId) });
        return { output: { comments: data } };
      }

      case 'createComment': {
        const { taskId, content } = params;
        if (!taskId || !content) return { error: 'taskId and content are required' };
        const data = await req('POST', '/comments', { task_id: taskId, content });
        return { output: data };
      }

      case 'getLabels': {
        const data = await req('GET', '/labels');
        return { output: { labels: data } };
      }

      case 'createLabel': {
        const { name, color } = params;
        if (!name) return { error: 'name is required' };
        const body: Record<string, any> = { name };
        if (color) body.color = color;
        const data = await req('POST', '/labels', body);
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (err: any) {
    return { error: err.message ?? String(err) };
  }
}
