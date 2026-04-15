'use server';

export async function executeTogglEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) return { error: 'apiToken is required' };

        const base64Auth = Buffer.from(`${apiToken}:api_token`).toString('base64');
        const BASE_URL = 'https://api.track.toggl.com/api/v9';

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Basic ${base64Auth}`,
        };

        const get = async (path: string) => {
            const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
            if (!res.ok) return { error: `GET ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${BASE_URL}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok) return { error: `POST ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const put = async (path: string, body: any) => {
            const res = await fetch(`${BASE_URL}${path}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok) return { error: `PUT ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const del = async (path: string) => {
            const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers });
            if (!res.ok) return { error: `DELETE ${path} failed: ${res.status} ${await res.text()}` };
            const text = await res.text();
            return { output: text ? JSON.parse(text) : { success: true } };
        };

        const patch = async (path: string, body?: any) => {
            const res = await fetch(`${BASE_URL}${path}`, {
                method: 'PATCH',
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) return { error: `PATCH ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        switch (actionName) {
            case 'listWorkspaces':
                return get('/workspaces');

            case 'getWorkspace': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                return get(`/workspaces/${workspaceId}`);
            }

            case 'listProjects': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                const params = new URLSearchParams();
                if (inputs.active !== undefined) params.set('active', String(inputs.active));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/workspaces/${workspaceId}/projects${qs}`);
            }

            case 'getProject': {
                const workspaceId = inputs.workspaceId;
                const projectId = inputs.projectId;
                if (!workspaceId || !projectId) return { error: 'workspaceId and projectId are required' };
                return get(`/workspaces/${workspaceId}/projects/${projectId}`);
            }

            case 'createProject': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                if (!inputs.name) return { error: 'name is required' };
                const body: any = { name: inputs.name };
                if (inputs.clientId) body.client_id = inputs.clientId;
                if (inputs.color) body.color = inputs.color;
                if (inputs.active !== undefined) body.active = inputs.active;
                if (inputs.isPrivate !== undefined) body.is_private = inputs.isPrivate;
                return post(`/workspaces/${workspaceId}/projects`, body);
            }

            case 'updateProject': {
                const workspaceId = inputs.workspaceId;
                const projectId = inputs.projectId;
                if (!workspaceId || !projectId) return { error: 'workspaceId and projectId are required' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.color) body.color = inputs.color;
                if (inputs.active !== undefined) body.active = inputs.active;
                if (inputs.clientId) body.client_id = inputs.clientId;
                return put(`/workspaces/${workspaceId}/projects/${projectId}`, body);
            }

            case 'deleteProject': {
                const workspaceId = inputs.workspaceId;
                const projectId = inputs.projectId;
                if (!workspaceId || !projectId) return { error: 'workspaceId and projectId are required' };
                return del(`/workspaces/${workspaceId}/projects/${projectId}`);
            }

            case 'listTimeEntries': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/me/time_entries${qs}`);
            }

            case 'getTimeEntry': {
                const timeEntryId = inputs.timeEntryId;
                if (!timeEntryId) return { error: 'timeEntryId is required' };
                return get(`/me/time_entries/${timeEntryId}`);
            }

            case 'createTimeEntry': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                if (!inputs.startDate) return { error: 'startDate is required' };
                const body: any = {
                    workspace_id: Number(workspaceId),
                    start: inputs.startDate,
                    duration: inputs.duration ?? -1,
                    created_with: 'sabflow',
                };
                if (inputs.projectId) body.project_id = Number(inputs.projectId);
                if (inputs.description) body.description = inputs.description;
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : [inputs.tags];
                if (inputs.stopDate) body.stop = inputs.stopDate;
                return post(`/workspaces/${workspaceId}/time_entries`, body);
            }

            case 'updateTimeEntry': {
                const workspaceId = inputs.workspaceId;
                const timeEntryId = inputs.timeEntryId;
                if (!workspaceId || !timeEntryId) return { error: 'workspaceId and timeEntryId are required' };
                const body: any = {};
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.projectId) body.project_id = Number(inputs.projectId);
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : [inputs.tags];
                if (inputs.startDate) body.start = inputs.startDate;
                if (inputs.stopDate) body.stop = inputs.stopDate;
                return put(`/workspaces/${workspaceId}/time_entries/${timeEntryId}`, body);
            }

            case 'deleteTimeEntry': {
                const workspaceId = inputs.workspaceId;
                const timeEntryId = inputs.timeEntryId;
                if (!workspaceId || !timeEntryId) return { error: 'workspaceId and timeEntryId are required' };
                return del(`/workspaces/${workspaceId}/time_entries/${timeEntryId}`);
            }

            case 'getRunningTimeEntry':
                return get('/me/time_entries/current');

            case 'startTimer': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                const body: any = {
                    workspace_id: Number(workspaceId),
                    start: new Date().toISOString(),
                    duration: -1,
                    created_with: 'sabflow',
                };
                if (inputs.projectId) body.project_id = Number(inputs.projectId);
                if (inputs.description) body.description = inputs.description;
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : [inputs.tags];
                return post(`/workspaces/${workspaceId}/time_entries`, body);
            }

            case 'stopTimer': {
                const workspaceId = inputs.workspaceId;
                const timeEntryId = inputs.timeEntryId;
                if (!workspaceId || !timeEntryId) return { error: 'workspaceId and timeEntryId are required' };
                return patch(`/workspaces/${workspaceId}/time_entries/${timeEntryId}/stop`);
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
