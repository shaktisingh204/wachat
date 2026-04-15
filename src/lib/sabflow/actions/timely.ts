'use server';

export async function executeTimelyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const accountId = String(inputs.accountId ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!accountId) throw new Error('accountId is required.');

        const base = `https://api.timelyapp.com/1.1/${accountId}`;
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const tFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Timely] ${method} ${path}`);
            const res = await fetch(`${base}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.message || data?.error || `Timely API error: ${res.status}`);
            }
            return data;
        };

        switch (actionName) {
            case 'listEvents': {
                const date = String(inputs.date ?? '').trim();
                const query = date ? `?day=${encodeURIComponent(date)}` : '';
                const data = await tFetch('GET', `/events${query}`);
                return { output: { events: Array.isArray(data) ? data : [] } };
            }

            case 'getEvent': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await tFetch('GET', `/events/${id}`);
                return { output: { event: data } };
            }

            case 'createEvent': {
                const eventBody: Record<string, any> = {};
                if (inputs.total_minutes !== undefined || inputs.duration !== undefined) {
                    eventBody.duration = { total_minutes: inputs.total_minutes ?? inputs.duration };
                }
                if (inputs.label_ids !== undefined) eventBody.label_ids = inputs.label_ids;
                if (inputs.user_id !== undefined) eventBody.user_id = inputs.user_id;
                if (inputs.day !== undefined) eventBody.day = inputs.day;
                if (inputs.project_id !== undefined) eventBody.project_id = inputs.project_id;
                if (inputs.note !== undefined) eventBody.note = inputs.note;
                const data = await tFetch('POST', '/events', { event: eventBody });
                return { output: { event: data } };
            }

            case 'updateEvent': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const eventBody: Record<string, any> = {};
                if (inputs.total_minutes !== undefined || inputs.duration !== undefined) {
                    eventBody.duration = { total_minutes: inputs.total_minutes ?? inputs.duration };
                }
                if (inputs.label_ids !== undefined) eventBody.label_ids = inputs.label_ids;
                if (inputs.note !== undefined) eventBody.note = inputs.note;
                if (inputs.day !== undefined) eventBody.day = inputs.day;
                const data = await tFetch('PUT', `/events/${id}`, { event: eventBody });
                return { output: { event: data } };
            }

            case 'deleteEvent': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await tFetch('DELETE', `/events/${id}`);
                return { output: { success: true } };
            }

            case 'listProjects': {
                const data = await tFetch('GET', '/projects');
                return { output: { projects: Array.isArray(data) ? data : [] } };
            }

            case 'getProject': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await tFetch('GET', `/projects/${id}`);
                return { output: { project: data } };
            }

            case 'createProject': {
                const projectBody: Record<string, any> = {};
                if (inputs.name !== undefined) projectBody.name = inputs.name;
                if (inputs.client_id !== undefined) projectBody.client_id = inputs.client_id;
                if (inputs.budget !== undefined) projectBody.budget = inputs.budget;
                if (inputs.color !== undefined) projectBody.color = inputs.color;
                const data = await tFetch('POST', '/projects', projectBody);
                return { output: { project: data } };
            }

            case 'updateProject': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const projectBody: Record<string, any> = {};
                if (inputs.name !== undefined) projectBody.name = inputs.name;
                if (inputs.budget !== undefined) projectBody.budget = inputs.budget;
                const data = await tFetch('PUT', `/projects/${id}`, projectBody);
                return { output: { project: data } };
            }

            case 'archiveProject': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await tFetch('PUT', `/projects/${id}`, { archive: true });
                return { output: { success: true, project: data } };
            }

            case 'listUsers': {
                const data = await tFetch('GET', '/users');
                return { output: { users: Array.isArray(data) ? data : [] } };
            }

            case 'getUser': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await tFetch('GET', `/users/${id}`);
                return { output: { user: data } };
            }

            case 'listLabels': {
                const data = await tFetch('GET', '/labels');
                return { output: { labels: Array.isArray(data) ? data : [] } };
            }

            case 'getReport': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                if (!from || !to) throw new Error('from and to dates are required.');
                const data = await tFetch('GET', `/reports?by=project&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
                return { output: { report: data } };
            }

            case 'listTasks': {
                const labelId = String(inputs.id ?? inputs.labelId ?? '').trim();
                if (!labelId) throw new Error('id (label_id) is required.');
                const data = await tFetch('GET', `/events?label_id=${encodeURIComponent(labelId)}`);
                return { output: { tasks: Array.isArray(data) ? data : [] } };
            }

            default:
                throw new Error(`Unknown Timely action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Timely] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown Timely error' };
    }
}
