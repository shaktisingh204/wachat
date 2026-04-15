'use server';

async function teamworkFetch(domain: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Teamwork] ${method} ${path}`);
    const base64Auth = Buffer.from(`${apiKey}:x`).toString('base64');
    const url = `https://${domain}.teamwork.com${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.MESSAGE || data?.message || `Teamwork API error: ${res.status}`);
    }
    return data;
}

export async function executeTeamworkAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const domain = String(inputs.domain ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!domain || !apiKey) throw new Error('domain and apiKey are required.');

        const tw = (method: string, path: string, body?: any) => teamworkFetch(domain, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listProjects': {
                const data = await tw('GET', '/projects.json');
                return { output: { projects: data.projects ?? [], count: (data.projects ?? []).length } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await tw('GET', `/projects/${projectId}.json`);
                return { output: { project: data.project ?? {} } };
            }

            case 'createProject': {
                const name = String(inputs.name ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { project: { name } };
                if (description) body.project.description = description;
                const data = await tw('POST', '/projects.json', body);
                return { output: { id: String(data.id ?? ''), name } };
            }

            case 'listTasklists': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await tw('GET', `/projects/${projectId}/tasklists.json`);
                return { output: { tasklists: data.tasklists ?? [], count: (data.tasklists ?? []).length } };
            }

            case 'createTasklist': {
                const projectId = String(inputs.projectId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!projectId || !name) throw new Error('projectId and name are required.');
                const data = await tw('POST', `/projects/${projectId}/tasklists.json`, { 'todo-list': { name } });
                return { output: { id: String(data.TASKLISTID ?? ''), name } };
            }

            case 'listTasks': {
                const tasklistId = String(inputs.tasklistId ?? '').trim();
                const path = tasklistId ? `/tasklists/${tasklistId}/tasks.json` : '/tasks.json';
                const data = await tw('GET', path);
                return { output: { tasks: data['todo-items'] ?? [], count: (data['todo-items'] ?? []).length } };
            }

            case 'getTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const data = await tw('GET', `/tasks/${taskId}.json`);
                return { output: { task: data['todo-item'] ?? {} } };
            }

            case 'createTask': {
                const tasklistId = String(inputs.tasklistId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!tasklistId || !content) throw new Error('tasklistId and content are required.');
                const body: any = { 'todo-item': { content } };
                if (inputs.description) body['todo-item'].description = String(inputs.description);
                if (inputs.due_date) body['todo-item']['due-date'] = String(inputs.due_date);
                const data = await tw('POST', `/tasklists/${tasklistId}/tasks.json`, body);
                return { output: { id: String(data.id ?? ''), content } };
            }

            case 'updateTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const item: any = {};
                if (inputs.content) item.content = String(inputs.content);
                if (inputs.description) item.description = String(inputs.description);
                if (inputs.due_date) item['due-date'] = String(inputs.due_date);
                await tw('PUT', `/tasks/${taskId}.json`, { 'todo-item': item });
                return { output: { updated: 'true', taskId } };
            }

            case 'completeTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                await tw('PUT', `/tasks/${taskId}/complete.json`);
                return { output: { completed: 'true', taskId } };
            }

            case 'uncompleteTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                await tw('PUT', `/tasks/${taskId}/uncomplete.json`);
                return { output: { uncompleted: 'true', taskId } };
            }

            case 'listMilestones': {
                const projectId = String(inputs.projectId ?? '').trim();
                const path = projectId ? `/projects/${projectId}/milestones.json` : '/milestones.json';
                const data = await tw('GET', path);
                return { output: { milestones: data.milestones ?? [], count: (data.milestones ?? []).length } };
            }

            case 'createMilestone': {
                const projectId = String(inputs.projectId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const deadline = String(inputs.deadline ?? '').trim();
                if (!projectId || !title || !deadline) throw new Error('projectId, title, and deadline are required.');
                const data = await tw('POST', `/projects/${projectId}/milestones.json`, {
                    milestone: { title, deadline },
                });
                return { output: { id: String(data.id ?? ''), title } };
            }

            case 'listMessages': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await tw('GET', `/projects/${projectId}/posts.json`);
                return { output: { messages: data.posts ?? [], count: (data.posts ?? []).length } };
            }

            case 'createMessage': {
                const projectId = String(inputs.projectId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const body_text = String(inputs.body ?? '').trim();
                if (!projectId || !title) throw new Error('projectId and title are required.');
                const data = await tw('POST', `/projects/${projectId}/posts.json`, {
                    post: { title, body: body_text },
                });
                return { output: { id: String(data.id ?? ''), title } };
            }

            case 'listTimeEntries': {
                const projectId = String(inputs.projectId ?? '').trim();
                const path = projectId ? `/projects/${projectId}/time_entries.json` : '/time_entries.json';
                const data = await tw('GET', path);
                return { output: { timeEntries: data['time-entries'] ?? [], count: (data['time-entries'] ?? []).length } };
            }

            case 'createTimeEntry': {
                const taskId = String(inputs.taskId ?? '').trim();
                const projectId = String(inputs.projectId ?? '').trim();
                const hours = String(inputs.hours ?? '').trim();
                const date = String(inputs.date ?? '').trim();
                if ((!taskId && !projectId) || !hours || !date) throw new Error('taskId or projectId, hours, and date are required.');
                const path = taskId ? `/tasks/${taskId}/time_entries.json` : `/projects/${projectId}/time_entries.json`;
                const data = await tw('POST', path, {
                    'time-entry': { hours, date, description: String(inputs.description ?? '') },
                });
                return { output: { id: String(data.id ?? ''), hours, date } };
            }

            case 'listPeople': {
                const data = await tw('GET', '/people.json');
                return { output: { people: data.people ?? [], count: (data.people ?? []).length } };
            }

            default:
                return { error: `Teamwork action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Teamwork action failed.' };
    }
}
