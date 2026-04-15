'use server';

export async function executeVcitaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');

        const base = 'https://app.vcita.com/api/v1';
        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${base}${path}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? data?.error ?? `GET ${path} failed`);
            return data;
        };

        const post = async (path: string, body: object) => {
            const res = await fetch(`${base}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? data?.error ?? `POST ${path} failed`);
            return data;
        };

        const put = async (path: string, body: object) => {
            const res = await fetch(`${base}${path}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? data?.error ?? `PUT ${path} failed`);
            return data;
        };

        const del = async (path: string) => {
            const res = await fetch(`${base}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message ?? `DELETE ${path} failed`);
            }
            return { success: true };
        };

        switch (actionName) {
            case 'listClients': {
                const page = inputs.page ?? 1;
                const data = await get(`/clients?page=${page}`);
                return { output: data };
            }
            case 'getClient': {
                const clientId = inputs.clientId;
                if (!clientId) throw new Error('clientId is required.');
                const data = await get(`/clients/${clientId}`);
                return { output: data };
            }
            case 'createClient': {
                const body = {
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email: inputs.email,
                    phone: inputs.phone,
                    notes: inputs.notes,
                };
                const data = await post('/clients', body);
                return { output: data };
            }
            case 'updateClient': {
                const clientId = inputs.clientId;
                if (!clientId) throw new Error('clientId is required.');
                const body = {
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email: inputs.email,
                    phone: inputs.phone,
                    notes: inputs.notes,
                };
                const data = await put(`/clients/${clientId}`, body);
                return { output: data };
            }
            case 'deleteClient': {
                const clientId = inputs.clientId;
                if (!clientId) throw new Error('clientId is required.');
                const data = await del(`/clients/${clientId}`);
                return { output: data };
            }
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                if (inputs.page) params.set('page', String(inputs.page));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await get(`/events${query}`);
                return { output: data };
            }
            case 'getEvent': {
                const eventId = inputs.eventId;
                if (!eventId) throw new Error('eventId is required.');
                const data = await get(`/events/${eventId}`);
                return { output: data };
            }
            case 'createEvent': {
                const body = {
                    title: inputs.title,
                    start: inputs.start,
                    end: inputs.end,
                    client_id: inputs.clientId,
                    service_id: inputs.serviceId,
                    notes: inputs.notes,
                };
                const data = await post('/events', body);
                return { output: data };
            }
            case 'updateEvent': {
                const eventId = inputs.eventId;
                if (!eventId) throw new Error('eventId is required.');
                const body = {
                    title: inputs.title,
                    start: inputs.start,
                    end: inputs.end,
                    notes: inputs.notes,
                };
                const data = await put(`/events/${eventId}`, body);
                return { output: data };
            }
            case 'cancelEvent': {
                const eventId = inputs.eventId;
                if (!eventId) throw new Error('eventId is required.');
                const data = await put(`/events/${eventId}/cancel`, { reason: inputs.reason ?? '' });
                return { output: data };
            }
            case 'listInvoices': {
                const page = inputs.page ?? 1;
                const data = await get(`/invoices?page=${page}`);
                return { output: data };
            }
            case 'createInvoice': {
                const body = {
                    client_id: inputs.clientId,
                    amount: inputs.amount,
                    currency: inputs.currency ?? 'USD',
                    due_date: inputs.dueDate,
                    description: inputs.description,
                    line_items: inputs.lineItems ?? [],
                };
                const data = await post('/invoices', body);
                return { output: data };
            }
            case 'listServices': {
                const data = await get('/services');
                return { output: data };
            }
            case 'createService': {
                const body = {
                    name: inputs.name,
                    duration: inputs.duration,
                    price: inputs.price,
                    description: inputs.description,
                };
                const data = await post('/services', body);
                return { output: data };
            }
            case 'getCalendar': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await get(`/calendar${query}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`executeVcitaAction error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
