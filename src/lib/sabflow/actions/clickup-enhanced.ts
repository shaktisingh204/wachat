'use server';

export async function executeClickupEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.clickup.com/api/v2';

    try {
        const headers: Record<string, string> = {
            'Authorization': inputs.apiKey,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listSpaces': {
                url = `${BASE}/team/${inputs.teamId}/space?archived=${inputs.archived ?? false}`;
                break;
            }
            case 'getSpace': {
                url = `${BASE}/space/${inputs.spaceId}`;
                break;
            }
            case 'listFolders': {
                url = `${BASE}/space/${inputs.spaceId}/folder?archived=${inputs.archived ?? false}`;
                break;
            }
            case 'getFolder': {
                url = `${BASE}/folder/${inputs.folderId}`;
                break;
            }
            case 'listLists': {
                if (inputs.folderId) {
                    url = `${BASE}/folder/${inputs.folderId}/list?archived=${inputs.archived ?? false}`;
                } else {
                    url = `${BASE}/space/${inputs.spaceId}/list?archived=${inputs.archived ?? false}`;
                }
                break;
            }
            case 'getList': {
                url = `${BASE}/list/${inputs.listId}`;
                break;
            }
            case 'createList': {
                url = inputs.folderId
                    ? `${BASE}/folder/${inputs.folderId}/list`
                    : `${BASE}/space/${inputs.spaceId}/list`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    content: inputs.content,
                    due_date: inputs.dueDate,
                    priority: inputs.priority,
                    status: inputs.status,
                });
                break;
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.archived) params.set('archived', inputs.archived);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.orderBy) params.set('order_by', inputs.orderBy);
                if (inputs.reverse) params.set('reverse', inputs.reverse);
                if (inputs.subtasks) params.set('subtasks', inputs.subtasks);
                if (inputs.statuses) params.set('statuses[]', inputs.statuses);
                url = `${BASE}/list/${inputs.listId}/task?${params.toString()}`;
                break;
            }
            case 'getTask': {
                url = `${BASE}/task/${inputs.taskId}`;
                break;
            }
            case 'createTask': {
                url = `${BASE}/list/${inputs.listId}/task`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    description: inputs.description,
                    assignees: inputs.assignees,
                    tags: inputs.tags,
                    status: inputs.status,
                    priority: inputs.priority,
                    due_date: inputs.dueDate,
                    due_date_time: inputs.dueDatetime,
                    time_estimate: inputs.timeEstimate,
                    start_date: inputs.startDate,
                    start_date_time: inputs.startDatetime,
                    notify_all: inputs.notifyAll,
                    parent: inputs.parent,
                    links_to: inputs.linksTo,
                });
                break;
            }
            case 'updateTask': {
                url = `${BASE}/task/${inputs.taskId}`;
                method = 'PUT';
                body = JSON.stringify({
                    name: inputs.name,
                    description: inputs.description,
                    status: inputs.status,
                    priority: inputs.priority,
                    due_date: inputs.dueDate,
                    due_date_time: inputs.dueDatetime,
                    time_estimate: inputs.timeEstimate,
                    assignees: inputs.assignees,
                });
                break;
            }
            case 'deleteTask': {
                url = `${BASE}/task/${inputs.taskId}`;
                method = 'DELETE';
                break;
            }
            case 'addComment': {
                url = `${BASE}/task/${inputs.taskId}/comment`;
                method = 'POST';
                body = JSON.stringify({
                    comment_text: inputs.commentText,
                    assignee: inputs.assignee,
                    notify_all: inputs.notifyAll ?? false,
                });
                break;
            }
            case 'listComments': {
                url = `${BASE}/task/${inputs.taskId}/comment`;
                break;
            }
            case 'trackTime': {
                url = `${BASE}/task/${inputs.taskId}/time`;
                method = 'POST';
                body = JSON.stringify({
                    start: inputs.start,
                    stop: inputs.stop,
                    duration: inputs.duration,
                    description: inputs.description,
                    billable: inputs.billable ?? false,
                });
                break;
            }
            default:
                return { error: `Unknown ClickUp Enhanced action: ${actionName}` };
        }

        const res = await fetch(url, {
            method,
            headers,
            body,
        });

        const data = await res.json();

        if (!res.ok) {
            return { error: data.err || data.message || `ClickUp API error: ${res.status}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`ClickUp Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
