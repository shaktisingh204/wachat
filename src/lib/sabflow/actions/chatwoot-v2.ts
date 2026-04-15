
'use server';

async function chatwootFetch(baseUrl: string, apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Chatwoot v2] ${method} ${path}`);
    const cleanBase = baseUrl.replace(/\/$/, '');
    const options: RequestInit = {
        method,
        headers: {
            api_access_token: apiToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${cleanBase}/api/v1${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Chatwoot API error: ${res.status}`);
    }
    return data;
}

export async function executeChatwootV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        const accountId = String(inputs.accountId ?? '').trim();
        if (!baseUrl) throw new Error('baseUrl is required.');
        if (!apiToken) throw new Error('apiToken is required.');
        if (!accountId) throw new Error('accountId is required.');
        const cw = (method: string, path: string, body?: any) => chatwootFetch(baseUrl, apiToken, method, `/accounts/${accountId}${path}`, body, logger);

        switch (actionName) {
            case 'createConversation': {
                const inboxId = Number(inputs.inboxId ?? 0);
                const contactId = Number(inputs.contactId ?? 0);
                if (!inboxId) throw new Error('inboxId is required.');
                const payload: any = { inbox_id: inboxId };
                if (contactId) payload.contact_id = contactId;
                if (inputs.message) payload.additional_attributes = { description: String(inputs.message) };
                if (inputs.assigneeId) payload.assignee_id = Number(inputs.assigneeId);
                if (inputs.teamId) payload.team_id = Number(inputs.teamId);
                if (inputs.status) payload.status = String(inputs.status);
                const data = await cw('POST', '/conversations', payload);
                return { output: { id: String(data.id ?? ''), status: data.status ?? '', inboxId: String(data.inbox_id ?? '') } };
            }

            case 'sendMessage': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                if (!content) throw new Error('content is required.');
                const payload: any = {
                    content,
                    message_type: inputs.messageType ?? 'outgoing',
                    private: inputs.private === true || inputs.private === 'true',
                };
                if (inputs.contentType) payload.content_type = String(inputs.contentType);
                const data = await cw('POST', `/conversations/${conversationId}/messages`, payload);
                return { output: { id: String(data.id ?? ''), content: data.content ?? content, createdAt: String(data.created_at ?? '') } };
            }

            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.assigneeType) params.set('assignee_type', String(inputs.assigneeType));
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await cw('GET', `/conversations${qs}`);
                const convs = data.data?.payload ?? data.payload ?? [];
                return { output: { count: String(convs.length), conversations: JSON.stringify(convs) } };
            }

            case 'assignConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const payload: any = {};
                if (inputs.assigneeId) payload.assignee_id = Number(inputs.assigneeId);
                if (inputs.teamId) payload.team_id = Number(inputs.teamId);
                const data = await cw('POST', `/conversations/${conversationId}/assignments`, payload);
                return { output: { assigneeId: String(data.id ?? inputs.assigneeId ?? ''), success: 'true' } };
            }

            case 'resolveConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await cw('PATCH', `/conversations/${conversationId}/toggle_status`, { status: 'resolved' });
                return { output: { status: data.current_status ?? 'resolved', conversationId } };
            }

            case 'createContact': {
                const name = String(inputs.name ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const phone = String(inputs.phone ?? '').trim();
                if (!name && !email && !phone) throw new Error('At least one of name, email, or phone is required.');
                const payload: any = {};
                if (name) payload.name = name;
                if (email) payload.email = email;
                if (phone) payload.phone_number = phone;
                if (inputs.inboxId) payload.inbox_id = Number(inputs.inboxId);
                const data = await cw('POST', '/contacts', payload);
                return { output: { id: String(data.id ?? ''), name: data.name ?? '', email: data.email ?? '' } };
            }

            case 'searchContacts': {
                const q = String(inputs.q ?? '').trim();
                if (!q) throw new Error('q (search query) is required.');
                const data = await cw('GET', `/contacts/search?q=${encodeURIComponent(q)}&include_contacts=true`);
                const contacts = data.payload ?? [];
                return { output: { count: String(contacts.length), contacts: JSON.stringify(contacts) } };
            }

            case 'getConversationMessages': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await cw('GET', `/conversations/${conversationId}/messages`);
                const msgs = data.payload ?? [];
                return { output: { count: String(msgs.length), messages: JSON.stringify(msgs) } };
            }

            default:
                return { error: `Chatwoot v2 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Chatwoot v2 action failed.' };
    }
}
