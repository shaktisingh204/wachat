'use server';

const BASE_URL = 'https://api.groovehq.com/v1';

export async function executeGrooveAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        if (!accessToken) return { error: 'Missing accessToken' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
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
                throw new Error(`Groove API error ${res.status}: ${text}`);
            }
            if (res.status === 204) return {};
            return res.json();
        }

        switch (actionName) {
            case 'listTickets': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.state) params.set('state', inputs.state);
                const data = await apiFetch(`/tickets?${params.toString()}`);
                return { output: data };
            }
            case 'getTicket': {
                const data = await apiFetch(`/tickets/${inputs.ticketNumber}`);
                return { output: data };
            }
            case 'createTicket': {
                const data = await apiFetch('/tickets', 'POST', inputs.body);
                return { output: data };
            }
            case 'updateTicket': {
                const data = await apiFetch(`/tickets/${inputs.ticketNumber}`, 'PUT', inputs.body);
                return { output: data };
            }
            case 'deleteTicket': {
                await apiFetch(`/tickets/${inputs.ticketNumber}`, 'DELETE');
                return { output: { success: true } };
            }
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/tickets/${inputs.ticketNumber}/messages?${params.toString()}`);
                return { output: data };
            }
            case 'getMessage': {
                const data = await apiFetch(`/messages/${inputs.messageId}`);
                return { output: data };
            }
            case 'createMessage': {
                const data = await apiFetch(`/tickets/${inputs.ticketNumber}/messages`, 'POST', inputs.body);
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
                const data = await apiFetch(`/customers/${inputs.customerId}`, 'PUT', inputs.body);
                return { output: data };
            }
            case 'listAgents': {
                const data = await apiFetch('/agents');
                return { output: data };
            }
            case 'listMailboxes': {
                const data = await apiFetch('/mailboxes');
                return { output: data };
            }
            case 'searchTickets': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await apiFetch(`/tickets/search?${params.toString()}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Groove action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Groove action error: ${err.message}`);
        return { error: err.message };
    }
}
