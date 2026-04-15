'use server';

export async function executeChatwootAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const { serverUrl, accessToken, accountId, ...params } = inputs;

    if (!serverUrl || !accessToken || !accountId) {
        return { error: 'serverUrl, accessToken, and accountId are required' };
    }

    const BASE = `${serverUrl}/api/v1/accounts/${accountId}`;

    async function req(method: string, path: string, body?: any, queryParams?: Record<string, string>) {
        let url = `${BASE}${path}`;
        if (queryParams) {
            const qs = new URLSearchParams(queryParams).toString();
            if (qs) url += `?${qs}`;
        }
        const res = await fetch(url, {
            method,
            headers: {
                'api_access_token': accessToken,
                'Content-Type': 'application/json',
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Chatwoot ${method} ${path} failed (${res.status}): ${text}`);
        }
        return res.json();
    }

    try {
        switch (actionName) {
            case 'listInboxes': {
                const data = await req('GET', '/inboxes');
                return { output: data };
            }
            case 'getInbox': {
                const { inboxId } = params;
                if (!inboxId) return { error: 'inboxId is required' };
                const data = await req('GET', `/inboxes/${inboxId}`);
                return { output: data };
            }
            case 'createInbox': {
                const { name, channel, ...rest } = params;
                if (!name) return { error: 'name is required' };
                const data = await req('POST', '/inboxes', { name, channel, ...rest });
                return { output: data };
            }
            case 'listContacts': {
                const { page } = params;
                const query: Record<string, string> = {};
                if (page) query.page = String(page);
                const data = await req('GET', '/contacts', undefined, query);
                return { output: data };
            }
            case 'getContact': {
                const { contactId } = params;
                if (!contactId) return { error: 'contactId is required' };
                const data = await req('GET', `/contacts/${contactId}`);
                return { output: data };
            }
            case 'createContact': {
                const { name, email, phone, ...rest } = params;
                if (!name) return { error: 'name is required' };
                const data = await req('POST', '/contacts', { name, email, phone_number: phone, ...rest });
                return { output: data };
            }
            case 'updateContact': {
                const { contactId, name, email, phone, ...rest } = params;
                if (!contactId) return { error: 'contactId is required' };
                const data = await req('PUT', `/contacts/${contactId}`, { name, email, phone_number: phone, ...rest });
                return { output: data };
            }
            case 'searchContacts': {
                const { query: q, page } = params;
                if (!q) return { error: 'query is required' };
                const qp: Record<string, string> = { q };
                if (page) qp.page = String(page);
                const data = await req('GET', '/contacts/search', undefined, qp);
                return { output: data };
            }
            case 'listConversations': {
                const { page, status } = params;
                const qp: Record<string, string> = {};
                if (page) qp.page = String(page);
                if (status) qp.status = status;
                const data = await req('GET', '/conversations', undefined, qp);
                return { output: data };
            }
            case 'getConversation': {
                const { conversationId } = params;
                if (!conversationId) return { error: 'conversationId is required' };
                const data = await req('GET', `/conversations/${conversationId}`);
                return { output: data };
            }
            case 'createConversation': {
                const { inboxId, contactId, ...rest } = params;
                if (!inboxId || !contactId) return { error: 'inboxId and contactId are required' };
                const data = await req('POST', '/conversations', { inbox_id: inboxId, contact_id: contactId, ...rest });
                return { output: data };
            }
            case 'listMessages': {
                const { conversationId } = params;
                if (!conversationId) return { error: 'conversationId is required' };
                const data = await req('GET', `/conversations/${conversationId}/messages`);
                return { output: data };
            }
            case 'sendMessage': {
                const { conversationId, content, messageType, ...rest } = params;
                if (!conversationId || !content) return { error: 'conversationId and content are required' };
                const data = await req('POST', `/conversations/${conversationId}/messages`, {
                    content,
                    message_type: messageType || 'outgoing',
                    ...rest,
                });
                return { output: data };
            }
            case 'assignConversation': {
                const { conversationId, assigneeId, teamId } = params;
                if (!conversationId) return { error: 'conversationId is required' };
                const data = await req('POST', `/conversations/${conversationId}/assignments`, {
                    assignee_id: assigneeId,
                    team_id: teamId,
                });
                return { output: data };
            }
            case 'resolveConversation': {
                const { conversationId } = params;
                if (!conversationId) return { error: 'conversationId is required' };
                const data = await req('PATCH', `/conversations/${conversationId}/toggle_status`, { status: 'resolved' });
                return { output: data };
            }
            case 'toggleStatus': {
                const { conversationId, status } = params;
                if (!conversationId || !status) return { error: 'conversationId and status are required' };
                const data = await req('PATCH', `/conversations/${conversationId}/toggle_status`, { status });
                return { output: data };
            }
            case 'listLabels': {
                const data = await req('GET', '/labels');
                return { output: data };
            }
            case 'listAgents': {
                const data = await req('GET', '/agents');
                return { output: data };
            }
            default:
                return { error: `Unknown Chatwoot action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Chatwoot action error: ${err.message}`);
        return { error: err.message };
    }
}
