
'use server';

export async function executeAcuityAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const userId = String(inputs.userId ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!userId || !apiKey) throw new Error('userId and apiKey are required.');

        const base = 'https://acuityscheduling.com/api/v1';
        const authHeader = `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`;
        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        };

        async function req(method: string, path: string, body?: any): Promise<any> {
            const res = await fetch(`${base}${path}`, {
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
            case 'listAppointments': {
                const params = new URLSearchParams();
                if (inputs.minDate) params.set('minDate', inputs.minDate);
                if (inputs.maxDate) params.set('maxDate', inputs.maxDate);
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                if (inputs.appointmentTypeID) params.set('appointmentTypeID', String(inputs.appointmentTypeID));
                if (inputs.max) params.set('max', String(inputs.max));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/appointments${query}`);
                logger.log(`[Acuity] Listed ${Array.isArray(data) ? data.length : 0} appointments`);
                return { output: { appointments: data, count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getAppointment': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/appointments/${id}`);
                return { output: data };
            }

            case 'createAppointment': {
                const body: any = {
                    datetime: inputs.datetime,
                    appointmentTypeID: inputs.appointmentTypeID,
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    email: inputs.email,
                };
                if (inputs.phone !== undefined) body.phone = inputs.phone;
                if (inputs.calendarID !== undefined) body.calendarID = inputs.calendarID;
                if (inputs.fields !== undefined) body.fields = inputs.fields;
                const data = await req('POST', '/appointments', body);
                logger.log(`[Acuity] Created appointment: ${data.id}`);
                return { output: data };
            }

            case 'cancelAppointment': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: any = {};
                if (inputs.noShow !== undefined) body.noShow = inputs.noShow;
                const data = await req('PUT', `/appointments/${id}/cancel`, body);
                logger.log(`[Acuity] Cancelled appointment: ${id}`);
                return { output: data };
            }

            case 'rescheduleAppointment': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!inputs.datetime) throw new Error('datetime is required.');
                const data = await req('PUT', `/appointments/${id}/reschedule`, { datetime: inputs.datetime });
                logger.log(`[Acuity] Rescheduled appointment: ${id}`);
                return { output: data };
            }

            case 'listAppointmentTypes': {
                const data = await req('GET', '/appointment-types');
                return { output: { appointmentTypes: data, count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'listAvailability': {
                const params = new URLSearchParams();
                if (inputs.date) params.set('date', inputs.date);
                if (inputs.appointmentTypeID) params.set('appointmentTypeID', String(inputs.appointmentTypeID));
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                if (inputs.timezone) params.set('timezone', inputs.timezone);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/availability/times${query}`);
                return { output: { times: data, count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'listForms': {
                const data = await req('GET', '/forms');
                return { output: { forms: data, count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getFormSubmission': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/form-submissions/${id}`);
                return { output: data };
            }

            case 'listCalendars': {
                const data = await req('GET', '/calendars');
                return { output: { calendars: data, count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getCalendar': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/calendars/${id}`);
                return { output: data };
            }

            case 'listBlocks': {
                const params = new URLSearchParams();
                if (inputs.minDate) params.set('minDate', inputs.minDate);
                if (inputs.maxDate) params.set('maxDate', inputs.maxDate);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/blocks${query}`);
                return { output: { blocks: data, count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'createBlock': {
                const body: any = {};
                if (inputs.calendarID !== undefined) body.calendarID = inputs.calendarID;
                if (inputs.start !== undefined) body.start = inputs.start;
                if (inputs.end !== undefined) body.end = inputs.end;
                if (inputs.notes !== undefined) body.notes = inputs.notes;
                const data = await req('POST', '/blocks', body);
                logger.log(`[Acuity] Created block: ${data.id}`);
                return { output: data };
            }

            case 'deleteBlock': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('DELETE', `/blocks/${id}`);
                logger.log(`[Acuity] Deleted block: ${id}`);
                return { output: { id, status: 'deleted', ...data } };
            }

            default:
                throw new Error(`Unknown Acuity action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
