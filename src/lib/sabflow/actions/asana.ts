
'use server';

const ASANA_BASE = 'https://app.asana.com/api/1.0';

async function asanaFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Asana] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify({ data: body });
    const res = await fetch(`${ASANA_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || `Asana API error: ${res.status}`);
    }
    return data.data ?? data;
}

export async function executeAsanaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');
        const asana = (method: string, path: string, body?: any) => asanaFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'createTask': {
                const name = String(inputs.name ?? '').trim();
                const projectId = String(inputs.projectId ?? '').trim();
                const notes = String(inputs.notes ?? '').trim();
                const assignee = String(inputs.assignee ?? '').trim();
                const dueOn = String(inputs.dueOn ?? '').trim();
                if (!name || !projectId) throw new Error('name and projectId are required.');
                const body: any = { name, projects: [projectId] };
                if (notes) body.notes = notes;
                if (assignee) body.assignee = assignee;
                if (dueOn) body.due_on = dueOn;
                const data = await asana('POST', '/tasks', body);
                return { output: { id: data.gid, name: data.name, url: `https://app.asana.com/0/${projectId}/${data.gid}` } };
            }

            case 'getTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const data = await asana('GET', `/tasks/${taskId}`);
                return { output: { id: data.gid, name: data.name, notes: data.notes ?? '', completed: String(data.completed), assignee: data.assignee?.name ?? '', dueOn: data.due_on ?? '' } };
            }

            case 'updateTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.notes !== undefined) body.notes = String(inputs.notes);
                if (inputs.completed !== undefined) body.completed = inputs.completed === true || inputs.completed === 'true';
                if (inputs.dueOn) body.due_on = String(inputs.dueOn);
                const data = await asana('PUT', `/tasks/${taskId}`, body);
                return { output: { id: data.gid, name: data.name, completed: String(data.completed) } };
            }

            case 'completeTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const data = await asana('PUT', `/tasks/${taskId}`, { completed: true });
                return { output: { id: data.gid, completed: 'true' } };
            }

            case 'deleteTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                await asana('DELETE', `/tasks/${taskId}`);
                return { output: { deleted: 'true' } };
            }

            case 'addTaskComment': {
                const taskId = String(inputs.taskId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!taskId || !text) throw new Error('taskId and text are required.');
                const data = await asana('POST', `/tasks/${taskId}/stories`, { text });
                return { output: { id: data.gid, text: data.text } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await asana('GET', `/projects/${projectId}`);
                return { output: { id: data.gid, name: data.name, notes: data.notes ?? '' } };
            }

            case 'listProjectTasks': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await asana('GET', `/projects/${projectId}/tasks?opt_fields=gid,name,completed,assignee,due_on`);
                return { output: { tasks: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'createProject': {
                const name = String(inputs.name ?? '').trim();
                const workspaceId = String(inputs.workspaceId ?? '').trim();
                if (!name || !workspaceId) throw new Error('name and workspaceId are required.');
                const data = await asana('POST', '/projects', { name, workspace: workspaceId });
                return { output: { id: data.gid, name: data.name } };
            }

            case 'searchTasks': {
                const workspaceId = String(inputs.workspaceId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!workspaceId) throw new Error('workspaceId is required.');
                const query = text ? `?text=${encodeURIComponent(text)}` : '';
                const data = await asana('GET', `/workspaces/${workspaceId}/tasks/search${query}`);
                return { output: { tasks: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            default:
                return { error: `Asana action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Asana action failed.' };
    }
}
