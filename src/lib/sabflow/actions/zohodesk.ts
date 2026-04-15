'use server';

async function zohoDeskFetch(accessToken: string, orgId: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[ZohoDesk] ${method} ${path}`);
    const url = `https://desk.zoho.com/api/v1${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            orgId: orgId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.errorMessage || `Zoho Desk API error: ${res.status}`);
    }
    return data;
}

export async function executeZohoDeskAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const orgId = String(inputs.orgId ?? '').trim();
        if (!accessToken || !orgId) throw new Error('accessToken and orgId are required.');

        const zd = (method: string, path: string, body?: any) => zohoDeskFetch(accessToken, orgId, method, path, body, logger);

        switch (actionName) {
            case 'listTickets': {
                const limit = Number(inputs.limit ?? 50);
                const from = Number(inputs.from ?? 1);
                const data = await zd('GET', `/tickets?limit=${limit}&from=${from}`);
                return { output: { tickets: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'getTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}`);
                return { output: { ticket: data } };
            }

            case 'createTicket': {
                const subject = String(inputs.subject ?? '').trim();
                const departmentId = String(inputs.departmentId ?? '').trim();
                if (!subject || !departmentId) throw new Error('subject and departmentId are required.');
                const body: any = { subject, departmentId };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.contactId) body.contactId = String(inputs.contactId);
                if (inputs.priority) body.priority = String(inputs.priority);
                if (inputs.status) body.status = String(inputs.status);
                const data = await zd('POST', '/tickets', body);
                return { output: { ticket: data } };
            }

            case 'updateTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const body: any = {};
                if (inputs.subject) body.subject = String(inputs.subject);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.priority) body.priority = String(inputs.priority);
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.assigneeId) body.assigneeId = String(inputs.assigneeId);
                const data = await zd('PATCH', `/tickets/${ticketId}`, body);
                return { output: { ticket: data } };
            }

            case 'deleteTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                await zd('DELETE', `/tickets/${ticketId}`);
                return { output: { deleted: 'true', ticketId } };
            }

            case 'addComment': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!ticketId || !content) throw new Error('ticketId and content are required.');
                const isPublic = inputs.isPublic !== false;
                const data = await zd('POST', `/tickets/${ticketId}/comments`, { content, isPublic });
                return { output: { comment: data } };
            }

            case 'listComments': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}/comments`);
                return { output: { comments: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'listContacts': {
                const limit = Number(inputs.limit ?? 50);
                const data = await zd('GET', `/contacts?limit=${limit}`);
                return { output: { contacts: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await zd('GET', `/contacts/${contactId}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!lastName) throw new Error('lastName is required.');
                const body: any = { lastName };
                if (email) body.email = email;
                if (inputs.firstName) body.firstName = String(inputs.firstName);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await zd('POST', '/contacts', body);
                return { output: { contact: data } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.firstName) body.firstName = String(inputs.firstName);
                if (inputs.lastName) body.lastName = String(inputs.lastName);
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await zd('PATCH', `/contacts/${contactId}`, body);
                return { output: { contact: data } };
            }

            case 'listAccounts': {
                const limit = Number(inputs.limit ?? 50);
                const data = await zd('GET', `/accounts?limit=${limit}`);
                return { output: { accounts: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'createAccount': {
                const accountName = String(inputs.accountName ?? '').trim();
                if (!accountName) throw new Error('accountName is required.');
                const body: any = { accountName };
                if (inputs.website) body.website = String(inputs.website);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await zd('POST', '/accounts', body);
                return { output: { account: data } };
            }

            case 'listAgents': {
                const limit = Number(inputs.limit ?? 50);
                const data = await zd('GET', `/agents?limit=${limit}`);
                return { output: { agents: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'getAgent': {
                const agentId = String(inputs.agentId ?? '').trim();
                if (!agentId) throw new Error('agentId is required.');
                const data = await zd('GET', `/agents/${agentId}`);
                return { output: { agent: data } };
            }

            case 'listDepartments': {
                const data = await zd('GET', '/departments');
                return { output: { departments: data.data ?? [], count: (data.data ?? []).length } };
            }

            case 'sendTicketReply': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!ticketId || !content) throw new Error('ticketId and content are required.');
                const body: any = { content };
                if (inputs.fromEmailAddress) body.fromEmailAddress = String(inputs.fromEmailAddress);
                const data = await zd('POST', `/tickets/${ticketId}/sendReply`, body);
                return { output: { reply: data } };
            }

            case 'resolveTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('PATCH', `/tickets/${ticketId}`, { status: 'Closed' });
                return { output: { ticket: data } };
            }

            default:
                return { error: `Zoho Desk action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Zoho Desk action failed.' };
    }
}
