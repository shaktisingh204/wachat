'use server';

export async function executeAppointyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.appointy.com/v1';
        const authParam = `api_key=${encodeURIComponent(apiKey)}`;

        const get = async (path: string) => {
            const res = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}${authParam}`);
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

        const del = async (path: string) => {
            const res = await fetch(`${base}${path}?${authParam}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message ?? `DELETE ${path} failed`);
            }
            return { success: true };
        };

        switch (actionName) {
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
                    price: inputs.price,
                    description: inputs.description,
                };
                const data = await post('/services', body);
                return { output: data };
            }
            case 'updateService': {
                const serviceId = inputs.serviceId;
                if (!serviceId) throw new Error('serviceId is required.');
                const body = {
                    name: inputs.name,
                    duration: inputs.duration,
                    price: inputs.price,
                    description: inputs.description,
                };
                const data = await put(`/services/${serviceId}`, body);
                return { output: data };
            }
            case 'deleteService': {
                const serviceId = inputs.serviceId;
                if (!serviceId) throw new Error('serviceId is required.');
                const data = await del(`/services/${serviceId}`);
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
            case 'listAppointments': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                if (inputs.status) params.set('status', inputs.status);
                const query = params.toString() ? `?${params.toString()}&${authParam}` : `?${authParam}`;
                const res = await fetch(`${base}/appointments${query}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message ?? 'listAppointments failed');
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
                    notes: inputs.notes,
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
            case 'getAvailability': {
                const params = new URLSearchParams();
                if (inputs.serviceId) params.set('service_id', inputs.serviceId);
                if (inputs.staffId) params.set('staff_id', inputs.staffId);
                if (inputs.date) params.set('date', inputs.date);
                const query = params.toString() ? `?${params.toString()}&${authParam}` : `?${authParam}`;
                const res = await fetch(`${base}/availability${query}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message ?? 'getAvailability failed');
                return { output: data };
            }
            case 'listCustomers': {
                const data = await get('/customers');
                return { output: data };
            }
            case 'createCustomer': {
                const body = {
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email: inputs.email,
                    phone: inputs.phone,
                    notes: inputs.notes,
                };
                const data = await post('/customers', body);
                return { output: data };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`executeAppointyAction error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
