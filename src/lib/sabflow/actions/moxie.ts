'use server';

export async function executeMoxieAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { accessToken } = inputs;
        if (!accessToken) return { error: 'Moxie: accessToken is required.' };

        const baseUrl = 'https://api.moxieapp.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        async function apiGet(path: string): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.detail || JSON.stringify(data) || `Moxie error: ${res.status}`);
            return data;
        }

        async function apiPost(path: string, body: any): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.detail || JSON.stringify(data) || `Moxie error: ${res.status}`);
            return data;
        }

        async function apiPatch(path: string, body: any): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.detail || JSON.stringify(data) || `Moxie error: ${res.status}`);
            return data;
        }

        async function apiPut(path: string, body: any): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.detail || JSON.stringify(data) || `Moxie error: ${res.status}`);
            return data;
        }

        logger.log(`Executing Moxie action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'listProjects': {
                const { page = 1, perPage = 20, status } = inputs;
                let path = `/projects?page=${page}&per_page=${perPage}`;
                if (status) path += `&status=${status}`;
                const data = await apiGet(path);
                return { output: { projects: data.results ?? data, count: data.count } };
            }

            case 'getProject': {
                const { projectId } = inputs;
                if (!projectId) return { error: 'Moxie getProject: projectId is required.' };
                const data = await apiGet(`/projects/${projectId}`);
                return { output: { project: data } };
            }

            case 'createProject': {
                const { name, clientId, budget, description, status = 'active' } = inputs;
                if (!name) return { error: 'Moxie createProject: name is required.' };
                const body: any = { name, status };
                if (clientId) body.client = clientId;
                if (budget) body.budget = budget;
                if (description) body.description = description;
                const data = await apiPost('/projects', body);
                return { output: { projectId: data.id, project: data } };
            }

            case 'updateProject': {
                const { projectId, name, budget, status, description } = inputs;
                if (!projectId) return { error: 'Moxie updateProject: projectId is required.' };
                const body: any = {};
                if (name) body.name = name;
                if (budget !== undefined) body.budget = budget;
                if (status) body.status = status;
                if (description) body.description = description;
                const data = await apiPatch(`/projects/${projectId}`, body);
                return { output: { project: data } };
            }

            case 'listClients': {
                const { page = 1, perPage = 20 } = inputs;
                const data = await apiGet(`/clients?page=${page}&per_page=${perPage}`);
                return { output: { clients: data.results ?? data, count: data.count } };
            }

            case 'getClient': {
                const { clientId } = inputs;
                if (!clientId) return { error: 'Moxie getClient: clientId is required.' };
                const data = await apiGet(`/clients/${clientId}`);
                return { output: { client: data } };
            }

            case 'createClient': {
                const { name, email, phone, company } = inputs;
                if (!name) return { error: 'Moxie createClient: name is required.' };
                const body: any = { name };
                if (email) body.email = email;
                if (phone) body.phone = phone;
                if (company) body.company = company;
                const data = await apiPost('/clients', body);
                return { output: { clientId: data.id, client: data } };
            }

            case 'updateClient': {
                const { clientId, name, email, phone, company } = inputs;
                if (!clientId) return { error: 'Moxie updateClient: clientId is required.' };
                const body: any = {};
                if (name) body.name = name;
                if (email) body.email = email;
                if (phone) body.phone = phone;
                if (company) body.company = company;
                const data = await apiPatch(`/clients/${clientId}`, body);
                return { output: { client: data } };
            }

            case 'listInvoices': {
                const { page = 1, perPage = 20, status } = inputs;
                let path = `/invoices?page=${page}&per_page=${perPage}`;
                if (status) path += `&status=${status}`;
                const data = await apiGet(path);
                return { output: { invoices: data.results ?? data, count: data.count } };
            }

            case 'getInvoice': {
                const { invoiceId } = inputs;
                if (!invoiceId) return { error: 'Moxie getInvoice: invoiceId is required.' };
                const data = await apiGet(`/invoices/${invoiceId}`);
                return { output: { invoice: data } };
            }

            case 'createInvoice': {
                const { clientId, projectId, lineItems, dueDate, notes } = inputs;
                if (!clientId) return { error: 'Moxie createInvoice: clientId is required.' };
                const body: any = { client: clientId };
                if (projectId) body.project = projectId;
                if (lineItems) body.line_items = lineItems;
                if (dueDate) body.due_date = dueDate;
                if (notes) body.notes = notes;
                const data = await apiPost('/invoices', body);
                return { output: { invoiceId: data.id, invoice: data } };
            }

            case 'sendInvoice': {
                const { invoiceId, email } = inputs;
                if (!invoiceId) return { error: 'Moxie sendInvoice: invoiceId is required.' };
                const body: any = {};
                if (email) body.email = email;
                const data = await apiPost(`/invoices/${invoiceId}/send`, body);
                return { output: data };
            }

            case 'listProposals': {
                const { page = 1, perPage = 20, status } = inputs;
                let path = `/proposals?page=${page}&per_page=${perPage}`;
                if (status) path += `&status=${status}`;
                const data = await apiGet(path);
                return { output: { proposals: data.results ?? data, count: data.count } };
            }

            case 'getProposal': {
                const { proposalId } = inputs;
                if (!proposalId) return { error: 'Moxie getProposal: proposalId is required.' };
                const data = await apiGet(`/proposals/${proposalId}`);
                return { output: { proposal: data } };
            }

            case 'createProposal': {
                const { clientId, title, content, amount } = inputs;
                if (!clientId) return { error: 'Moxie createProposal: clientId is required.' };
                if (!title) return { error: 'Moxie createProposal: title is required.' };
                const body: any = { client: clientId, title };
                if (content) body.content = content;
                if (amount) body.amount = amount;
                const data = await apiPost('/proposals', body);
                return { output: { proposalId: data.id, proposal: data } };
            }

            case 'listTasks': {
                const { projectId, page = 1, perPage = 20, status } = inputs;
                let path = `/tasks?page=${page}&per_page=${perPage}`;
                if (projectId) path += `&project=${projectId}`;
                if (status) path += `&status=${status}`;
                const data = await apiGet(path);
                return { output: { tasks: data.results ?? data, count: data.count } };
            }

            case 'createTask': {
                const { projectId, title, dueDate, assignedTo, description } = inputs;
                if (!title) return { error: 'Moxie createTask: title is required.' };
                const body: any = { title };
                if (projectId) body.project = projectId;
                if (dueDate) body.due_date = dueDate;
                if (assignedTo) body.assigned_to = assignedTo;
                if (description) body.description = description;
                const data = await apiPost('/tasks', body);
                return { output: { taskId: data.id, task: data } };
            }

            case 'getTimeEntries': {
                const { projectId, page = 1, perPage = 20 } = inputs;
                let path = `/time-entries?page=${page}&per_page=${perPage}`;
                if (projectId) path += `&project=${projectId}`;
                const data = await apiGet(path);
                return { output: { timeEntries: data.results ?? data, count: data.count } };
            }

            case 'addTimeEntry': {
                const { projectId, taskId, duration, date, notes } = inputs;
                if (!duration) return { error: 'Moxie addTimeEntry: duration (in minutes) is required.' };
                const body: any = { duration };
                if (projectId) body.project = projectId;
                if (taskId) body.task = taskId;
                if (date) body.date = date;
                if (notes) body.notes = notes;
                const data = await apiPost('/time-entries', body);
                return { output: { entryId: data.id, timeEntry: data } };
            }

            default:
                return { error: `Moxie: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Moxie action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Moxie: An unexpected error occurred.' };
    }
}
