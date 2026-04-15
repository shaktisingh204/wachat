
'use server';

export async function executeGoogleTasksAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const base = 'https://tasks.googleapis.com/tasks/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function req(method: string, path: string, body?: any): Promise<any> {
            const res = await fetch(`${base}${path}`, {
                method,
                headers,
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            if (method === 'DELETE' && res.status === 204) return {};
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message ?? JSON.stringify(data));
            return data;
        }

        switch (actionName) {
            case 'listTaskLists': {
                const data = await req('GET', '/users/@me/lists');
                logger.log(`[GoogleTasks] Listed ${data.items?.length ?? 0} task lists`);
                return { output: { taskLists: data.items ?? [], count: String(data.items?.length ?? 0) } };
            }

            case 'getTaskList': {
                const taskList = String(inputs.taskList ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                const data = await req('GET', `/users/@me/lists/${encodeURIComponent(taskList)}`);
                return { output: data };
            }

            case 'createTaskList': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const data = await req('POST', '/users/@me/lists', { title });
                logger.log(`[GoogleTasks] Created task list: ${data.id}`);
                return { output: data };
            }

            case 'updateTaskList': {
                const taskList = String(inputs.taskList ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                const body: any = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                const data = await req('PATCH', `/users/@me/lists/${encodeURIComponent(taskList)}`, body);
                return { output: data };
            }

            case 'deleteTaskList': {
                const taskList = String(inputs.taskList ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                await req('DELETE', `/users/@me/lists/${encodeURIComponent(taskList)}`);
                logger.log(`[GoogleTasks] Deleted task list: ${taskList}`);
                return { output: { taskList, status: 'deleted' } };
            }

            case 'listTasks': {
                const taskList = String(inputs.taskList ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                const params = new URLSearchParams();
                if (inputs.showCompleted !== undefined) params.set('showCompleted', String(inputs.showCompleted));
                if (inputs.showHidden !== undefined) params.set('showHidden', String(inputs.showHidden));
                if (inputs.dueMin) params.set('dueMin', inputs.dueMin);
                if (inputs.dueMax) params.set('dueMax', inputs.dueMax);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/lists/${encodeURIComponent(taskList)}/tasks${query}`);
                return { output: { tasks: data.items ?? [], count: String(data.items?.length ?? 0) } };
            }

            case 'getTask': {
                const taskList = String(inputs.taskList ?? '').trim();
                const task = String(inputs.task ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                if (!task) throw new Error('task is required.');
                const data = await req('GET', `/lists/${encodeURIComponent(taskList)}/tasks/${encodeURIComponent(task)}`);
                return { output: data };
            }

            case 'createTask': {
                const taskList = String(inputs.taskList ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: any = { title };
                if (inputs.notes !== undefined) body.notes = inputs.notes;
                if (inputs.due !== undefined) body.due = inputs.due;
                if (inputs.status !== undefined) body.status = inputs.status;
                const data = await req('POST', `/lists/${encodeURIComponent(taskList)}/tasks`, body);
                logger.log(`[GoogleTasks] Created task: ${data.id}`);
                return { output: data };
            }

            case 'updateTask': {
                const taskList = String(inputs.taskList ?? '').trim();
                const task = String(inputs.task ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                if (!task) throw new Error('task is required.');
                const body: any = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.notes !== undefined) body.notes = inputs.notes;
                if (inputs.due !== undefined) body.due = inputs.due;
                if (inputs.status !== undefined) body.status = inputs.status;
                const data = await req('PATCH', `/lists/${encodeURIComponent(taskList)}/tasks/${encodeURIComponent(task)}`, body);
                return { output: data };
            }

            case 'deleteTask': {
                const taskList = String(inputs.taskList ?? '').trim();
                const task = String(inputs.task ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                if (!task) throw new Error('task is required.');
                await req('DELETE', `/lists/${encodeURIComponent(taskList)}/tasks/${encodeURIComponent(task)}`);
                logger.log(`[GoogleTasks] Deleted task: ${task}`);
                return { output: { task, status: 'deleted' } };
            }

            case 'completeTask': {
                const taskList = String(inputs.taskList ?? '').trim();
                const task = String(inputs.task ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                if (!task) throw new Error('task is required.');
                const data = await req('PATCH', `/lists/${encodeURIComponent(taskList)}/tasks/${encodeURIComponent(task)}`, { status: 'completed' });
                logger.log(`[GoogleTasks] Completed task: ${task}`);
                return { output: data };
            }

            case 'clearCompletedTasks': {
                const taskList = String(inputs.taskList ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                await req('POST', `/lists/${encodeURIComponent(taskList)}/clear`);
                logger.log(`[GoogleTasks] Cleared completed tasks from list: ${taskList}`);
                return { output: { taskList, status: 'cleared' } };
            }

            case 'moveTask': {
                const taskList = String(inputs.taskList ?? '').trim();
                const task = String(inputs.task ?? '').trim();
                if (!taskList) throw new Error('taskList is required.');
                if (!task) throw new Error('task is required.');
                const params = new URLSearchParams();
                if (inputs.parent) params.set('parent', inputs.parent);
                if (inputs.previous) params.set('previous', inputs.previous);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await req('POST', `/lists/${encodeURIComponent(taskList)}/tasks/${encodeURIComponent(task)}/move${query}`);
                logger.log(`[GoogleTasks] Moved task: ${task}`);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Google Tasks action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
