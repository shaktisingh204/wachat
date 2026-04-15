
'use server';

async function trengoFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Trengo] ${method} ${path}`);
    const url = `https://app.trengo.com/api/v2${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Trengo API error: ${res.status}`);
    }
    return data;
}

export async function executeTrengoAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const t = (method: string, path: string, body?: any) => trengoFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listChannels': {
                const data = await t('GET', '/channels');
                return { output: { channels: data.data ?? data, count: (data.data ?? data).length } };
            }

            case 'listContacts': {
                const page = Number(inputs.page ?? 1);
                const term = inputs.term ? `&term=${encodeURIComponent(String(inputs.term))}` : '';
                const data = await t('GET', `/contacts?page=${page}${term}`);
                return { output: { contacts: data.data ?? data, total: data.total ?? (data.data ?? data).length } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await t('GET', `/contacts/${contactId}`);
                return { output: { id: String(data.id), name: data.name, email: data.email ?? '', phone: data.phone ?? '' } };
            }

            case 'createContact': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.email) body.email = String(inputs.email).trim();
                if (inputs.phone) body.phone = String(inputs.phone).trim();
                const data = await t('POST', '/contacts', body);
                return { output: { id: String(data.id), name: data.name } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await t('PUT', `/contacts/${contactId}`, body);
                return { output: { id: String(data.id), name: data.name } };
            }

            case 'listConversations': {
                const page = Number(inputs.page ?? 1);
                const status = inputs.status ? `&status=${inputs.status}` : '';
                const data = await t('GET', `/tickets?page=${page}${status}`);
                return { output: { conversations: data.data ?? data, total: data.total ?? (data.data ?? data).length } };
            }

            case 'getConversation': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await t('GET', `/tickets/${ticketId}`);
                return { output: { id: String(data.id), status: data.status, channelId: String(data.channel_id ?? ''), assigneeId: String(data.assignee_id ?? '') } };
            }

            case 'createConversation': {
                const channelId = String(inputs.channelId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!channelId || !contactId) throw new Error('channelId and contactId are required.');
                const body: any = { channel_id: Number(channelId), contact_id: Number(contactId) };
                if (inputs.subject) body.subject = String(inputs.subject);
                const data = await t('POST', '/tickets', body);
                return { output: { id: String(data.id), status: data.status } };
            }

            case 'sendMessage': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!ticketId || !message) throw new Error('ticketId and message are required.');
                const data = await t('POST', `/tickets/${ticketId}/messages`, { message, type: inputs.type ?? 'text' });
                return { output: { id: String(data.id), status: data.status ?? 'sent' } };
            }

            case 'sendFile': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!ticketId || !fileUrl) throw new Error('ticketId and fileUrl are required.');
                const data = await t('POST', `/tickets/${ticketId}/messages`, { message: fileUrl, type: 'image' });
                return { output: { id: String(data.id), status: data.status ?? 'sent' } };
            }

            case 'assignConversation': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const agentId = String(inputs.agentId ?? '').trim();
                if (!ticketId || !agentId) throw new Error('ticketId and agentId are required.');
                const data = await t('PUT', `/tickets/${ticketId}`, { assignee_id: Number(agentId) });
                return { output: { id: String(data.id), assigneeId: String(data.assignee_id ?? agentId) } };
            }

            case 'closeConversation': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await t('PUT', `/tickets/${ticketId}/close`, {});
                return { output: { id: String(data.id ?? ticketId), status: data.status ?? 'closed' } };
            }

            case 'reopenConversation': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await t('PUT', `/tickets/${ticketId}/reopen`, {});
                return { output: { id: String(data.id ?? ticketId), status: data.status ?? 'open' } };
            }

            case 'addLabel': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const labelId = String(inputs.labelId ?? '').trim();
                if (!ticketId || !labelId) throw new Error('ticketId and labelId are required.');
                await t('POST', `/tickets/${ticketId}/labels`, { label_id: Number(labelId) });
                return { output: { ticketId, labelId, added: 'true' } };
            }

            case 'listLabels': {
                const data = await t('GET', '/labels');
                return { output: { labels: data.data ?? data, count: (data.data ?? data).length } };
            }

            case 'listTeams': {
                const data = await t('GET', '/teams');
                return { output: { teams: data.data ?? data, count: (data.data ?? data).length } };
            }

            case 'listAgents': {
                const data = await t('GET', '/users');
                return { output: { agents: data.data ?? data, count: (data.data ?? data).length } };
            }

            case 'getTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await t('GET', `/tickets/${ticketId}`);
                return { output: { id: String(data.id), status: data.status, subject: data.subject ?? '', channelId: String(data.channel_id ?? '') } };
            }

            default:
                return { error: `Trengo action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Trengo action failed.' };
    }
}
