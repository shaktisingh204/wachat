'use server';

async function wrikeFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Wrike] ${method} ${path}`);
    const url = `https://www.wrike.com/api/v4${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errorDescription || data?.error || `Wrike API error: ${res.status}`);
    }
    return data;
}

export async function executeWrikeAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const w = (method: string, path: string, body?: any) => wrikeFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listFolders': {
                const data = await w('GET', '/folders');
                return { output: { folders: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'getFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                const data = await w('GET', `/folders/${folderId}`);
                return { output: { folder: data.data?.[0] ?? {} } };
            }

            case 'createFolder': {
                const parentId = String(inputs.parentId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!parentId || !title) throw new Error('parentId and title are required.');
                const data = await w('POST', `/folders/${parentId}/folders`, { title });
                return { output: { folder: data.data?.[0] ?? {} } };
            }

            case 'updateFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                const body: any = {};
                if (title) body.title = title;
                const data = await w('PUT', `/folders/${folderId}`, body);
                return { output: { folder: data.data?.[0] ?? {} } };
            }

            case 'deleteFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                await w('DELETE', `/folders/${folderId}`);
                return { output: { deleted: 'true', folderId } };
            }

            case 'listTasks': {
                const folderId = String(inputs.folderId ?? '').trim();
                const path = folderId ? `/folders/${folderId}/tasks` : '/tasks';
                const data = await w('GET', path);
                return { output: { tasks: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'getTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const data = await w('GET', `/tasks/${taskId}`);
                return { output: { task: data.data?.[0] ?? {} } };
            }

            case 'createTask': {
                const folderId = String(inputs.folderId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!folderId || !title) throw new Error('folderId and title are required.');
                const body: any = { title };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.importance) body.importance = String(inputs.importance);
                const data = await w('POST', `/folders/${folderId}/tasks`, body);
                return { output: { task: data.data?.[0] ?? {} } };
            }

            case 'updateTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const body: any = {};
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.importance) body.importance = String(inputs.importance);
                const data = await w('PUT', `/tasks/${taskId}`, body);
                return { output: { task: data.data?.[0] ?? {} } };
            }

            case 'deleteTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                await w('DELETE', `/tasks/${taskId}`);
                return { output: { deleted: 'true', taskId } };
            }

            case 'listComments': {
                const taskId = String(inputs.taskId ?? '').trim();
                const path = taskId ? `/tasks/${taskId}/comments` : '/comments';
                const data = await w('GET', path);
                return { output: { comments: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'createComment': {
                const taskId = String(inputs.taskId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!taskId || !text) throw new Error('taskId and text are required.');
                const data = await w('POST', `/tasks/${taskId}/comments`, { text });
                return { output: { comment: data.data?.[0] ?? {} } };
            }

            case 'listContacts': {
                const data = await w('GET', '/contacts');
                return { output: { contacts: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await w('GET', `/contacts/${contactId}`);
                return { output: { contact: data.data?.[0] ?? {} } };
            }

            case 'listCustomFields': {
                const data = await w('GET', '/customfields');
                return { output: { customFields: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'updateCustomFieldValue': {
                const taskId = String(inputs.taskId ?? '').trim();
                const fieldId = String(inputs.fieldId ?? '').trim();
                const value = inputs.value;
                if (!taskId || !fieldId) throw new Error('taskId and fieldId are required.');
                const data = await w('PUT', `/tasks/${taskId}`, {
                    customFields: [{ id: fieldId, value }],
                });
                return { output: { task: data.data?.[0] ?? {} } };
            }

            case 'listWorkflows': {
                const data = await w('GET', '/workflows');
                return { output: { workflows: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'getTimelogs': {
                const taskId = String(inputs.taskId ?? '').trim();
                const path = taskId ? `/tasks/${taskId}/timelogs` : '/timelogs';
                const data = await w('GET', path);
                return { output: { timelogs: data.data ?? [], count: (data.data ?? []).length } };
            }

            default:
                return { error: `Wrike action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Wrike action failed.' };
    }
}
