
'use server';

async function zendeskFetch(subdomain: string, email: string, apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Zendesk] ${method} ${path}`);
    const base64Auth = Buffer.from(`${email}/token:${apiToken}`).toString('base64');
    const url = `https://${subdomain}.zendesk.com/api/v2${path}`;
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
        throw new Error(data?.description || data?.error || `Zendesk API error: ${res.status}`);
    }
    return data;
}

export async function executeZendeskAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const subdomain = String(inputs.subdomain ?? '').trim().replace(/\.zendesk\.com.*/, '');
        const email = String(inputs.email ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!subdomain || !email || !apiToken) throw new Error('subdomain, email, and apiToken are required.');
        const zd = (method: string, path: string, body?: any) => zendeskFetch(subdomain, email, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'createTicket': {
                const subject = String(inputs.subject ?? '').trim();
                const comment = String(inputs.comment ?? '').trim();
                const requesterEmail = String(inputs.requesterEmail ?? '').trim();
                const priority = String(inputs.priority ?? 'normal').trim();
                if (!subject || !comment) throw new Error('subject and comment are required.');
                const body: any = { ticket: { subject, comment: { body: comment }, priority } };
                if (requesterEmail) body.ticket.requester = { email: requesterEmail };
                const data = await zd('POST', '/tickets.json', body);
                return { output: { id: String(data.ticket?.id ?? ''), subject: data.ticket?.subject ?? '', status: data.ticket?.status ?? '' } };
            }

            case 'getTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}.json`);
                return { output: { id: String(data.ticket?.id ?? ''), subject: data.ticket?.subject ?? '', status: data.ticket?.status ?? '', priority: data.ticket?.priority ?? '' } };
            }

            case 'updateTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const ticket: any = {};
                if (inputs.status) ticket.status = String(inputs.status);
                if (inputs.priority) ticket.priority = String(inputs.priority);
                if (inputs.subject) ticket.subject = String(inputs.subject);
                if (inputs.comment) ticket.comment = { body: String(inputs.comment) };
                if (inputs.assigneeId) ticket.assignee_id = Number(inputs.assigneeId);
                const data = await zd('PUT', `/tickets/${ticketId}.json`, { ticket });
                return { output: { id: String(data.ticket?.id ?? ticketId), status: data.ticket?.status ?? '' } };
            }

            case 'deleteTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                await zd('DELETE', `/tickets/${ticketId}.json`);
                return { output: { deleted: 'true' } };
            }

            case 'addComment': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const isPublic = !(inputs.isPublic === false || inputs.isPublic === 'false');
                if (!ticketId || !body) throw new Error('ticketId and body are required.');
                const data = await zd('PUT', `/tickets/${ticketId}.json`, { ticket: { comment: { body, public: isPublic } } });
                return { output: { id: String(data.ticket?.id ?? ticketId) } };
            }

            case 'listTickets': {
                const sortBy = String(inputs.sortBy ?? 'created_at').trim();
                const perPage = Number(inputs.perPage ?? 25);
                const data = await zd('GET', `/tickets.json?sort_by=${sortBy}&per_page=${perPage}`);
                return { output: { tickets: data.tickets ?? [], count: data.count ?? 0 } };
            }

            case 'searchTickets': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const data = await zd('GET', `/search.json?query=${encodeURIComponent(query)}&type=ticket`);
                return { output: { tickets: data.results ?? [], total: String(data.count ?? 0) } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await zd('GET', `/users/${userId}.json`);
                return { output: { id: String(data.user?.id ?? ''), name: data.user?.name ?? '', email: data.user?.email ?? '', role: data.user?.role ?? '' } };
            }

            case 'createUser': {
                const name = String(inputs.name ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const role = String(inputs.role ?? 'end-user').trim();
                if (!name || !email) throw new Error('name and email are required.');
                const data = await zd('POST', '/users.json', { user: { name, email, role } });
                return { output: { id: String(data.user?.id ?? ''), name: data.user?.name ?? '', email: data.user?.email ?? '' } };
            }

            case 'listUsers': {
                const data = await zd('GET', '/users.json');
                return { output: { users: data.users ?? [], count: data.count ?? 0 } };
            }

            case 'getMacros': {
                const data = await zd('GET', '/macros.json');
                return { output: { macros: data.macros ?? [], count: data.count ?? 0 } };
            }

            default:
                return { error: `Zendesk action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Zendesk action failed.' };
    }
}
