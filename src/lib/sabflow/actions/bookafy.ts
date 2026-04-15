'use server';

export async function executeBookafyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.bookafy.com/v2';
        const authParam = `api_key=${encodeURIComponent(apiKey)}`;

        const get = async (path: string) => {
            const sep = path.includes('?') ? '&' : '?';
            const res = await fetch(`${base}${path}${sep}${authParam}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? data?.error ?? `GET ${path} failed`);
            return data;
        };

        const post = async (path: string, body: object) => {
            const res = await fetch(`${base}${path}?${authParam}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? data?.error ?? `POST ${path} failed`);
            return data;
        };

        const put = async (path: string, body: object) => {
            const res = await fetch(`${base}${path}?${authParam}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? data?.error ?? `PUT ${path} failed`);
            return data;
        };

        switch (actionName) {
            case 'listAppointments': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                if (inputs.page) params.set('page', String(inputs.page));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await get(`/appointments${query}`);
                return { output: data };
            }
            case 'getAppointment': {
                const appointmentId = inputs.appointmentId;
                if (!appointmentId) throw new Error('appointmentId is required.');
                const data = await get(`/appointments/${appointmentId}`);
                return { output: data };
            }
            case 'createAppointment': {
                const body = {
                    service_id: inputs.serviceId,
                    staff_id: inputs.staffId,
                    customer_id: inputs.customerId,
                    start_time: inputs.startTime,
                    timezone: inputs.timezone ?? 'UTC',
                    notes: inputs.notes ?? '',
                };
                const data = await post('/appointments', body);
                return { output: data };
            }
            case 'updateAppointment': {
                const appointmentId = inputs.appointmentId;
                if (!appointmentId) throw new Error('appointmentId is required.');
                const body = {
                    start_time: inputs.startTime,
                    notes: inputs.notes,
                    status: inputs.status,
                };
                const data = await put(`/appointments/${appointmentId}`, body);
                return { output: data };
            }
            case 'cancelAppointment': {
                const appointmentId = inputs.appointmentId;
                if (!appointmentId) throw new Error('appointmentId is required.');
                const data = await put(`/appointments/${appointmentId}/cancel`, { reason: inputs.reason ?? '' });
                return { output: data };
            }
            case 'listServices': {
                const data = await get('/services');
                return { output: data };
            }
            case 'getService': {
                const serviceId = inputs.serviceId;
                if (!serviceId) throw new Error('serviceId is required.');
                const data = await get(`/services/${serviceId}`);
                return { output: data };
            }
            case 'createService': {
                const body = {
                    name: inputs.name,
                    duration: inputs.duration,
                    price: inputs.price ?? 0,
                    description: inputs.description ?? '',
                    color: inputs.color ?? '',
                };
                const data = await post('/services', body);
                return { output: data };
            }
            case 'listStaff': {
                const data = await get('/staff');
                return { output: data };
            }
            case 'getStaff': {
                const staffId = inputs.staffId;
                if (!staffId) throw new Error('staffId is required.');
                const data = await get(`/staff/${staffId}`);
                return { output: data };
            }
            case 'listCustomers': {
                const page = inputs.page ?? 1;
                const data = await get(`/customers?page=${page}`);
                return { output: data };
            }
            case 'getCustomer': {
                const customerId = inputs.customerId;
                if (!customerId) throw new Error('customerId is required.');
                const data = await get(`/customers/${customerId}`);
                return { output: data };
            }
            case 'createCustomer': {
                const body = {
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email: inputs.email,
                    phone: inputs.phone ?? '',
                    timezone: inputs.timezone ?? 'UTC',
                };
                const data = await post('/customers', body);
                return { output: data };
            }
            case 'getAvailability': {
                const params = new URLSearchParams();
                if (inputs.serviceId) params.set('service_id', inputs.serviceId);
                if (inputs.staffId) params.set('staff_id', inputs.staffId);
                if (inputs.date) params.set('date', inputs.date);
                if (inputs.timezone) params.set('timezone', inputs.timezone);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await get(`/availability${query}`);
                return { output: data };
            }
            case 'listTimeSlots': {
                const params = new URLSearchParams();
                if (inputs.serviceId) params.set('service_id', inputs.serviceId);
                if (inputs.staffId) params.set('staff_id', inputs.staffId);
                if (inputs.date) params.set('date', inputs.date);
                if (inputs.timezone) params.set('timezone', inputs.timezone);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await get(`/timeslots${query}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`executeBookafyAction error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
