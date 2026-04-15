'use server';

const BASE = 'https://tasks.googleapis.com/tasks/v1';

async function req(accessToken: string, method: string, url: string, body?: any, logger?: any) {
    logger?.log(`[GoogleTasks] ${method} ${url}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Tasks API error ${res.status}`);
    return data;
}

export async function executeGoogleTasksAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const g = (method: string, path: string, body?: any) => req(accessToken, method, `${BASE}${path}`, body, logger);

        switch (actionName) {
            case 'listTaskLists': {
                const maxResults = Number(inputs.maxResults ?? 20);
                const pageToken = String(inputs.pageToken ?? '').trim();
                let path = `/users/@me/lists?maxResults=${maxResults}`;
                if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
                const data = await g('GET', path);
                return { output: { taskLists: data.items ?? [], count: (data.items ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getTaskList': {
                const taskListId = String(inputs.taskListId ?? '').trim();
                if (!taskListId) throw new Error('taskListId is required.');
                const data = await g('GET', `/users/@me/lists/${taskListId}`);
                return { output: { id: data.id, title: data.title ?? '', updated: data.updated ?? '', selfLink: data.selfLink ?? '' } };
            }

            case 'createTaskList': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const data = await g('POST', '/users/@me/lists', { title });
                return { output: { id: data.id, title: data.title ?? title, selfLink: data.selfLink ?? '' } };
            }

            case 'updateTaskList': {
                const taskListId = String(inputs.taskListId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!taskListId || !title) throw new Error('taskListId and title are required.');
                const data = await g('PUT', `/users/@me/lists/${taskListId}`, { id: taskListId, title });
                return { output: { id: data.id, title: data.title ?? title, updated: data.updated ?? '' } };
            }

            case 'deleteTaskList': {
                const taskListId = String(inputs.taskListId ?? '').trim();
                if (!taskListId) throw new Error('taskListId is required.');
                await g('DELETE', `/users/@me/lists/${taskListId}`);
                return { output: { deleted: true, taskListId } };
            }

            case 'listTasks': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const maxResults = Number(inputs.maxResults ?? 20);
                const showCompleted = inputs.showCompleted !== false;
                const showHidden = inputs.showHidden === true;
                const pageToken = String(inputs.pageToken ?? '').trim();
                let path = `/lists/${taskListId}/tasks?maxResults=${maxResults}&showCompleted=${showCompleted}&showHidden=${showHidden}`;
                if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
                if (inputs.dueMin) path += `&dueMin=${encodeURIComponent(String(inputs.dueMin))}`;
                if (inputs.dueMax) path += `&dueMax=${encodeURIComponent(String(inputs.dueMax))}`;
                const data = await g('GET', path);
                return { output: { tasks: data.items ?? [], count: (data.items ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getTask': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const data = await g('GET', `/lists/${taskListId}/tasks/${taskId}`);
                return { output: { id: data.id, title: data.title ?? '', notes: data.notes ?? '', status: data.status ?? '', due: data.due ?? '', completed: data.completed ?? '', parent: data.parent ?? '' } };
            }

            case 'createTask': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: any = { title, status: 'needsAction' };
                if (inputs.notes) body.notes = String(inputs.notes);
                if (inputs.due) body.due = String(inputs.due);
                if (inputs.parent) body.parent = String(inputs.parent);
                let path = `/lists/${taskListId}/tasks`;
                if (inputs.parent) path += `?parent=${encodeURIComponent(String(inputs.parent))}`;
                const data = await g('POST', path, body);
                return { output: { id: data.id, title: data.title ?? title, status: data.status ?? 'needsAction', due: data.due ?? '', selfLink: data.selfLink ?? '' } };
            }

            case 'updateTask': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const body: any = { id: taskId };
                if (inputs.title) body.title = String(inputs.title).trim();
                if (inputs.notes !== undefined) body.notes = String(inputs.notes);
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.due) body.due = String(inputs.due);
                if (inputs.completed) body.completed = String(inputs.completed);
                const data = await g('PUT', `/lists/${taskListId}/tasks/${taskId}`, body);
                return { output: { id: data.id, title: data.title ?? '', status: data.status ?? '', due: data.due ?? '', updated: data.updated ?? '' } };
            }

            case 'deleteTask': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                await g('DELETE', `/lists/${taskListId}/tasks/${taskId}`);
                return { output: { deleted: true, taskListId, taskId } };
            }

            case 'clearCompletedTasks': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                await g('POST', `/lists/${taskListId}/clear`, {});
                return { output: { cleared: true, taskListId } };
            }

            case 'moveTask': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                let path = `/lists/${taskListId}/tasks/${taskId}/move`;
                const qs: string[] = [];
                if (inputs.parent) qs.push(`parent=${encodeURIComponent(String(inputs.parent))}`);
                if (inputs.previous) qs.push(`previous=${encodeURIComponent(String(inputs.previous))}`);
                if (qs.length) path += `?${qs.join('&')}`;
                const data = await g('POST', path, {});
                return { output: { id: data.id, title: data.title ?? '', position: data.position ?? '', parent: data.parent ?? '' } };
            }

            case 'patchTask': {
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const body: any = {};
                if (inputs.title) body.title = String(inputs.title).trim();
                if (inputs.notes !== undefined) body.notes = String(inputs.notes);
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.due) body.due = String(inputs.due);
                const data = await g('PATCH', `/lists/${taskListId}/tasks/${taskId}`, body);
                return { output: { id: data.id, title: data.title ?? '', status: data.status ?? '', due: data.due ?? '' } };
            }

            case 'listAllTasks': {
                // Fetch all task lists first, then aggregate tasks from each
                const listsData = await g('GET', '/users/@me/lists?maxResults=100');
                const lists: any[] = listsData.items ?? [];
                const allTasks: any[] = [];
                for (const list of lists) {
                    try {
                        const tasksData = await g('GET', `/lists/${list.id}/tasks?maxResults=100&showCompleted=true&showHidden=true`);
                        const tasks = (tasksData.items ?? []).map((t: any) => ({ ...t, taskListId: list.id, taskListTitle: list.title }));
                        allTasks.push(...tasks);
                    } catch {
                        // skip lists with errors
                    }
                }
                return { output: { tasks: allTasks, count: allTasks.length, taskListCount: lists.length } };
            }

            case 'createRecurringTask': {
                // Google Tasks API does not natively support recurrence; we create a task with recurrence info in notes
                const taskListId = String(inputs.taskListId ?? '@default').trim();
                const title = String(inputs.title ?? '').trim();
                const recurrence = String(inputs.recurrence ?? 'DAILY').trim();
                if (!title) throw new Error('title is required.');
                const notes = `[Recurring: ${recurrence}]${inputs.notes ? ' ' + String(inputs.notes) : ''}`;
                const body: any = { title, notes, status: 'needsAction' };
                if (inputs.due) body.due = String(inputs.due);
                const data = await g('POST', `/lists/${taskListId}/tasks`, body);
                return { output: { id: data.id, title: data.title ?? title, notes: data.notes ?? notes, status: data.status ?? 'needsAction', recurrence, due: data.due ?? '' } };
            }

            default:
                return { error: `Google Tasks action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Google Tasks action failed.' };
    }
}
