'use server';

export async function executeGladlyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const username = inputs.username;
        const apiToken = inputs.apiToken;
        const subdomain = inputs.subdomain;
        if (!username) return { error: 'Missing username' };
        if (!apiToken) return { error: 'Missing apiToken' };
        if (!subdomain) return { error: 'Missing subdomain' };

        const BASE_URL = `https://${subdomain}.gladly.com/api/v1`;
        const credentials = Buffer.from(`${username}:${apiToken}`).toString('base64');

        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
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
                throw new Error(`Gladly API error ${res.status}: ${text}`);
            }
            if (res.status === 204) return {};
            return res.json();
        }

        switch (actionName) {
            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.page) params.set('page', String(inputs.page));
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
                const data = await apiFetch(`/customers/${inputs.customerId}`, 'PATCH', inputs.body);
                return { output: data };
            }
            case 'searchCustomers': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.phone) params.set('phone', inputs.phone);
                if (inputs.name) params.set('name', inputs.name);
                const data = await apiFetch(`/customers/search?${params.toString()}`);
                return { output: data };
            }
            case 'listAgents': {
                const data = await apiFetch('/agents');
                return { output: data };
            }
            case 'getAgent': {
                const data = await apiFetch(`/agents/${inputs.agentId}`);
                return { output: data };
            }
            case 'listTopics': {
                const data = await apiFetch('/topics');
                return { output: data };
            }
            case 'getTopic': {
                const data = await apiFetch(`/topics/${inputs.topicId}`);
                return { output: data };
            }
            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.startAt) params.set('startAt', inputs.startAt);
                if (inputs.endAt) params.set('endAt', inputs.endAt);
                const data = await apiFetch(`/reports/summary?${params.toString()}`);
                return { output: data };
            }
            case 'listQueues': {
                const data = await apiFetch('/queues');
                return { output: data };
            }
            default:
                return { error: `Unknown Gladly action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Gladly action error: ${err.message}`);
        return { error: err.message };
    }
}
