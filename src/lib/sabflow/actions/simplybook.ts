
'use server';

export async function executeSimplyBookAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const company = String(inputs.companyLogin ?? '').trim();
        const email = String(inputs.email ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        if (!company || !email || !password) throw new Error('companyLogin, email, and password are required.');

        const base = 'https://user-api-v2.simplybook.me/admin';

        // Authenticate to get token
        const authRes = await fetch(`${base}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company, login: email, password }),
        });
        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData?.message ?? 'Authentication failed');
        const userToken = authData.token;
        if (!userToken) throw new Error('Failed to obtain user_token from SimplyBook.me');

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Company-Login': company,
            'X-Token': userToken,
        };

        async function req(method: string, path: string, body?: any, queryParams?: Record<string, string>): Promise<any> {
            let url = `${base}${path}`;
            if (queryParams && Object.keys(queryParams).length > 0) {
                const params = new URLSearchParams(queryParams);
                url += `?${params.toString()}`;
            }
            const res = await fetch(url, {
                method,
                headers,
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(typeof data === 'object' ? (data?.message ?? JSON.stringify(data)) : text);
            return data;
        }

        switch (actionName) {
            case 'getServices': {
                const data = await req('GET', '/service');
                const items = Array.isArray(data) ? data : (data?.data ?? []);
                logger.log(`[SimplyBook] Got ${items.length} services`);
                return { output: { services: items, count: String(items.length) } };
            }

            case 'getService': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/service/${id}`);
                return { output: data };
            }

            case 'getProviders': {
                const data = await req('GET', '/service-provider');
                const items = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { providers: items, count: String(items.length) } };
            }

            case 'getClients': {
                const queryParams: Record<string, string> = {};
                if (inputs.search) queryParams['filter[search]'] = inputs.search;
                if (inputs.page) queryParams['page'] = String(inputs.page);
                if (inputs.onPage) queryParams['on_page'] = String(inputs.onPage);
                const data = await req('GET', '/client', undefined, queryParams);
                const items = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { clients: items, count: String(items.length) } };
            }

            case 'getClient': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/client/${id}`);
                return { output: data };
            }

            case 'createClient': {
                const body: any = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.email !== undefined) body.email = inputs.email;
                if (inputs.phone !== undefined) body.phone = inputs.phone;
                if (inputs.address1 !== undefined) body.address1 = inputs.address1;
                if (inputs.city !== undefined) body.city = inputs.city;
                const data = await req('POST', '/client', body);
                logger.log(`[SimplyBook] Created client: ${data.id}`);
                return { output: data };
            }

            case 'getBookings': {
                const queryParams: Record<string, string> = {};
                if (inputs.dateFrom) queryParams['filter[date_from]'] = inputs.dateFrom;
                if (inputs.dateTo) queryParams['filter[date_to]'] = inputs.dateTo;
                if (inputs.serviceId) queryParams['filter[service_id]'] = String(inputs.serviceId);
                if (inputs.providerId) queryParams['filter[provider_id]'] = String(inputs.providerId);
                if (inputs.page) queryParams['page'] = String(inputs.page);
                const data = await req('GET', '/booking', undefined, queryParams);
                const items = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { bookings: items, count: String(items.length) } };
            }

            case 'createBooking': {
                const body: any = {};
                if (inputs.serviceId !== undefined) body.service_id = inputs.serviceId;
                if (inputs.providerId !== undefined) body.provider_id = inputs.providerId;
                if (inputs.clientId !== undefined) body.client_id = inputs.clientId;
                if (inputs.startDatetime !== undefined) body.start_datetime = inputs.startDatetime;
                if (inputs.endDatetime !== undefined) body.end_datetime = inputs.endDatetime;
                if (inputs.locationId !== undefined) body.location_id = inputs.locationId;
                const data = await req('POST', '/booking', body);
                logger.log(`[SimplyBook] Created booking: ${data.id}`);
                return { output: data };
            }

            case 'updateBooking': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: any = {};
                if (inputs.serviceId !== undefined) body.service_id = inputs.serviceId;
                if (inputs.providerId !== undefined) body.provider_id = inputs.providerId;
                if (inputs.startDatetime !== undefined) body.start_datetime = inputs.startDatetime;
                if (inputs.endDatetime !== undefined) body.end_datetime = inputs.endDatetime;
                const data = await req('PUT', `/booking/${id}`, body);
                return { output: data };
            }

            case 'cancelBooking': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await req('DELETE', `/booking/${id}`);
                logger.log(`[SimplyBook] Cancelled booking: ${id}`);
                return { output: { id, status: 'cancelled' } };
            }

            case 'getAvailability': {
                const queryParams: Record<string, string> = {};
                if (inputs.serviceId) queryParams['service_id'] = String(inputs.serviceId);
                if (inputs.providerId) queryParams['provider_id'] = String(inputs.providerId);
                if (inputs.date) queryParams['date'] = inputs.date;
                const data = await req('GET', '/booking/slots', undefined, queryParams);
                return { output: { slots: data } };
            }

            case 'getLocations': {
                const data = await req('GET', '/location');
                const items = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { locations: items, count: String(items.length) } };
            }

            default:
                throw new Error(`Unknown SimplyBook action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
