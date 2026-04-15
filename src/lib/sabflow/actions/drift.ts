'use server';

const DRIFT_BASE_URL = 'https://driftapi.com';

async function driftRequest(
    method: string,
    path: string,
    accessToken: string,
    body?: any
): Promise<any> {
    const url = `${DRIFT_BASE_URL}${path}`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
        throw new Error(data?.error?.message ?? data?.message ?? `Drift API error ${res.status}: ${text}`);
    }
    return data;
}

export async function executeDriftAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output: any } | { error: string }> {
    try {
        if (!inputs.accessToken) return { error: 'Missing required input: accessToken' };

        logger.log(`Executing Drift action: ${actionName}`);

        switch (actionName) {

            case 'getContacts': {
                const email = inputs.email ?? '';
                const limit = inputs.limit ?? 25;
                const params = new URLSearchParams();
                if (email) params.set('email', email);
                params.set('limit', String(limit));
                const data = await driftRequest('GET', `/contacts?${params}`, inputs.accessToken);
                return { output: { contacts: data?.data ?? [] } };
            }

            case 'getContact': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                const data = await driftRequest('GET', `/contacts/${inputs.contactId}`, inputs.accessToken);
                return { output: { contact: data?.data ?? {} } };
            }

            case 'createContact': {
                if (!inputs.email) return { error: 'Missing required input: email' };
                const body = {
                    attributes: {
                        email: inputs.email,
                        ...(inputs.attributes ?? {}),
                    },
                };
                const data = await driftRequest('POST', '/contacts', inputs.accessToken, body);
                return { output: { contact: data?.data ?? {} } };
            }

            case 'updateContact': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                if (!inputs.attributes) return { error: 'Missing required input: attributes' };
                const body = { attributes: inputs.attributes };
                const data = await driftRequest('PATCH', `/contacts/${inputs.contactId}`, inputs.accessToken, body);
                return { output: { contact: data?.data ?? {} } };
            }

            case 'getConversations': {
                const status = inputs.status ?? 'open';
                const limit = inputs.limit ?? 25;
                const params = new URLSearchParams({ status, limit: String(limit) });
                const data = await driftRequest('GET', `/conversations?${params}`, inputs.accessToken);
                return { output: { conversations: data?.data ?? [] } };
            }

            case 'getConversation': {
                if (!inputs.conversationId) return { error: 'Missing required input: conversationId' };
                const data = await driftRequest('GET', `/conversations/${inputs.conversationId}`, inputs.accessToken);
                return { output: { conversation: data?.data ?? {} } };
            }

            case 'createConversation': {
                if (!inputs.email) return { error: 'Missing required input: email' };
                if (!inputs.message) return { error: 'Missing required input: message' };
                const convBody: any = {
                    type: 'chat',
                    contactEmail: inputs.email,
                };
                if (inputs.userId) convBody.createdById = inputs.userId;
                const convData = await driftRequest('POST', '/conversations', inputs.accessToken, convBody);
                const conversationId = convData?.data?.id;
                if (!conversationId) throw new Error('Failed to create conversation — no ID returned');
                const msgBody: any = { type: 'chat', body: inputs.message };
                if (inputs.userId) msgBody.userId = inputs.userId;
                await driftRequest('POST', `/conversations/${conversationId}/messages`, inputs.accessToken, msgBody);
                return { output: { conversation: convData?.data ?? {}, conversationId } };
            }

            case 'sendMessage': {
                if (!inputs.conversationId) return { error: 'Missing required input: conversationId' };
                if (!inputs.body) return { error: 'Missing required input: body' };
                const msgBody: any = { type: 'chat', body: inputs.body };
                if (inputs.userId) msgBody.userId = inputs.userId;
                const data = await driftRequest(
                    'POST',
                    `/conversations/${inputs.conversationId}/messages`,
                    inputs.accessToken,
                    msgBody
                );
                return { output: { message: data?.data ?? {} } };
            }

            case 'getMessages': {
                if (!inputs.conversationId) return { error: 'Missing required input: conversationId' };
                const data = await driftRequest(
                    'GET',
                    `/conversations/${inputs.conversationId}/messages`,
                    inputs.accessToken
                );
                return { output: { messages: data?.data ?? [] } };
            }

            case 'listAccounts': {
                const limit = inputs.limit ?? 25;
                const data = await driftRequest('GET', `/accounts?limit=${limit}`, inputs.accessToken);
                return { output: { accounts: data?.data ?? [] } };
            }

            case 'getAccount': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                const data = await driftRequest('GET', `/accounts/${inputs.accountId}`, inputs.accessToken);
                return { output: { account: data?.data ?? {} } };
            }

            case 'createAccount': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                if (!inputs.domain) return { error: 'Missing required input: domain' };
                const body: any = {
                    name: inputs.name,
                    domain: inputs.domain,
                    ...(inputs.attributes ? { attributes: inputs.attributes } : {}),
                };
                const data = await driftRequest('POST', '/accounts', inputs.accessToken, body);
                return { output: { account: data?.data ?? {} } };
            }

            case 'listPlaybooks': {
                const data = await driftRequest('GET', '/playbooks', inputs.accessToken);
                return { output: { playbooks: data?.data ?? [] } };
            }

            case 'getUsers': {
                const data = await driftRequest('GET', '/users', inputs.accessToken);
                return { output: { users: data?.data ?? [] } };
            }

            default:
                return { error: `Drift action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Drift action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Drift error' };
    }
}
