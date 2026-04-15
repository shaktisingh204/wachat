'use server';

export async function executeGorgiasAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const email = inputs.email;
        const apiKey = inputs.apiKey;
        const domain = inputs.domain;
        if (!email) return { error: 'Missing email' };
        if (!apiKey) return { error: 'Missing apiKey' };
        if (!domain) return { error: 'Missing domain' };

        const BASE_URL = `https://${domain}.gorgias.com/api`;
        const credentials = Buffer.from(`${email}:${apiKey}`).toString('base64');

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
                throw new Error(`Gorgias API error ${res.status}: ${text}`);
            }
            if (res.status === 204) return {};
            return res.json();
        }

        switch (actionName) {
            case 'listTickets': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.status) params.set('status', inputs.status);
                const data = await apiFetch(`/tickets?${params.toString()}`);
                return { output: data };
            }
            case 'getTicket': {
                const data = await apiFetch(`/tickets/${inputs.ticketId}`);
                return { output: data };
            }
            case 'createTicket': {
                const data = await apiFetch('/tickets', 'POST', inputs.body);
                return { output: data };
            }
            case 'updateTicket': {
                const data = await apiFetch(`/tickets/${inputs.ticketId}`, 'PUT', inputs.body);
                return { output: data };
            }
            case 'deleteTicket': {
                await apiFetch(`/tickets/${inputs.ticketId}`, 'DELETE');
                return { output: { success: true } };
            }
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/tickets/${inputs.ticketId}/messages?${params.toString()}`);
                return { output: data };
            }
            case 'createMessage': {
                const data = await apiFetch(`/tickets/${inputs.ticketId}/messages`, 'POST', inputs.body);
                return { output: data };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.email) params.set('email', inputs.customerEmail);
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
            case 'listTags': {
                const data = await apiFetch('/tags');
                return { output: data };
            }
            case 'addTag': {
                const data = await apiFetch(`/tickets/${inputs.ticketId}/tags`, 'POST', { name: inputs.tagName });
                return { output: data };
            }
            case 'listSatisfactionSurveys': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/satisfaction-surveys?${params.toString()}`);
                return { output: data };
            }
            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.startDatetime) params.set('start_datetime', inputs.startDatetime);
                if (inputs.endDatetime) params.set('end_datetime', inputs.endDatetime);
                const data = await apiFetch(`/stats?${params.toString()}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Gorgias action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Gorgias action error: ${err.message}`);
        return { error: err.message };
    }
}
