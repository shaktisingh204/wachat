'use server';

async function basecampFetch(accountId: string, accessToken: string, userEmail: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Basecamp] ${method} ${path}`);
    const url = `https://3.basecampapi.com/${accountId}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': `SabFlow (${userEmail})`,
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204 || res.status === 201 && !res.headers.get('content-type')?.includes('json')) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Basecamp API error: ${res.status}`);
    }
    return data;
}

export async function executeBasecampAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accountId = String(inputs.accountId ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accountId || !accessToken) throw new Error('accountId and accessToken are required.');

        const userEmail = user?.email || 'app';
        const bc = (method: string, path: string, body?: any) => basecampFetch(accountId, accessToken, userEmail, method, path, body, logger);

        switch (actionName) {
            case 'listProjects': {
                const data = await bc('GET', '/projects.json');
                return { output: { projects: data ?? [], count: (data ?? []).length } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await bc('GET', `/projects/${projectId}.json`);
                return { output: { project: data } };
            }

            case 'createProject': {
                const name = String(inputs.name ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (description) body.description = description;
                const data = await bc('POST', '/projects.json', body);
                return { output: { project: data } };
            }

            case 'listTodolists': {
                const projectId = String(inputs.projectId ?? '').trim();
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await bc('GET', `/buckets/${bucketId}/todolists.json`);
                return { output: { todolists: data ?? [], count: (data ?? []).length } };
            }

            case 'getTodolist': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const todolistId = String(inputs.todolistId ?? '').trim();
                if (!bucketId || !todolistId) throw new Error('bucketId and todolistId are required.');
                const data = await bc('GET', `/buckets/${bucketId}/todolists/${todolistId}.json`);
                return { output: { todolist: data } };
            }

            case 'createTodolist': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const todosetId = String(inputs.todosetId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!bucketId || !todosetId || !name) throw new Error('bucketId, todosetId, and name are required.');
                const data = await bc('POST', `/buckets/${bucketId}/todosets/${todosetId}/todolists.json`, { name });
                return { output: { todolist: data } };
            }

            case 'listTodos': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const todolistId = String(inputs.todolistId ?? '').trim();
                if (!bucketId || !todolistId) throw new Error('bucketId and todolistId are required.');
                const data = await bc('GET', `/buckets/${bucketId}/todolists/${todolistId}/todos.json`);
                return { output: { todos: data ?? [], count: (data ?? []).length } };
            }

            case 'getTodo': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const todoId = String(inputs.todoId ?? '').trim();
                if (!bucketId || !todoId) throw new Error('bucketId and todoId are required.');
                const data = await bc('GET', `/buckets/${bucketId}/todos/${todoId}.json`);
                return { output: { todo: data } };
            }

            case 'createTodo': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const todolistId = String(inputs.todolistId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!bucketId || !todolistId || !content) throw new Error('bucketId, todolistId, and content are required.');
                const body: any = { content };
                if (inputs.due_on) body.due_on = String(inputs.due_on);
                if (inputs.assignee_ids) body.assignee_ids = inputs.assignee_ids;
                const data = await bc('POST', `/buckets/${bucketId}/todolists/${todolistId}/todos.json`, body);
                return { output: { todo: data } };
            }

            case 'completeTodo': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const todoId = String(inputs.todoId ?? '').trim();
                if (!bucketId || !todoId) throw new Error('bucketId and todoId are required.');
                await bc('POST', `/buckets/${bucketId}/todos/${todoId}/completion.json`);
                return { output: { completed: 'true', todoId } };
            }

            case 'listMessages': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const messageBoardId = String(inputs.messageBoardId ?? '').trim();
                if (!bucketId || !messageBoardId) throw new Error('bucketId and messageBoardId are required.');
                const data = await bc('GET', `/buckets/${bucketId}/message_boards/${messageBoardId}/messages.json`);
                return { output: { messages: data ?? [], count: (data ?? []).length } };
            }

            case 'getMessage': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!bucketId || !messageId) throw new Error('bucketId and messageId are required.');
                const data = await bc('GET', `/buckets/${bucketId}/messages/${messageId}.json`);
                return { output: { message: data } };
            }

            case 'createMessage': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const messageBoardId = String(inputs.messageBoardId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!bucketId || !messageBoardId || !subject) throw new Error('bucketId, messageBoardId, and subject are required.');
                const data = await bc('POST', `/buckets/${bucketId}/message_boards/${messageBoardId}/messages.json`, { subject, content });
                return { output: { message: data } };
            }

            case 'listComments': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const recordingId = String(inputs.recordingId ?? '').trim();
                if (!bucketId || !recordingId) throw new Error('bucketId and recordingId are required.');
                const data = await bc('GET', `/buckets/${bucketId}/recordings/${recordingId}/comments.json`);
                return { output: { comments: data ?? [], count: (data ?? []).length } };
            }

            case 'createComment': {
                const bucketId = String(inputs.bucketId ?? inputs.projectId ?? '').trim();
                const recordingId = String(inputs.recordingId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!bucketId || !recordingId || !content) throw new Error('bucketId, recordingId, and content are required.');
                const data = await bc('POST', `/buckets/${bucketId}/recordings/${recordingId}/comments.json`, { content });
                return { output: { comment: data } };
            }

            case 'listPeople': {
                const data = await bc('GET', '/people.json');
                return { output: { people: data ?? [], count: (data ?? []).length } };
            }

            case 'getPerson': {
                const personId = String(inputs.personId ?? '').trim();
                if (!personId) throw new Error('personId is required.');
                const data = await bc('GET', `/people/${personId}.json`);
                return { output: { person: data } };
            }

            default:
                return { error: `Basecamp action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Basecamp action failed.' };
    }
}
