
'use server';

async function freshdeskFetch(domain: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Freshdesk] ${method} ${path}`);
    const base64Auth = Buffer.from(`${apiKey}:X`).toString('base64');
    const url = `https://${domain}.freshdesk.com/api/v2${path}`;
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
        throw new Error(data?.description || data?.message || `Freshdesk API error: ${res.status}`);
    }
    return data;
}

export async function executeFreshdeskAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const domain = String(inputs.domain ?? '').trim().replace(/\.freshdesk\.com.*/, '');
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!domain || !apiKey) throw new Error('domain and apiKey are required.');
        const fd = (method: string, path: string, body?: any) => freshdeskFetch(domain, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createTicket': {
                const subject = String(inputs.subject ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const priority = Number(inputs.priority ?? 1);
                const status = Number(inputs.status ?? 2);
                if (!subject || !description || !email) throw new Error('subject, description, and email are required.');
                const data = await fd('POST', '/tickets', { subject, description, email, priority, status });
                return { output: { id: String(data.id), subject: data.subject, status: String(data.status), priority: String(data.priority) } };
            }

            case 'getTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await fd('GET', `/tickets/${ticketId}`);
                return { output: { id: String(data.id), subject: data.subject, status: String(data.status), priority: String(data.priority), requesterEmail: data.requester?.email ?? '' } };
            }

            case 'updateTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const body: any = {};
                if (inputs.status !== undefined) body.status = Number(inputs.status);
                if (inputs.priority !== undefined) body.priority = Number(inputs.priority);
                if (inputs.subject) body.subject = String(inputs.subject);
                if (inputs.assigneeId) body.responder_id = Number(inputs.assigneeId);
                const data = await fd('PUT', `/tickets/${ticketId}`, body);
                return { output: { id: String(data.id), status: String(data.status), priority: String(data.priority) } };
            }

            case 'deleteTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                await fd('DELETE', `/tickets/${ticketId}`);
                return { output: { deleted: 'true' } };
            }

            case 'listTickets': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 30);
                const data = await fd('GET', `/tickets?page=${page}&per_page=${perPage}`);
                return { output: { tickets: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'addNote': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const isPrivate = inputs.isPrivate === true || inputs.isPrivate === 'true';
                if (!ticketId || !body) throw new Error('ticketId and body are required.');
                const data = await fd('POST', `/tickets/${ticketId}/notes`, { body, private: isPrivate });
                return { output: { id: String(data.id), private: String(data.private) } };
            }

            case 'addReply': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!ticketId || !body) throw new Error('ticketId and body are required.');
                const data = await fd('POST', `/tickets/${ticketId}/reply`, { body });
                return { output: { id: String(data.id) } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await fd('GET', `/contacts/${contactId}`);
                return { output: { id: String(data.id), name: data.name, email: data.email, phone: data.phone ?? '', companyId: String(data.company_id ?? '') } };
            }

            case 'createContact': {
                const name = String(inputs.name ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const phone = String(inputs.phone ?? '').trim();
                if (!name || !email) throw new Error('name and email are required.');
                const body: any = { name, email };
                if (phone) body.phone = phone;
                const data = await fd('POST', '/contacts', body);
                return { output: { id: String(data.id), name: data.name, email: data.email } };
            }

            case 'searchTickets': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const data = await fd('GET', `/search/tickets?query="${encodeURIComponent(query)}"`);
                return { output: { tickets: data.results ?? [], total: String(data.total ?? 0) } };
            }

            case 'listAgents': {
                const data = await fd('GET', '/agents');
                return { output: { agents: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getSatisfactionRating': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await fd('GET', `/tickets/${ticketId}/satisfaction_ratings`);
                return { output: { ratings: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Freshdesk action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Freshdesk action failed.' };
    }
}
