'use server';

const TAWKTO_BASE = 'https://api.tawk.to/v1';

async function tawktoFetch(email: string, password: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[TawkTo] ${method} ${path}`);
    const token = Buffer.from(email + ':' + password).toString('base64');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${TAWKTO_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Tawk.to API error: ${res.status}`);
    }
    return data?.data ?? data;
}

export async function executeTawkToAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const email = String(inputs.email ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        if (!email) throw new Error('email is required.');
        if (!password) throw new Error('password is required.');
        const tf = (method: string, path: string, body?: any) => tawktoFetch(email, password, method, path, body, logger);

        switch (actionName) {
            case 'listProperties': {
                const data = await tf('GET', '/properties');
                return { output: { properties: Array.isArray(data) ? data : [] } };
            }

            case 'getProperty': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const data = await tf('GET', `/properties/${propertyId}`);
                return { output: data };
            }

            case 'listChats': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const page = Number(inputs.page ?? 1);
                const data = await tf('GET', `/properties/${propertyId}/chats?page=${page}`);
                return { output: { chats: Array.isArray(data?.chats) ? data.chats : Array.isArray(data) ? data : [], page } };
            }

            case 'getChat': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const chatId = String(inputs.chatId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!chatId) throw new Error('chatId is required.');
                const data = await tf('GET', `/properties/${propertyId}/chats/${chatId}`);
                return { output: data };
            }

            case 'updateChat': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const chatId = String(inputs.chatId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!chatId) throw new Error('chatId is required.');
                const body: any = {};
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.tags) body.tags = inputs.tags;
                const data = await tf('PUT', `/properties/${propertyId}/chats/${chatId}`, body);
                return { output: { chatId, updated: true, ...data } };
            }

            case 'searchChats': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!query) throw new Error('query is required.');
                const data = await tf('GET', `/properties/${propertyId}/chats?search=${encodeURIComponent(query)}`);
                return { output: { chats: Array.isArray(data?.chats) ? data.chats : Array.isArray(data) ? data : [] } };
            }

            case 'listContacts': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const page = Number(inputs.page ?? 1);
                const data = await tf('GET', `/properties/${propertyId}/contacts?page=${page}`);
                return { output: { contacts: Array.isArray(data?.contacts) ? data.contacts : Array.isArray(data) ? data : [], page } };
            }

            case 'getContact': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!contactId) throw new Error('contactId is required.');
                const data = await tf('GET', `/properties/${propertyId}/contacts/${contactId}`);
                return { output: data };
            }

            case 'createContact': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const email = String(inputs.contactEmail ?? inputs.email ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!email) throw new Error('contactEmail is required.');
                const body: any = { email };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await tf('POST', `/properties/${propertyId}/contacts`, body);
                return { output: data };
            }

            case 'updateContact': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await tf('PUT', `/properties/${propertyId}/contacts/${contactId}`, body);
                return { output: { contactId, updated: true, ...data } };
            }

            case 'deleteContact': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!contactId) throw new Error('contactId is required.');
                await tf('DELETE', `/properties/${propertyId}/contacts/${contactId}`);
                return { output: { contactId, deleted: true } };
            }

            case 'listAgents': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const data = await tf('GET', `/properties/${propertyId}/agents`);
                return { output: { agents: Array.isArray(data) ? data : [] } };
            }

            case 'getAgent': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const agentId = String(inputs.agentId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!agentId) throw new Error('agentId is required.');
                const data = await tf('GET', `/properties/${propertyId}/agents/${agentId}`);
                return { output: data };
            }

            case 'updateAgent': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const agentId = String(inputs.agentId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!agentId) throw new Error('agentId is required.');
                const body: any = {};
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.role) body.role = String(inputs.role);
                const data = await tf('PUT', `/properties/${propertyId}/agents/${agentId}`, body);
                return { output: { agentId, updated: true, ...data } };
            }

            case 'getChatHistory': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const chatId = String(inputs.chatId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                if (!chatId) throw new Error('chatId is required.');
                const data = await tf('GET', `/properties/${propertyId}/chats/${chatId}/messages`);
                return { output: { messages: Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Unknown Tawk.to action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
