'use server';

export async function executeHeightAction(actionName: string, inputs: any, user: any, logger: any) {
    const base = 'https://api.height.app';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `api-key ${inputs.apiKey}`,
    };

    try {
        switch (actionName) {
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.listId) params.set('filters', JSON.stringify({ list: { values: [{ id: inputs.listId }] } }));
                const res = await fetch(`${base}/tasks?${params}`, { headers });
                const data = await res.json();
                return { output: { tasks: data.list ?? [], total: data.total } };
            }
            case 'getTask': {
                const res = await fetch(`${base}/tasks/${inputs.taskId}`, { headers });
                const data = await res.json();
                return { output: { task: data } };
            }
            case 'createTask': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.listIds) body.listIds = inputs.listIds;
                if (inputs.assigneesIds) body.assigneesIds = inputs.assigneesIds;
                if (inputs.status) body.status = inputs.status;
                const res = await fetch(`${base}/tasks`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { task: data } };
            }
            case 'updateTask': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.status) body.status = inputs.status;
                if (inputs.assigneesIds) body.assigneesIds = inputs.assigneesIds;
                const res = await fetch(`${base}/tasks/${inputs.taskId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { task: data } };
            }
            case 'deleteTasks': {
                const body = { ids: Array.isArray(inputs.taskIds) ? inputs.taskIds : [inputs.taskId] };
                const res = await fetch(`${base}/tasks`, { method: 'DELETE', headers, body: JSON.stringify(body) });
                const ok = res.ok;
                return { output: { success: ok, status: res.status } };
            }
            case 'listLists': {
                const res = await fetch(`${base}/lists`, { headers });
                const data = await res.json();
                return { output: { lists: data.list ?? [] } };
            }
            case 'getList': {
                const res = await fetch(`${base}/lists/${inputs.listId}`, { headers });
                const data = await res.json();
                return { output: { list: data } };
            }
            case 'createList': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.color) body.color = inputs.color;
                const res = await fetch(`${base}/lists`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { list: data } };
            }
            case 'updateList': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.color) body.color = inputs.color;
                const res = await fetch(`${base}/lists/${inputs.listId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { list: data } };
            }
            case 'deleteList': {
                const res = await fetch(`${base}/lists/${inputs.listId}`, { method: 'DELETE', headers });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'listUsers': {
                const res = await fetch(`${base}/users`, { headers });
                const data = await res.json();
                return { output: { users: data.list ?? [] } };
            }
            case 'listWorkspaces': {
                const res = await fetch(`${base}/workspaces`, { headers });
                const data = await res.json();
                return { output: { workspaces: data.list ?? [] } };
            }
            case 'getWorkspace': {
                const res = await fetch(`${base}/workspaces/${inputs.workspaceId}`, { headers });
                const data = await res.json();
                return { output: { workspace: data } };
            }
            case 'searchTasks': {
                const params = new URLSearchParams({ query: inputs.query });
                const res = await fetch(`${base}/tasks?${params}`, { headers });
                const data = await res.json();
                return { output: { tasks: data.list ?? [], total: data.total } };
            }
            case 'listActivities': {
                const params = new URLSearchParams();
                if (inputs.taskId) params.set('taskId', inputs.taskId);
                const res = await fetch(`${base}/activities?${params}`, { headers });
                const data = await res.json();
                return { output: { activities: data.list ?? [] } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Height action error: ${err.message}`);
        return { error: err.message };
    }
}
