'use server';

export async function executeEverhourAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.everhour.com';
        const headers = {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const eFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Everhour] ${method} ${path}`);
            const res = await fetch(`${base}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.message || data?.error || `Everhour API error: ${res.status}`);
            }
            return data;
        };

        switch (actionName) {
            case 'listProjects': {
                const data = await eFetch('GET', '/projects');
                return { output: { projects: Array.isArray(data) ? data : [] } };
            }

            case 'getProject': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await eFetch('GET', `/projects/${id}`);
                return { output: { project: data } };
            }

            case 'listTasks': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await eFetch('GET', `/projects/${projectId}/tasks`);
                return { output: { tasks: Array.isArray(data) ? data : [] } };
            }

            case 'getTask': {
                const projectId = String(inputs.projectId ?? '').trim();
                const taskId = String(inputs.taskId ?? '').trim();
                if (!projectId || !taskId) throw new Error('projectId and taskId are required.');
                const data = await eFetch('GET', `/projects/${projectId}/tasks/${taskId}`);
                return { output: { task: data } };
            }

            case 'startTimer': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const body: Record<string, any> = { task: { id: taskId } };
                if (inputs.comment !== undefined) body.comment = inputs.comment;
                const data = await eFetch('POST', '/timers', body);
                return { output: { timer: data } };
            }

            case 'stopTimer': {
                const data = await eFetch('DELETE', '/timers/current');
                return { output: { timer: data } };
            }

            case 'getTimer': {
                const data = await eFetch('GET', '/timers/current');
                return { output: { timer: data } };
            }

            case 'listTimers': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const query = new URLSearchParams();
                if (from) query.set('from', from);
                if (to) query.set('to', to);
                const qs = query.toString();
                const data = await eFetch('GET', `/timers${qs ? `?${qs}` : ''}`);
                return { output: { timers: Array.isArray(data) ? data : [] } };
            }

            case 'addTimeRecord': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const body: Record<string, any> = { task: { id: taskId } };
                if (inputs.time !== undefined) body.time = inputs.time;
                if (inputs.date !== undefined) body.date = inputs.date;
                const data = await eFetch('POST', '/time', body);
                return { output: { record: data } };
            }

            case 'updateTimeRecord': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: Record<string, any> = {};
                if (inputs.time !== undefined) body.time = inputs.time;
                if (inputs.date !== undefined) body.date = inputs.date;
                const data = await eFetch('PUT', `/time/${id}`, body);
                return { output: { record: data } };
            }

            case 'deleteTimeRecord': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await eFetch('DELETE', `/time/${id}`);
                return { output: { success: true, record: data } };
            }

            case 'listClients': {
                const data = await eFetch('GET', '/clients');
                return { output: { clients: Array.isArray(data) ? data : [] } };
            }

            case 'getClient': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await eFetch('GET', `/clients/${id}`);
                return { output: { client: data } };
            }

            case 'createClient': {
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.email !== undefined) body.email = inputs.email;
                const data = await eFetch('POST', '/clients', body);
                return { output: { client: data } };
            }

            case 'listMembers': {
                const data = await eFetch('GET', '/team/members');
                return { output: { members: Array.isArray(data) ? data : [] } };
            }

            case 'getReport': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id (project id) is required.');
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const query = new URLSearchParams();
                if (from) query.set('from', from);
                if (to) query.set('to', to);
                const qs = query.toString();
                const data = await eFetch('GET', `/projects/${id}/time${qs ? `?${qs}` : ''}`);
                return { output: { report: data } };
            }

            default:
                throw new Error(`Unknown Everhour action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Everhour] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown Everhour error' };
    }
}
