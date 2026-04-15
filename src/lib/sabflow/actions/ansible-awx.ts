'use server';

export async function executeAnsibleAwxAction(actionName: string, inputs: any, user: any, logger: any) {
    const token = inputs.token;
    const baseUrl = (inputs.awxUrl ?? 'https://awx.example.com/api/v2').replace(/\/$/, '');

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listInventories': {
                const { page = 1, pageSize = 25, search } = inputs;
                const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
                if (search) params.set('search', search);
                const res = await fetch(`${baseUrl}/inventories/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { inventories: data.results, count: data.count, next: data.next, previous: data.previous } };
            }

            case 'getInventory': {
                const { inventoryId } = inputs;
                const res = await fetch(`${baseUrl}/inventories/${inventoryId}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { inventory: data } };
            }

            case 'createInventory': {
                const { name, description, organization, variables, kind = '' } = inputs;
                const body: any = { name, organization };
                if (description) body.description = description;
                if (variables) body.variables = typeof variables === 'string' ? variables : JSON.stringify(variables);
                if (kind) body.kind = kind;
                const res = await fetch(`${baseUrl}/inventories/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? JSON.stringify(data) };
                return { output: { inventory: data } };
            }

            case 'updateInventory': {
                const { inventoryId, name, description, variables } = inputs;
                const body: any = {};
                if (name !== undefined) body.name = name;
                if (description !== undefined) body.description = description;
                if (variables !== undefined) body.variables = typeof variables === 'string' ? variables : JSON.stringify(variables);
                const res = await fetch(`${baseUrl}/inventories/${inventoryId}/`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? JSON.stringify(data) };
                return { output: { inventory: data } };
            }

            case 'deleteInventory': {
                const { inventoryId } = inputs;
                const res = await fetch(`${baseUrl}/inventories/${inventoryId}/`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, inventoryId } };
                const data = await res.json();
                return { error: data?.detail ?? `HTTP ${res.status}` };
            }

            case 'listHosts': {
                const { inventoryId, page = 1, pageSize = 25, search } = inputs;
                const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
                if (search) params.set('search', search);
                const endpoint = inventoryId
                    ? `${baseUrl}/inventories/${inventoryId}/hosts/?${params.toString()}`
                    : `${baseUrl}/hosts/?${params.toString()}`;
                const res = await fetch(endpoint, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { hosts: data.results, count: data.count } };
            }

            case 'createHost': {
                const { name, description, inventory, variables, enabled = true } = inputs;
                const body: any = { name, inventory, enabled };
                if (description) body.description = description;
                if (variables) body.variables = typeof variables === 'string' ? variables : JSON.stringify(variables);
                const res = await fetch(`${baseUrl}/hosts/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? JSON.stringify(data) };
                return { output: { host: data } };
            }

            case 'listJobTemplates': {
                const { page = 1, pageSize = 25, search } = inputs;
                const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
                if (search) params.set('search', search);
                const res = await fetch(`${baseUrl}/job_templates/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { jobTemplates: data.results, count: data.count } };
            }

            case 'getJobTemplate': {
                const { templateId } = inputs;
                const res = await fetch(`${baseUrl}/job_templates/${templateId}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { jobTemplate: data } };
            }

            case 'launchJob': {
                const { templateId, extraVars, limit, inventory, credentials, tags } = inputs;
                const body: any = {};
                if (extraVars !== undefined) body.extra_vars = typeof extraVars === 'string' ? extraVars : JSON.stringify(extraVars);
                if (limit !== undefined) body.limit = limit;
                if (inventory !== undefined) body.inventory = inventory;
                if (credentials !== undefined) body.credentials = credentials;
                if (tags !== undefined) body.job_tags = tags;
                const res = await fetch(`${baseUrl}/job_templates/${templateId}/launch/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? JSON.stringify(data) };
                return { output: { job: data } };
            }

            case 'getJob': {
                const { jobId } = inputs;
                const res = await fetch(`${baseUrl}/jobs/${jobId}/`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { job: data } };
            }

            case 'cancelJob': {
                const { jobId } = inputs;
                const res = await fetch(`${baseUrl}/jobs/${jobId}/cancel/`, { method: 'POST', headers });
                if (res.status === 202) return { output: { cancelled: true, jobId } };
                if (res.status === 204) return { output: { cancelled: true, jobId } };
                const data = await res.json();
                return { error: data?.detail ?? `HTTP ${res.status}` };
            }

            case 'listJobs': {
                const { page = 1, pageSize = 25, status, templateId } = inputs;
                const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
                if (status) params.set('status', status);
                if (templateId) params.set('job_template', String(templateId));
                const res = await fetch(`${baseUrl}/jobs/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { jobs: data.results, count: data.count } };
            }

            case 'listProjects': {
                const { page = 1, pageSize = 25, search } = inputs;
                const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
                if (search) params.set('search', search);
                const res = await fetch(`${baseUrl}/projects/?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { projects: data.results, count: data.count } };
            }

            case 'syncProject': {
                const { projectId } = inputs;
                const res = await fetch(`${baseUrl}/projects/${projectId}/update/`, { method: 'POST', headers });
                if (res.status === 202) return { output: { syncing: true, projectId } };
                const data = await res.json();
                if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` };
                return { output: { result: data } };
            }

            default:
                return { error: `Unknown Ansible AWX action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`AnsibleAWX action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Ansible AWX action' };
    }
}
