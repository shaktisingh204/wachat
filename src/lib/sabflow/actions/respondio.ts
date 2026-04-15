'use server';

async function respondIoRequest(
    method: string,
    baseUrl: string,
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string>
): Promise<any> {
    const url = new URL(`${baseUrl}${path}`);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            url.searchParams.set(k, v);
        }
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? `Respond.io API error ${res.status}: ${text}`);
    }
    return data;
}

export async function executeRespondIoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        if (!inputs.apiKey) return { error: 'Missing required input: apiKey' };
        const baseUrl = inputs.baseUrl ?? 'https://app.respond.io/api/v2';
        const { apiKey } = inputs;
        logger.log(`Executing Respond.io action: ${actionName}`);

        switch (actionName) {

            case 'listContacts': {
                const params: Record<string, string> = {};
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.limit) params.limit = String(inputs.limit);
                const data = await respondIoRequest('GET', baseUrl, '/contact', apiKey, undefined, params);
                return { output: { contacts: data.data ?? data.contacts ?? [], meta: data.meta } };
            }

            case 'getContact': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                const data = await respondIoRequest('GET', baseUrl, `/contact/${inputs.contactId}`, apiKey);
                return { output: { contact: data.data ?? data } };
            }

            case 'createContact': {
                if (!inputs.phone && !inputs.email) return { error: 'Missing required input: phone or email' };
                const body: Record<string, any> = {};
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.firstName = inputs.firstName;
                if (inputs.lastName) body.lastName = inputs.lastName;
                if (inputs.customFields) body.customFields = inputs.customFields;
                const data = await respondIoRequest('POST', baseUrl, '/contact', apiKey, body);
                return { output: { contact: data.data ?? data } };
            }

            case 'updateContact': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                const body: Record<string, any> = {};
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.firstName = inputs.firstName;
                if (inputs.lastName) body.lastName = inputs.lastName;
                if (inputs.customFields) body.customFields = inputs.customFields;
                const data = await respondIoRequest('PATCH', baseUrl, `/contact/${inputs.contactId}`, apiKey, body);
                return { output: { contact: data.data ?? data } };
            }

            case 'deleteContact': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                await respondIoRequest('DELETE', baseUrl, `/contact/${inputs.contactId}`, apiKey);
                return { output: { deleted: true, contactId: inputs.contactId } };
            }

            case 'sendMessage': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                if (!inputs.message) return { error: 'Missing required input: message' };
                const body: Record<string, any> = {
                    message: inputs.message,
                };
                if (inputs.type) body.type = inputs.type;
                if (inputs.channelId) body.channelId = inputs.channelId;
                const data = await respondIoRequest('POST', baseUrl, `/contact/${inputs.contactId}/message`, apiKey, body);
                return { output: { message: data.data ?? data } };
            }

            case 'listMessages': {
                if (!inputs.conversationId) return { error: 'Missing required input: conversationId' };
                const params: Record<string, string> = {};
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.limit) params.limit = String(inputs.limit);
                const data = await respondIoRequest('GET', baseUrl, `/conversation/${inputs.conversationId}/message`, apiKey, undefined, params);
                return { output: { messages: data.data ?? data.messages ?? [], meta: data.meta } };
            }

            case 'getConversation': {
                if (!inputs.conversationId) return { error: 'Missing required input: conversationId' };
                const data = await respondIoRequest('GET', baseUrl, `/conversation/${inputs.conversationId}`, apiKey);
                return { output: { conversation: data.data ?? data } };
            }

            case 'listConversations': {
                const params: Record<string, string> = {};
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.status) params.status = inputs.status;
                const data = await respondIoRequest('GET', baseUrl, '/conversation', apiKey, undefined, params);
                return { output: { conversations: data.data ?? data.conversations ?? [], meta: data.meta } };
            }

            case 'createConversation': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                const body: Record<string, any> = {
                    contactId: inputs.contactId,
                };
                if (inputs.channelId) body.channelId = inputs.channelId;
                if (inputs.assigneeId) body.assigneeId = inputs.assigneeId;
                const data = await respondIoRequest('POST', baseUrl, '/conversation', apiKey, body);
                return { output: { conversation: data.data ?? data } };
            }

            case 'assignConversation': {
                if (!inputs.conversationId) return { error: 'Missing required input: conversationId' };
                if (!inputs.assigneeId) return { error: 'Missing required input: assigneeId' };
                const body = { assigneeId: inputs.assigneeId };
                const data = await respondIoRequest('PATCH', baseUrl, `/conversation/${inputs.conversationId}/assign`, apiKey, body);
                return { output: { conversation: data.data ?? data } };
            }

            case 'closeConversation': {
                if (!inputs.conversationId) return { error: 'Missing required input: conversationId' };
                const data = await respondIoRequest('PATCH', baseUrl, `/conversation/${inputs.conversationId}/close`, apiKey, {});
                return { output: { conversation: data.data ?? data, closed: true } };
            }

            case 'listChannels': {
                const data = await respondIoRequest('GET', baseUrl, '/channel', apiKey);
                return { output: { channels: data.data ?? data.channels ?? [] } };
            }

            case 'listTeams': {
                const data = await respondIoRequest('GET', baseUrl, '/team', apiKey);
                return { output: { teams: data.data ?? data.teams ?? [] } };
            }

            case 'getContactByPhone': {
                if (!inputs.phone) return { error: 'Missing required input: phone' };
                const params: Record<string, string> = { phone: inputs.phone };
                const data = await respondIoRequest('GET', baseUrl, '/contact', apiKey, undefined, params);
                const contacts = data.data ?? data.contacts ?? [];
                return { output: { contact: contacts[0] ?? null, contacts } };
            }

            default:
                return { error: `Respond.io action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Respond.io action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Respond.io error' };
    }
}
