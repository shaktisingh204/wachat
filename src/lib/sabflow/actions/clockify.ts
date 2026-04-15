'use server';

async function clockifyFetch(
    apiKey: string,
    method: string,
    url: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Clockify] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? `Clockify API error: ${res.status}`);
    }
    return data;
}

export async function executeClockifyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const BASE = 'https://api.clockify.me/api/v1';
        const REPORTS = 'https://reports.api.clockify.me/v1';

        // workspace resolution: prefer explicit input, fall back to inputs.workspaceId
        const resolveWs = (override?: string) => {
            const ws = String(override ?? inputs.workspaceId ?? '').trim();
            if (!ws) throw new Error('workspaceId is required.');
            return ws;
        };

        const cf = (method: string, url: string, body?: any) =>
            clockifyFetch(apiKey, method, url, body, logger);

        switch (actionName) {
            case 'getWorkspaces': {
                const data = await cf('GET', `${BASE}/workspaces`);
                return { output: { workspaces: Array.isArray(data) ? data : [] } };
            }

            case 'getProjects': {
                const ws = resolveWs(inputs.workspaceId);
                const data = await cf('GET', `${BASE}/workspaces/${ws}/projects`);
                const projects = (Array.isArray(data) ? data : []).map((p: any) => ({
                    id: String(p.id ?? ''),
                    name: p.name ?? '',
                    color: p.color ?? '',
                    duration: p.duration ?? '',
                }));
                return { output: { projects } };
            }

            case 'getProject': {
                const ws = resolveWs(inputs.workspaceId);
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await cf('GET', `${BASE}/workspaces/${ws}/projects/${projectId}`);
                return {
                    output: {
                        id: String(data.id ?? projectId),
                        name: data.name ?? '',
                        duration: data.duration ?? '',
                        estimate: data.estimate ?? {},
                    },
                };
            }

            case 'createProject': {
                const ws = resolveWs(inputs.workspaceId);
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = { name };
                if (inputs.color) body.color = String(inputs.color);
                if (inputs.clientId) body.clientId = String(inputs.clientId);
                if (inputs.billable !== undefined) body.billable = inputs.billable === true || inputs.billable === 'true';
                const data = await cf('POST', `${BASE}/workspaces/${ws}/projects`, body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'getTimeEntries': {
                const ws = resolveWs(inputs.workspaceId);
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.end) params.set('end', String(inputs.end));
                if (inputs.projectId) params.set('project', String(inputs.projectId));
                if (inputs.page) params.set('page', String(inputs.page));
                params.set('page-size', String(inputs.pageSize ?? 50));
                const data = await cf('GET', `${BASE}/workspaces/${ws}/user/${userId}/time-entries?${params.toString()}`);
                return { output: { entries: Array.isArray(data) ? data : [] } };
            }

            case 'createTimeEntry': {
                const ws = resolveWs(inputs.workspaceId);
                const start = String(inputs.start ?? '').trim();
                if (!start) throw new Error('start is required.');
                const body: Record<string, any> = { start };
                if (inputs.end) body.end = String(inputs.end);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.projectId) body.projectId = String(inputs.projectId);
                if (inputs.taskId) body.taskId = String(inputs.taskId);
                if (inputs.billable !== undefined) body.billable = inputs.billable === true || inputs.billable === 'true';
                const data = await cf('POST', `${BASE}/workspaces/${ws}/time-entries`, body);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        description: data.description ?? '',
                        timeInterval: data.timeInterval ?? {},
                    },
                };
            }

            case 'updateTimeEntry': {
                const ws = resolveWs(inputs.workspaceId);
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                const body: Record<string, any> = {};
                if (inputs.start) body.start = String(inputs.start);
                if (inputs.end) body.end = String(inputs.end);
                if (inputs.description !== undefined) body.description = String(inputs.description);
                if (inputs.projectId) body.projectId = String(inputs.projectId);
                const data = await cf('PUT', `${BASE}/workspaces/${ws}/time-entries/${entryId}`, body);
                return { output: { id: String(data.id ?? entryId) } };
            }

            case 'deleteTimeEntry': {
                const ws = resolveWs(inputs.workspaceId);
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                await cf('DELETE', `${BASE}/workspaces/${ws}/time-entries/${entryId}`);
                return { output: { deleted: true } };
            }

            case 'getTasks': {
                const ws = resolveWs(inputs.workspaceId);
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await cf('GET', `${BASE}/workspaces/${ws}/projects/${projectId}/tasks`);
                return { output: { tasks: Array.isArray(data) ? data : [] } };
            }

            case 'createTask': {
                const ws = resolveWs(inputs.workspaceId);
                const projectId = String(inputs.projectId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = { name };
                if (inputs.duration) body.duration = String(inputs.duration);
                if (inputs.assigneeIds) body.assigneeIds = Array.isArray(inputs.assigneeIds) ? inputs.assigneeIds : [inputs.assigneeIds];
                const data = await cf('POST', `${BASE}/workspaces/${ws}/projects/${projectId}/tasks`, body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'getClients': {
                const ws = resolveWs(inputs.workspaceId);
                const data = await cf('GET', `${BASE}/workspaces/${ws}/clients`);
                return { output: { clients: Array.isArray(data) ? data : [] } };
            }

            case 'createClient': {
                const ws = resolveWs(inputs.workspaceId);
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await cf('POST', `${BASE}/workspaces/${ws}/clients`, { name });
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'getUsers': {
                const ws = resolveWs(inputs.workspaceId);
                const data = await cf('GET', `${BASE}/workspaces/${ws}/users`);
                return { output: { users: Array.isArray(data) ? data : [] } };
            }

            case 'getSummaryReport': {
                const ws = resolveWs(inputs.workspaceId);
                const dateRangeStart = String(inputs.dateRangeStart ?? '').trim();
                const dateRangeEnd = String(inputs.dateRangeEnd ?? '').trim();
                if (!dateRangeStart) throw new Error('dateRangeStart is required.');
                if (!dateRangeEnd) throw new Error('dateRangeEnd is required.');
                const summaryFilter = inputs.summaryFilter ?? { groups: ['PROJECT'] };
                const data = await cf(
                    'POST',
                    `${REPORTS}/workspaces/${ws}/reports/summary`,
                    { dateRangeStart, dateRangeEnd, summaryFilter }
                );
                return {
                    output: {
                        totals: data.totals ?? [],
                        groupOne: data.groupOne ?? [],
                    },
                };
            }

            default:
                return { error: `Clockify action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[Clockify] Error in ${actionName}: ${e.message}`);
        return { error: e.message || 'Clockify action failed.' };
    }
}
