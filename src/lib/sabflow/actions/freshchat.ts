
'use server';

const FRESHCHAT_BASE = 'https://api.freshchat.com/v2';

async function freshchatFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Freshchat] ${method} ${path}`);
    const url = `${FRESHCHAT_BASE}${path}`;
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
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || data?.error_message || `Freshchat API error: ${res.status}`);
    }
    return data;
}

export async function executeFreshChatAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const ff = (method: string, path: string, body?: any) => freshchatFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listConversations': {
                const page = Number(inputs.page ?? 1);
                const itemsPerPage = Number(inputs.itemsPerPage ?? 25);
                const data = await ff('GET', `/conversations?page=${page}&items_per_page=${itemsPerPage}`);
                return { output: { conversations: data.conversations ?? data.items ?? [], pagination: data.pagination } };
            }

            case 'getConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await ff('GET', `/conversations/${conversationId}`);
                return { output: data };
            }

            case 'createConversation': {
                const channelId = String(inputs.channelId ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                const body: any = { channel_id: channelId };
                if (inputs.users) body.users = inputs.users;
                if (inputs.messages) body.messages = inputs.messages;
                if (inputs.status) body.status = String(inputs.status);
                const data = await ff('POST', '/conversations', body);
                return { output: data };
            }

            case 'updateConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const body: any = {};
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.assignedAgentId) body.assigned_agent_id = String(inputs.assignedAgentId);
                if (inputs.assignedGroupId) body.assigned_group_id = String(inputs.assignedGroupId);
                const data = await ff('PATCH', `/conversations/${conversationId}`, body);
                return { output: data };
            }

            case 'listMessages': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const page = Number(inputs.page ?? 1);
                const data = await ff('GET', `/conversations/${conversationId}/messages?page=${page}`);
                return { output: { messages: data.messages ?? [], pagination: data.pagination } };
            }

            case 'sendMessage': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const messageText = String(inputs.message ?? inputs.messageText ?? '').trim();
                if (!conversationId || !messageText) throw new Error('conversationId and message are required.');
                const body: any = {
                    message_parts: [{ text: { content: messageText } }],
                    actor_type: String(inputs.actorType ?? 'agent'),
                };
                if (inputs.actorId) body.actor_id = String(inputs.actorId);
                const data = await ff('POST', `/conversations/${conversationId}/messages`, body);
                return { output: data };
            }

            case 'listContacts': {
                const page = Number(inputs.page ?? 1);
                const itemsPerPage = Number(inputs.itemsPerPage ?? 25);
                const data = await ff('GET', `/contacts?page=${page}&items_per_page=${itemsPerPage}`);
                return { output: { contacts: data.contacts ?? data.items ?? [], pagination: data.pagination } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await ff('GET', `/contacts/${contactId}`);
                return { output: data };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.lastName) body.last_name = String(inputs.lastName);
                if (inputs.phone) body.phone = String(inputs.phone);
                if (inputs.avatar) body.avatar = { url: String(inputs.avatar) };
                const data = await ff('POST', '/contacts', body);
                return { output: data };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.lastName) body.last_name = String(inputs.lastName);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await ff('PATCH', `/contacts/${contactId}`, body);
                return { output: data };
            }

            case 'resolveConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await ff('PATCH', `/conversations/${conversationId}`, { status: 'resolved' });
                return { output: { success: true, conversationId, status: 'resolved' } };
            }

            case 'reopenConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await ff('PATCH', `/conversations/${conversationId}`, { status: 'new' });
                return { output: { success: true, conversationId, status: 'new' } };
            }

            case 'listAgents': {
                const page = Number(inputs.page ?? 1);
                const itemsPerPage = Number(inputs.itemsPerPage ?? 25);
                const data = await ff('GET', `/agents?page=${page}&items_per_page=${itemsPerPage}`);
                return { output: { agents: data.agents ?? data.items ?? [], pagination: data.pagination } };
            }

            case 'getAgent': {
                const agentId = String(inputs.agentId ?? '').trim();
                if (!agentId) throw new Error('agentId is required.');
                const data = await ff('GET', `/agents/${agentId}`);
                return { output: data };
            }

            case 'listChannels': {
                const data = await ff('GET', '/channels');
                return { output: { channels: data.channels ?? data.items ?? [] } };
            }

            default:
                throw new Error(`Unsupported Freshchat action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
