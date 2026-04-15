'use server';

export async function executeWrikeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const BASE = 'https://www.wrike.com/api/v4';

        switch (actionName) {
            case 'listFolders': {
                const res = await fetch(`${BASE}/folders`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { folders: data.data } };
            }
            case 'getFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                const res = await fetch(`${BASE}/folders/${folderId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { folder: data.data?.[0] ?? null } };
            }
            case 'createFolder': {
                const parentId = String(inputs.parentId ?? '').trim();
                const res = await fetch(`${BASE}/folders/${parentId}/folders`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { folder: data.data?.[0] ?? null } };
            }
            case 'updateFolder': {
                const folderId = String(inputs.folderId ?? '').trim();
                const res = await fetch(`${BASE}/folders/${folderId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        customStatus: inputs.customStatus,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { folder: data.data?.[0] ?? null } };
            }
            case 'listTasks': {
                const folderId = inputs.folderId ? String(inputs.folderId).trim() : null;
                const url = folderId
                    ? `${BASE}/folders/${folderId}/tasks`
                    : `${BASE}/tasks`;
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.assignee) params.set('assignees', inputs.assignee);
                const res = await fetch(`${url}?${params.toString()}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { tasks: data.data } };
            }
            case 'getTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                const res = await fetch(`${BASE}/tasks/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { task: data.data?.[0] ?? null } };
            }
            case 'createTask': {
                const folderId = String(inputs.folderId ?? '').trim();
                const res = await fetch(`${BASE}/folders/${folderId}/tasks`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        status: inputs.status,
                        importance: inputs.importance,
                        dates: inputs.dates,
                        responsibles: inputs.responsibles,
                        followers: inputs.followers,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { task: data.data?.[0] ?? null } };
            }
            case 'updateTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                const res = await fetch(`${BASE}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        status: inputs.status,
                        importance: inputs.importance,
                        dates: inputs.dates,
                        responsibles: inputs.responsibles,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { task: data.data?.[0] ?? null } };
            }
            case 'deleteTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                const res = await fetch(`${BASE}/tasks/${taskId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { success: true } };
            }
            case 'listContacts': {
                const res = await fetch(`${BASE}/contacts`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { contacts: data.data } };
            }
            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                const res = await fetch(`${BASE}/contacts/${contactId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { contact: data.data?.[0] ?? null } };
            }
            case 'addComment': {
                const taskId = String(inputs.taskId ?? '').trim();
                const res = await fetch(`${BASE}/tasks/${taskId}/comments`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: inputs.text }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { comment: data.data?.[0] ?? null } };
            }
            case 'listComments': {
                const taskId = inputs.taskId ? String(inputs.taskId).trim() : null;
                const url = taskId ? `${BASE}/tasks/${taskId}/comments` : `${BASE}/comments`;
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { comments: data.data } };
            }
            case 'listTimelogs': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${BASE}/timelogs?${params.toString()}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { timelogs: data.data } };
            }
            case 'createTimelog': {
                const taskId = String(inputs.taskId ?? '').trim();
                const res = await fetch(`${BASE}/tasks/${taskId}/timelogs`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        comment: inputs.comment,
                        hours: inputs.hours,
                        trackedDate: inputs.trackedDate,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errorDescription || `API error: ${res.status}`);
                return { output: { timelog: data.data?.[0] ?? null } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
