'use server';

export async function executeHarvestEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const base = 'https://api.harvestapp.com/v2';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inputs.accessToken}`,
        'Harvest-Account-Id': String(inputs.accountId),
        'User-Agent': 'SabFlow/1.0',
    };

    try {
        switch (actionName) {
            case 'listTimeEntries': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.userId) params.set('user_id', String(inputs.userId));
                if (inputs.projectId) params.set('project_id', String(inputs.projectId));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${base}/time_entries?${params}`, { headers });
                const data = await res.json();
                return { output: { timeEntries: data.time_entries ?? [], totalPages: data.total_pages, totalEntries: data.total_entries } };
            }
            case 'getTimeEntry': {
                const res = await fetch(`${base}/time_entries/${inputs.timeEntryId}`, { headers });
                const data = await res.json();
                return { output: { timeEntry: data } };
            }
            case 'createTimeEntry': {
                const body: any = { project_id: inputs.projectId, task_id: inputs.taskId, spent_date: inputs.spentDate };
                if (inputs.hours !== undefined) body.hours = inputs.hours;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.userId) body.user_id = inputs.userId;
                const res = await fetch(`${base}/time_entries`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { timeEntry: data } };
            }
            case 'updateTimeEntry': {
                const body: any = {};
                if (inputs.hours !== undefined) body.hours = inputs.hours;
                if (inputs.notes !== undefined) body.notes = inputs.notes;
                if (inputs.spentDate) body.spent_date = inputs.spentDate;
                if (inputs.projectId) body.project_id = inputs.projectId;
                if (inputs.taskId) body.task_id = inputs.taskId;
                const res = await fetch(`${base}/time_entries/${inputs.timeEntryId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { timeEntry: data } };
            }
            case 'deleteTimeEntry': {
                const res = await fetch(`${base}/time_entries/${inputs.timeEntryId}`, { method: 'DELETE', headers });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'restartTimeEntry': {
                const res = await fetch(`${base}/time_entries/${inputs.timeEntryId}/restart`, { method: 'PATCH', headers });
                const data = await res.json();
                return { output: { timeEntry: data } };
            }
            case 'stopTimeEntry': {
                const res = await fetch(`${base}/time_entries/${inputs.timeEntryId}/stop`, { method: 'PATCH', headers });
                const data = await res.json();
                return { output: { timeEntry: data } };
            }
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.clientId) params.set('client_id', String(inputs.clientId));
                if (inputs.isActive !== undefined) params.set('is_active', String(inputs.isActive));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${base}/projects?${params}`, { headers });
                const data = await res.json();
                return { output: { projects: data.projects ?? [], totalPages: data.total_pages } };
            }
            case 'getProject': {
                const res = await fetch(`${base}/projects/${inputs.projectId}`, { headers });
                const data = await res.json();
                return { output: { project: data } };
            }
            case 'createProject': {
                const body: any = { client_id: inputs.clientId, name: inputs.name, is_billable: inputs.isBillable ?? false, bill_by: inputs.billBy ?? 'none', budget_by: inputs.budgetBy ?? 'none' };
                if (inputs.code) body.code = inputs.code;
                if (inputs.notes) body.notes = inputs.notes;
                const res = await fetch(`${base}/projects`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { project: data } };
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.isActive !== undefined) params.set('is_active', String(inputs.isActive));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${base}/tasks?${params}`, { headers });
                const data = await res.json();
                return { output: { tasks: data.tasks ?? [], totalPages: data.total_pages } };
            }
            case 'createTask': {
                const body: any = { name: inputs.name };
                if (inputs.billableByDefault !== undefined) body.billable_by_default = inputs.billableByDefault;
                if (inputs.defaultHourlyRate !== undefined) body.default_hourly_rate = inputs.defaultHourlyRate;
                if (inputs.isDefault !== undefined) body.is_default = inputs.isDefault;
                const res = await fetch(`${base}/tasks`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { task: data } };
            }
            case 'listClients': {
                const params = new URLSearchParams();
                if (inputs.isActive !== undefined) params.set('is_active', String(inputs.isActive));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${base}/clients?${params}`, { headers });
                const data = await res.json();
                return { output: { clients: data.clients ?? [], totalPages: data.total_pages } };
            }
            case 'createClient': {
                const body: any = { name: inputs.name };
                if (inputs.currency) body.currency = inputs.currency;
                if (inputs.address) body.address = inputs.address;
                const res = await fetch(`${base}/clients`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { client: data } };
            }
            case 'getInvoices': {
                const params = new URLSearchParams();
                if (inputs.clientId) params.set('client_id', String(inputs.clientId));
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${base}/invoices?${params}`, { headers });
                const data = await res.json();
                return { output: { invoices: data.invoices ?? [], totalPages: data.total_pages } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`HarvestEnhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
