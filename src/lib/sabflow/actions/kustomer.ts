'use server';

const BASE_URL = 'https://api.kustomerapp.com/v1';

export async function executeKustomerAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        if (!apiKey) return { error: 'Missing apiKey' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        async function apiFetch(path: string, method = 'GET', body?: any) {
            const res = await fetch(`${BASE_URL}${path}`, {
                method,
                headers,
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Kustomer API error ${res.status}: ${text}`);
            }
            if (res.status === 204) return {};
            return res.json();
        }

        switch (actionName) {
            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.status) params.set('status', inputs.status);
                const data = await apiFetch(`/conversations?${params.toString()}`);
                return { output: data };
            }
            case 'getConversation': {
                const data = await apiFetch(`/conversations/${inputs.conversationId}`);
                return { output: data };
            }
            case 'createConversation': {
                const data = await apiFetch('/conversations', 'POST', inputs.body);
                return { output: data };
            }
            case 'updateConversation': {
                const data = await apiFetch(`/conversations/${inputs.conversationId}`, 'PATCH', inputs.body);
                return { output: data };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const data = await apiFetch(`/customers?${params.toString()}`);
                return { output: data };
            }
            case 'getCustomer': {
                const data = await apiFetch(`/customers/${inputs.customerId}`);
                return { output: data };
            }
            case 'createCustomer': {
                const data = await apiFetch('/customers', 'POST', inputs.body);
                return { output: data };
            }
            case 'updateCustomer': {
                const data = await apiFetch(`/customers/${inputs.customerId}`, 'PUT', inputs.body);
                return { output: data };
            }
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/conversations/${inputs.conversationId}/messages?${params.toString()}`);
                return { output: data };
            }
            case 'createMessage': {
                const data = await apiFetch(`/conversations/${inputs.conversationId}/messages`, 'POST', inputs.body);
                return { output: data };
            }
            case 'listNotes': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/conversations/${inputs.conversationId}/notes?${params.toString()}`);
                return { output: data };
            }
            case 'createNote': {
                const data = await apiFetch(`/conversations/${inputs.conversationId}/notes`, 'POST', inputs.body);
                return { output: data };
            }
            case 'listQueues': {
                const data = await apiFetch('/queues');
                return { output: data };
            }
            case 'listAgents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/users?${params.toString()}`);
                return { output: data };
            }
            case 'searchCustomers': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/customers/search?${params.toString()}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Kustomer action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Kustomer action error: ${err.message}`);
        return { error: err.message };
    }
}
