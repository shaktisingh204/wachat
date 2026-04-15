'use server';

export async function executeClockifyEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'apiKey is required' };

        const BASE_URL = 'https://api.clockify.me/api/v1';
        const REPORTS_URL = 'https://reports.api.clockify.me/v1';

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
        };

        const get = async (path: string, baseUrl = BASE_URL) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
            if (!res.ok) return { error: `GET ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const post = async (path: string, body: any, baseUrl = BASE_URL) => {
            const res = await fetch(`${baseUrl}${path}`, {
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

        const patch = async (path: string, body: any) => {
            const res = await fetch(`${BASE_URL}${path}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(body),
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
                // Clockify returns all workspaces; filter to find the one requested
                const result = await get('/workspaces');
                if (result.error) return result;
                const ws = (result.output as any[]).find((w: any) => w.id === workspaceId);
                if (!ws) return { error: `Workspace ${workspaceId} not found` };
                return { output: ws };
            }

            case 'listProjects': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                const params = new URLSearchParams();
                if (inputs.archived !== undefined) params.set('archived', String(inputs.archived));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page-size', String(inputs.pageSize));
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
                if (inputs.clientId) body.clientId = inputs.clientId;
                if (inputs.color) body.color = inputs.color;
                if (inputs.isPublic !== undefined) body.isPublic = inputs.isPublic;
                if (inputs.billable !== undefined) body.billable = inputs.billable;
                return post(`/workspaces/${workspaceId}/projects`, body);
            }

            case 'updateProject': {
                const workspaceId = inputs.workspaceId;
                const projectId = inputs.projectId;
                if (!workspaceId || !projectId) return { error: 'workspaceId and projectId are required' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.color) body.color = inputs.color;
                if (inputs.isPublic !== undefined) body.isPublic = inputs.isPublic;
                if (inputs.billable !== undefined) body.billable = inputs.billable;
                return put(`/workspaces/${workspaceId}/projects/${projectId}`, body);
            }

            case 'archiveProject': {
                const workspaceId = inputs.workspaceId;
                const projectId = inputs.projectId;
                if (!workspaceId || !projectId) return { error: 'workspaceId and projectId are required' };
                return patch(`/workspaces/${workspaceId}/projects/${projectId}`, { archived: true });
            }

            case 'listUsers': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page-size', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/workspaces/${workspaceId}/users${qs}`);
            }

            case 'getUser':
                return get('/user');

            case 'listTimeEntries': {
                const workspaceId = inputs.workspaceId;
                const userId = inputs.userId;
                if (!workspaceId || !userId) return { error: 'workspaceId and userId are required' };
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.end) params.set('end', inputs.end);
                if (inputs.project) params.set('project', inputs.project);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page-size', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/workspaces/${workspaceId}/user/${userId}/time-entries${qs}`);
            }

            case 'getTimeEntry': {
                const workspaceId = inputs.workspaceId;
                const timeEntryId = inputs.timeEntryId;
                if (!workspaceId || !timeEntryId) return { error: 'workspaceId and timeEntryId are required' };
                return get(`/workspaces/${workspaceId}/time-entries/${timeEntryId}`);
            }

            case 'createTimeEntry': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                if (!inputs.start) return { error: 'start is required' };
                const body: any = { start: inputs.start };
                if (inputs.end) body.end = inputs.end;
                if (inputs.projectId) body.projectId = inputs.projectId;
                if (inputs.description) body.description = inputs.description;
                if (inputs.tagIds) body.tagIds = Array.isArray(inputs.tagIds) ? inputs.tagIds : [inputs.tagIds];
                if (inputs.billable !== undefined) body.billable = inputs.billable;
                return post(`/workspaces/${workspaceId}/time-entries`, body);
            }

            case 'updateTimeEntry': {
                const workspaceId = inputs.workspaceId;
                const timeEntryId = inputs.timeEntryId;
                if (!workspaceId || !timeEntryId) return { error: 'workspaceId and timeEntryId are required' };
                const body: any = {};
                if (inputs.start) body.start = inputs.start;
                if (inputs.end) body.end = inputs.end;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.projectId) body.projectId = inputs.projectId;
                if (inputs.tagIds) body.tagIds = Array.isArray(inputs.tagIds) ? inputs.tagIds : [inputs.tagIds];
                if (inputs.billable !== undefined) body.billable = inputs.billable;
                return put(`/workspaces/${workspaceId}/time-entries/${timeEntryId}`, body);
            }

            case 'deleteTimeEntry': {
                const workspaceId = inputs.workspaceId;
                const timeEntryId = inputs.timeEntryId;
                if (!workspaceId || !timeEntryId) return { error: 'workspaceId and timeEntryId are required' };
                return del(`/workspaces/${workspaceId}/time-entries/${timeEntryId}`);
            }

            case 'getWorkspaceSummaryReport': {
                const workspaceId = inputs.workspaceId;
                if (!workspaceId) return { error: 'workspaceId is required' };
                if (!inputs.dateRangeStart || !inputs.dateRangeEnd) {
                    return { error: 'dateRangeStart and dateRangeEnd are required' };
                }
                const body: any = {
                    dateRangeStart: inputs.dateRangeStart,
                    dateRangeEnd: inputs.dateRangeEnd,
                    summaryFilter: {
                        groups: inputs.groups ?? ['PROJECT'],
                    },
                };
                if (inputs.amountShown) body.amountShown = inputs.amountShown;
                return post(`/workspaces/${workspaceId}/reports/summary`, body, REPORTS_URL);
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
