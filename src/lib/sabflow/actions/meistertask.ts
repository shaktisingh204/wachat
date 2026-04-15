'use server';

export async function executeMeistertaskAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://www.meistertask.com/api';

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listProjects': {
                url = `${BASE}/projects`;
                break;
            }
            case 'getProject': {
                url = `${BASE}/projects/${inputs.projectId}`;
                break;
            }
            case 'listSections': {
                url = `${BASE}/projects/${inputs.projectId}/sections`;
                break;
            }
            case 'getSection': {
                url = `${BASE}/sections/${inputs.sectionId}`;
                break;
            }
            case 'createSection': {
                url = `${BASE}/projects/${inputs.projectId}/sections`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    type: inputs.type,
                });
                break;
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                url = `${BASE}/sections/${inputs.sectionId}/tasks?${params.toString()}`;
                break;
            }
            case 'getTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                break;
            }
            case 'createTask': {
                url = `${BASE}/sections/${inputs.sectionId}/tasks`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    notes: inputs.notes,
                    due: inputs.due,
                    assigned_to_id: inputs.assignedToId,
                    token: inputs.taskToken,
                    status: inputs.status,
                });
                break;
            }
            case 'updateTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                method = 'PUT';
                body = JSON.stringify({
                    name: inputs.name,
                    notes: inputs.notes,
                    due: inputs.due,
                    assigned_to_id: inputs.assignedToId,
                    status: inputs.status,
                });
                break;
            }
            case 'deleteTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                method = 'DELETE';
                break;
            }
            case 'moveTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                method = 'PUT';
                body = JSON.stringify({
                    section_id: inputs.sectionId,
                });
                break;
            }
            case 'listComments': {
                url = `${BASE}/tasks/${inputs.taskId}/comments`;
                break;
            }
            case 'createComment': {
                url = `${BASE}/tasks/${inputs.taskId}/comments`;
                method = 'POST';
                body = JSON.stringify({
                    text: inputs.text,
                });
                break;
            }
            case 'listAttachments': {
                url = `${BASE}/tasks/${inputs.taskId}/attachments`;
                break;
            }
            case 'listPersons': {
                url = `${BASE}/projects/${inputs.projectId}/members`;
                break;
            }
            default:
                return { error: `Unknown MeisterTask action: ${actionName}` };
        }

        const res = await fetch(url, {
            method,
            headers,
            body,
        });

        if (res.status === 204) {
            return { output: { success: true } };
        }

        const data = await res.json();

        if (!res.ok) {
            return { error: data.message || data.error || `MeisterTask API error: ${res.status}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`MeisterTask action error: ${err.message}`);
        return { error: err.message };
    }
}
