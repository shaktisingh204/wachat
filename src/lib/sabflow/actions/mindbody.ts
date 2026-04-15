'use server';

export async function executeMindBodyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const siteId = String(inputs.siteId ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();

        if (!apiKey || !siteId) throw new Error('apiKey and siteId are required.');

        const BASE_URL = 'https://api.mindbodyonline.com/public/v6';

        const mbFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[MindBody] ${method} ${path}`);
            const headers: Record<string, string> = {
                'API-Key': apiKey,
                'SiteId': siteId,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${BASE_URL}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.Error?.Message || data?.message || `MindBody API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'getClasses': {
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const data = await mbFetch('GET', `/class/classes?Limit=${limit}&Offset=${offset}`);
                return { output: { classes: data.Classes ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'getClassSchedules': {
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const data = await mbFetch('GET', `/class/classschedules?Limit=${limit}&Offset=${offset}`);
                return { output: { schedules: data.ClassSchedules ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'getStaff': {
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const data = await mbFetch('GET', `/staff/staff?Limit=${limit}&Offset=${offset}`);
                return { output: { staff: data.StaffMembers ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'getClients': {
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const data = await mbFetch('GET', `/client/clients?Limit=${limit}&Offset=${offset}`);
                return { output: { clients: data.Clients ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'getClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await mbFetch('GET', `/client/clients?ClientIds=${encodeURIComponent(clientId)}`);
                const client = (data.Clients ?? [])[0] ?? {};
                return { output: { id: String(client.Id ?? ''), firstName: client.FirstName ?? '', lastName: client.LastName ?? '', email: client.Email ?? '' } };
            }

            case 'addClient': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!firstName || !lastName) throw new Error('firstName and lastName are required.');
                const body: any = { FirstName: firstName, LastName: lastName };
                if (email) body.Email = email;
                if (inputs.phone) body.MobilePhone = String(inputs.phone);
                const data = await mbFetch('POST', '/client/addclient', body);
                return { output: { id: String(data.Client?.Id ?? ''), firstName: data.Client?.FirstName ?? '', lastName: data.Client?.LastName ?? '' } };
            }

            case 'updateClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const body: any = { Id: clientId };
                if (inputs.firstName) body.FirstName = String(inputs.firstName);
                if (inputs.lastName) body.LastName = String(inputs.lastName);
                if (inputs.email) body.Email = String(inputs.email);
                if (inputs.phone) body.MobilePhone = String(inputs.phone);
                const data = await mbFetch('POST', '/client/updateclient', body);
                return { output: { id: String(data.Client?.Id ?? ''), updated: 'true' } };
            }

            case 'addAppointment': {
                const staffId = String(inputs.staffId ?? '').trim();
                const clientId = String(inputs.clientId ?? '').trim();
                const serviceId = String(inputs.serviceId ?? '').trim();
                const startDateTime = String(inputs.startDateTime ?? '').trim();
                if (!staffId || !clientId || !startDateTime) throw new Error('staffId, clientId, and startDateTime are required.');
                const body: any = { StaffId: staffId, ClientId: clientId, StartDateTime: startDateTime };
                if (serviceId) body.ServiceId = serviceId;
                const data = await mbFetch('POST', '/appointment/addappointment', body);
                return { output: { id: String(data.Appointment?.Id ?? ''), status: data.Appointment?.Status ?? '' } };
            }

            case 'getAppointments': {
                const limit = Number(inputs.limit ?? 10);
                const offset = Number(inputs.offset ?? 0);
                const data = await mbFetch('GET', `/appointment/staffappointments?Limit=${limit}&Offset=${offset}`);
                return { output: { appointments: data.Appointments ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'getServices': {
                const limit = Number(inputs.limit ?? 10);
                const data = await mbFetch('GET', `/sale/services?Limit=${limit}`);
                return { output: { services: data.Services ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'getContracts': {
                const limit = Number(inputs.limit ?? 10);
                const data = await mbFetch('GET', `/sale/contracts?Limit=${limit}`);
                return { output: { contracts: data.Contracts ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'getSessionTypes': {
                const data = await mbFetch('GET', '/site/sessiontypes');
                return { output: { sessionTypes: data.SessionTypes ?? [] } };
            }

            case 'getLocations': {
                const data = await mbFetch('GET', '/site/locations');
                return { output: { locations: data.Locations ?? [] } };
            }

            case 'getSales': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await mbFetch('GET', `/sale/sales?ClientId=${encodeURIComponent(clientId)}`);
                return { output: { sales: data.Sales ?? [], total: String(data.TotalResults ?? 0) } };
            }

            case 'addSale': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const body: any = { ClientId: clientId };
                if (inputs.serviceId) body.Services = [{ Id: String(inputs.serviceId) }];
                if (inputs.amount) body.Payments = [{ Amount: Number(inputs.amount), Type: inputs.paymentType ?? 'Cash' }];
                const data = await mbFetch('POST', '/sale/checkouts', body);
                return { output: { id: String(data.Id ?? ''), status: data.Status ?? 'created' } };
            }

            case 'addPayment': {
                const clientId = String(inputs.clientId ?? '').trim();
                const amount = Number(inputs.amount ?? 0);
                if (!clientId || !amount) throw new Error('clientId and amount are required.');
                const body: any = { ClientId: clientId, Amount: amount, PaymentMethodId: inputs.paymentMethodId ?? 0 };
                const data = await mbFetch('POST', '/sale/updateclientservice', body);
                return { output: { success: 'true', clientId } };
            }

            case 'getClientMemberships': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await mbFetch('GET', `/client/clientmemberships?ClientId=${encodeURIComponent(clientId)}`);
                return { output: { memberships: data.ClientMemberships ?? [], total: String(data.TotalResults ?? 0) } };
            }

            default:
                return { error: `MindBody action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'MindBody action failed.' };
    }
}
