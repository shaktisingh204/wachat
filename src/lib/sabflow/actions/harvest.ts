'use server';

async function harvestFetch(
    accessToken: string,
    accountId: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Harvest] ${method} ${path}`);
    const url = `https://api.harvestapp.com/v2${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Harvest-Account-Id': accountId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'SabFlow (support@sabnode.com)',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error_description || `Harvest API error: ${res.status}`);
    }
    return data;
}

export async function executeHarvestAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const accountId = String(inputs.accountId ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!accountId) throw new Error('accountId is required.');

        const hv = (method: string, path: string, body?: any) =>
            harvestFetch(accessToken, accountId, method, path, body, logger);

        switch (actionName) {
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.isActive !== undefined) params.set('is_active', String(inputs.isActive));
                if (inputs.clientId) params.set('client_id', String(inputs.clientId));
                const data = await hv('GET', `/projects?${params.toString()}`);
                const projects = data.projects ?? [];
                return { output: { projects } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await hv('GET', `/projects/${projectId}`);
                return {
                    output: {
                        id: String(data.id ?? projectId),
                        name: data.name ?? '',
                        billable: String(data.is_billable ?? false),
                        budget: String(data.budget ?? ''),
                    },
                };
            }

            case 'createProject': {
                const clientId = String(inputs.clientId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!clientId || !name) throw new Error('clientId and name are required.');
                const body: Record<string, any> = {
                    client_id: Number(clientId),
                    name,
                    is_billable: inputs.isBillable === true || inputs.isBillable === 'true',
                    bill_by: 'none',
                    budget_by: 'none',
                };
                if (inputs.budget !== undefined) {
                    body.budget = Number(inputs.budget);
                    body.budget_by = 'project';
                }
                const data = await hv('POST', '/projects', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'updateProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = String(inputs.name);
                if (inputs.budget !== undefined) body.budget = Number(inputs.budget);
                const data = await hv('PATCH', `/projects/${projectId}`, body);
                return { output: { id: String(data.id ?? projectId) } };
            }

            case 'listTasks': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await hv('GET', `/projects/${projectId}/task_assignments`);
                const tasks = (data.task_assignments ?? []).map((ta: any) => ta.task ?? ta);
                return { output: { tasks } };
            }

            case 'createTask': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = { name };
                if (inputs.billable !== undefined) body.billable_by_default = inputs.billable === true || inputs.billable === 'true';
                const data = await hv('POST', '/tasks', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'listTimeEntries': {
                const params = new URLSearchParams();
                if (inputs.fromDate) params.set('from', String(inputs.fromDate));
                if (inputs.toDate) params.set('to', String(inputs.toDate));
                if (inputs.userId) params.set('user_id', String(inputs.userId));
                if (inputs.projectId) params.set('project_id', String(inputs.projectId));
                const data = await hv('GET', `/time_entries?${params.toString()}`);
                const entries = data.time_entries ?? [];
                return { output: { entries } };
            }

            case 'createTimeEntry': {
                const projectId = String(inputs.projectId ?? '').trim();
                const taskId = String(inputs.taskId ?? '').trim();
                const spentDate = String(inputs.spentDate ?? '').trim();
                const hours = inputs.hours;
                if (!projectId || !taskId || !spentDate || hours === undefined) {
                    throw new Error('projectId, taskId, spentDate, and hours are required.');
                }
                const body: Record<string, any> = {
                    project_id: Number(projectId),
                    task_id: Number(taskId),
                    spent_date: spentDate,
                    hours: Number(hours),
                };
                if (inputs.notes) body.notes = String(inputs.notes);
                const data = await hv('POST', '/time_entries', body);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        hours: String(data.hours ?? hours),
                    },
                };
            }

            case 'updateTimeEntry': {
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                const body: Record<string, any> = {};
                if (inputs.hours !== undefined) body.hours = Number(inputs.hours);
                if (inputs.notes !== undefined) body.notes = String(inputs.notes);
                const data = await hv('PATCH', `/time_entries/${entryId}`, body);
                return { output: { id: String(data.id ?? entryId) } };
            }

            case 'deleteTimeEntry': {
                const entryId = String(inputs.entryId ?? '').trim();
                if (!entryId) throw new Error('entryId is required.');
                await hv('DELETE', `/time_entries/${entryId}`);
                return { output: { deleted: true } };
            }

            case 'listClients': {
                const params = new URLSearchParams();
                if (inputs.isActive !== undefined) params.set('is_active', String(inputs.isActive));
                const data = await hv('GET', `/clients?${params.toString()}`);
                const clients = data.clients ?? [];
                return { output: { clients } };
            }

            case 'createClient': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = { name };
                if (inputs.currency) body.currency = String(inputs.currency);
                const data = await hv('POST', '/clients', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.clientId) params.set('client_id', String(inputs.clientId));
                if (inputs.state) params.set('state', String(inputs.state));
                const data = await hv('GET', `/invoices?${params.toString()}`);
                const invoices = data.invoices ?? [];
                return { output: { invoices } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await hv('GET', `/invoices/${invoiceId}`);
                return {
                    output: {
                        id: String(data.id ?? invoiceId),
                        amount: String(data.amount ?? ''),
                        state: data.state ?? '',
                    },
                };
            }

            default:
                return { error: `Harvest action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Harvest action failed.' };
    }
}
