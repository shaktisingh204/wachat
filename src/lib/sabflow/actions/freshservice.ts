'use server';

async function freshserviceFetch(
    subdomain: string,
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Freshservice] ${method} ${path}`);
    const base64Auth = Buffer.from(`${apiKey}:X`).toString('base64');
    const url = `https://${subdomain}.freshservice.com/api/v2${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.description || data?.message || `Freshservice API error: ${res.status}`);
    }
    return data;
}

export async function executeFreshserviceAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const subdomain = String(inputs.subdomain ?? '').trim().replace(/\.freshservice\.com.*/, '');
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!subdomain) throw new Error('subdomain is required.');
        if (!apiKey) throw new Error('apiKey is required.');

        const fs = (method: string, path: string, body?: any) =>
            freshserviceFetch(subdomain, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createTicket': {
                const subject = String(inputs.subject ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!subject || !description || !email) throw new Error('subject, description, and email are required.');
                const priority = Number(inputs.priority ?? 1);
                const status = Number(inputs.status ?? 2);
                const data = await fs('POST', '/tickets', { subject, description, email, priority, status });
                const ticket = data.ticket ?? data;
                return { output: { id: String(ticket.id ?? ''), ticketNumber: String(ticket.id ?? '') } };
            }

            case 'getTicket': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await fs('GET', `/tickets/${id}`);
                const ticket = data.ticket ?? data;
                return {
                    output: {
                        id: String(ticket.id ?? ''),
                        subject: ticket.subject ?? '',
                        status: String(ticket.status ?? ''),
                        priority: String(ticket.priority ?? ''),
                        description: ticket.description ?? '',
                    },
                };
            }

            case 'updateTicket': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: Record<string, any> = {};
                if (inputs.subject !== undefined) body.subject = String(inputs.subject);
                if (inputs.description !== undefined) body.description = String(inputs.description);
                if (inputs.priority !== undefined) body.priority = Number(inputs.priority);
                if (inputs.status !== undefined) body.status = Number(inputs.status);
                const data = await fs('PUT', `/tickets/${id}`, body);
                const ticket = data.ticket ?? data;
                return { output: { id: String(ticket.id ?? id) } };
            }

            case 'deleteTicket': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await fs('DELETE', `/tickets/${id}`);
                return { output: { deleted: true } };
            }

            case 'listTickets': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 30);
                const data = await fs('GET', `/tickets?page=${page}&per_page=${perPage}`);
                const tickets = data.tickets ?? (Array.isArray(data) ? data : []);
                return { output: { tickets } };
            }

            case 'createAgent': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const roleId = inputs.roleId;
                if (!firstName || !lastName || !email || !roleId) throw new Error('firstName, lastName, email, and roleId are required.');
                const data = await fs('POST', '/agents', {
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    roles: [{ role_id: Number(roleId), assignment_scope: 'entire_helpdesk' }],
                });
                const agent = data.agent ?? data;
                return { output: { id: String(agent.id ?? ''), email: agent.email ?? email } };
            }

            case 'listAgents': {
                const data = await fs('GET', '/agents');
                const agents = data.agents ?? (Array.isArray(data) ? data : []);
                return { output: { agents } };
            }

            case 'createAsset': {
                const name = String(inputs.name ?? '').trim();
                const assetTypeId = inputs.assetTypeId;
                if (!name || !assetTypeId) throw new Error('name and assetTypeId are required.');
                const data = await fs('POST', '/assets', {
                    asset: { name, asset_type_id: Number(assetTypeId) },
                });
                const asset = data.asset ?? data;
                return { output: { id: String(asset.id ?? ''), name: asset.name ?? name } };
            }

            case 'listAssets': {
                const page = Number(inputs.page ?? 1);
                const data = await fs('GET', `/assets?page=${page}`);
                const assets = data.assets ?? (Array.isArray(data) ? data : []);
                return { output: { assets } };
            }

            case 'createChange': {
                const subject = String(inputs.subject ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!subject || !description) throw new Error('subject and description are required.');
                const body: Record<string, any> = {
                    subject,
                    description,
                    priority: Number(inputs.priority ?? 1),
                };
                if (inputs.changeType !== undefined) body.change_type = Number(inputs.changeType);
                const data = await fs('POST', '/changes', body);
                const change = data.change ?? data;
                return { output: { id: String(change.id ?? '') } };
            }

            case 'listChanges': {
                const page = Number(inputs.page ?? 1);
                const data = await fs('GET', `/changes?page=${page}`);
                const changes = data.changes ?? (Array.isArray(data) ? data : []);
                return { output: { changes } };
            }

            case 'createProblem': {
                const subject = String(inputs.subject ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!subject || !description) throw new Error('subject and description are required.');
                const data = await fs('POST', '/problems', {
                    subject,
                    description,
                    priority: Number(inputs.priority ?? 1),
                });
                const problem = data.problem ?? data;
                return { output: { id: String(problem.id ?? '') } };
            }

            case 'listProblems': {
                const page = Number(inputs.page ?? 1);
                const data = await fs('GET', `/problems?page=${page}`);
                const problems = data.problems ?? (Array.isArray(data) ? data : []);
                return { output: { problems } };
            }

            default:
                return { error: `Freshservice action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Freshservice action failed.' };
    }
}
