'use server';

export async function executeSetmoreAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const base = 'https://developer.setmore.com/api/v1';
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${base}${path}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.msg ?? data?.message ?? `GET ${path} failed`);
            return data;
        };

        const post = async (path: string, body: object) => {
            const res = await fetch(`${base}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.msg ?? data?.message ?? `POST ${path} failed`);
            return data;
        };

        const put = async (path: string, body: object) => {
            const res = await fetch(`${base}${path}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.msg ?? data?.message ?? `PUT ${path} failed`);
            return data;
        };

        const del = async (path: string) => {
            const res = await fetch(`${base}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.msg ?? `DELETE ${path} failed`);
            }
            return { success: true };
        };

        switch (actionName) {
            case 'getProfile': {
                const data = await get('/bookingpage/profile');
                return { output: data };
            }
            case 'listStaff': {
                const data = await get('/bookingpage/staffs');
                return { output: data };
            }
            case 'getStaff': {
                const staffKey = inputs.staffKey;
                if (!staffKey) throw new Error('staffKey is required.');
                const data = await get(`/bookingpage/staff/${staffKey}`);
                return { output: data };
            }
            case 'listServices': {
                const data = await get('/bookingpage/services');
                return { output: data };
            }
            case 'getService': {
                const serviceKey = inputs.serviceKey;
                if (!serviceKey) throw new Error('serviceKey is required.');
                const data = await get(`/bookingpage/service/${serviceKey}`);
                return { output: data };
            }
            case 'listAppointments': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await get(`/bookingpage/appointments${query}`);
                return { output: data };
            }
            case 'getAppointment': {
                const appointmentKey = inputs.appointmentKey;
                if (!appointmentKey) throw new Error('appointmentKey is required.');
                const data = await get(`/bookingpage/appointment/${appointmentKey}`);
                return { output: data };
            }
            case 'createAppointment': {
                const body = {
                    staff_key: inputs.staffKey,
                    service_key: inputs.serviceKey,
                    customer_key: inputs.customerKey,
                    start_time: inputs.startTime,
                    end_time: inputs.endTime,
                    comment: inputs.comment ?? '',
                };
                const data = await post('/bookingpage/appointment/create', body);
                return { output: data };
            }
            case 'updateAppointment': {
                const appointmentKey = inputs.appointmentKey;
                if (!appointmentKey) throw new Error('appointmentKey is required.');
                const body = {
                    key: appointmentKey,
                    staff_key: inputs.staffKey,
                    service_key: inputs.serviceKey,
                    start_time: inputs.startTime,
                    end_time: inputs.endTime,
                    comment: inputs.comment,
                };
                const data = await put('/bookingpage/appointment/update', body);
                return { output: data };
            }
            case 'deleteAppointment': {
                const appointmentKey = inputs.appointmentKey;
                if (!appointmentKey) throw new Error('appointmentKey is required.');
                const data = await del(`/bookingpage/appointment/${appointmentKey}`);
                return { output: data };
            }
            case 'listCustomers': {
                const data = await get('/bookingpage/customers');
                return { output: data };
            }
            case 'getCustomer': {
                const customerKey = inputs.customerKey;
                if (!customerKey) throw new Error('customerKey is required.');
                const data = await get(`/bookingpage/customer/${customerKey}`);
                return { output: data };
            }
            case 'createCustomer': {
                const body = {
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email_id: inputs.email,
                    contact_number: inputs.phone ?? '',
                    additional_info: inputs.additionalInfo ?? '',
                };
                const data = await post('/bookingpage/customer/create', body);
                return { output: data };
            }
            case 'updateCustomer': {
                const customerKey = inputs.customerKey;
                if (!customerKey) throw new Error('customerKey is required.');
                const body = {
                    key: customerKey,
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    email_id: inputs.email,
                    contact_number: inputs.phone,
                };
                const data = await put('/bookingpage/customer/update', body);
                return { output: data };
            }
            case 'getAvailableSlots': {
                const staffKey = inputs.staffKey;
                const serviceKey = inputs.serviceKey;
                const selectedDate = inputs.selectedDate;
                if (!staffKey || !serviceKey || !selectedDate) {
                    throw new Error('staffKey, serviceKey, and selectedDate are required.');
                }
                const data = await get(`/bookingpage/slots?staff_key=${encodeURIComponent(staffKey)}&service_key=${encodeURIComponent(serviceKey)}&selected_date=${encodeURIComponent(selectedDate)}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`executeSetmoreAction error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
