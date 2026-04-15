'use server';

export async function executeBasecampEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = inputs.accessToken;
        const accountId = inputs.accountId;
        const baseUrl = `https://3.basecampapi.com/${accountId}`;

        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'SabFlow (sabnode@example.com)',
        };

        const req = async (method: string, path: string, body?: any) => {
            logger?.log(`[BasecampEnhanced] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Basecamp API error ${res.status}: ${text}`);
            }
            if (res.status === 204) return {};
            return res.json();
        };

        switch (actionName) {
            case 'listProjects': {
                const data = await req('GET', '/projects.json');
                return { output: { projects: data } };
            }
            case 'getProject': {
                const data = await req('GET', `/projects/${inputs.projectId}.json`);
                return { output: { project: data } };
            }
            case 'createProject': {
                const data = await req('POST', '/projects.json', {
                    name: inputs.name,
                    description: inputs.description,
                });
                return { output: { project: data } };
            }
            case 'listTodolists': {
                const data = await req('GET', `/buckets/${inputs.projectId}/todosets/${inputs.todosetId}/todolists.json`);
                return { output: { todolists: data } };
            }
            case 'getTodolist': {
                const data = await req('GET', `/buckets/${inputs.projectId}/todolists/${inputs.todolistId}.json`);
                return { output: { todolist: data } };
            }
            case 'createTodolist': {
                const data = await req('POST', `/buckets/${inputs.projectId}/todosets/${inputs.todosetId}/todolists.json`, {
                    name: inputs.name,
                    description: inputs.description,
                });
                return { output: { todolist: data } };
            }
            case 'listTodos': {
                const data = await req('GET', `/buckets/${inputs.projectId}/todolists/${inputs.todolistId}/todos.json`);
                return { output: { todos: data } };
            }
            case 'getTodo': {
                const data = await req('GET', `/buckets/${inputs.projectId}/todos/${inputs.todoId}.json`);
                return { output: { todo: data } };
            }
            case 'createTodo': {
                const body: any = { content: inputs.content };
                if (inputs.description) body.description = inputs.description;
                if (inputs.assigneeIds) body.assignee_ids = inputs.assigneeIds;
                if (inputs.dueOn) body.due_on = inputs.dueOn;
                if (inputs.notify !== undefined) body.notify = inputs.notify;
                const data = await req('POST', `/buckets/${inputs.projectId}/todolists/${inputs.todolistId}/todos.json`, body);
                return { output: { todo: data } };
            }
            case 'updateTodo': {
                const body: any = {};
                if (inputs.content) body.content = inputs.content;
                if (inputs.description) body.description = inputs.description;
                if (inputs.dueOn) body.due_on = inputs.dueOn;
                if (inputs.assigneeIds) body.assignee_ids = inputs.assigneeIds;
                const data = await req('PUT', `/buckets/${inputs.projectId}/todos/${inputs.todoId}.json`, body);
                return { output: { todo: data } };
            }
            case 'completeTodo': {
                await req('POST', `/buckets/${inputs.projectId}/todos/${inputs.todoId}/completion.json`);
                return { output: { success: true, todoId: inputs.todoId } };
            }
            case 'listMessages': {
                const data = await req('GET', `/buckets/${inputs.projectId}/message_boards/${inputs.messageBoardId}/messages.json`);
                return { output: { messages: data } };
            }
            case 'getMessage': {
                const data = await req('GET', `/buckets/${inputs.projectId}/messages/${inputs.messageId}.json`);
                return { output: { message: data } };
            }
            case 'createMessage': {
                const body: any = {
                    subject: inputs.subject,
                    content: inputs.content,
                };
                if (inputs.categoryId) body.category_id = inputs.categoryId;
                const data = await req('POST', `/buckets/${inputs.projectId}/message_boards/${inputs.messageBoardId}/messages.json`, body);
                return { output: { message: data } };
            }
            case 'listScheduleEntries': {
                const data = await req('GET', `/buckets/${inputs.projectId}/schedules/${inputs.scheduleId}/entries.json`);
                return { output: { entries: data } };
            }
            default:
                return { error: `Unknown Basecamp Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.error?.(`[BasecampEnhanced] Error: ${err.message}`);
        return { error: err.message || 'BasecampEnhanced action failed' };
    }
}
