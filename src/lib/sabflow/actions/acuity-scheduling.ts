'use server';

export async function executeAcuitySchedulingAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const userId = String(inputs.userId ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        const basicAuth = Buffer.from(`${userId}:${apiKey}`).toString('base64');
        const baseUrl = 'https://acuityscheduling.com/api/v1';
        const headers: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listAppointments': {
                const params = new URLSearchParams();
                if (inputs.minDate) params.set('minDate', inputs.minDate);
                if (inputs.maxDate) params.set('maxDate', inputs.maxDate);
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                if (inputs.appointmentTypeID) params.set('appointmentTypeID', String(inputs.appointmentTypeID));
                if (inputs.max) params.set('max', String(inputs.max));
                const res = await fetch(`${baseUrl}/appointments?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { appointments: data } };
            }
            case 'getAppointment': {
                const appointmentId = inputs.appointmentId ?? inputs.id;
                const res = await fetch(`${baseUrl}/appointments/${appointmentId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { appointment: data } };
            }
            case 'createAppointment': {
                const body = {
                    appointmentTypeID: inputs.appointmentTypeID,
                    datetime: inputs.datetime,
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    email: inputs.email,
                    phone: inputs.phone,
                    calendarID: inputs.calendarID,
                    fields: inputs.fields,
                };
                const res = await fetch(`${baseUrl}/appointments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { appointment: data } };
            }
            case 'cancelAppointment': {
                const appointmentId = inputs.appointmentId ?? inputs.id;
                const res = await fetch(`${baseUrl}/appointments/${appointmentId}/cancel`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ noEmail: inputs.noEmail ?? false }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { appointment: data } };
            }
            case 'rescheduleAppointment': {
                const appointmentId = inputs.appointmentId ?? inputs.id;
                const res = await fetch(`${baseUrl}/appointments/${appointmentId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ datetime: inputs.datetime, calendarID: inputs.calendarID }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { appointment: data } };
            }
            case 'listAppointmentTypes': {
                const res = await fetch(`${baseUrl}/appointment-types`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { appointmentTypes: data } };
            }
            case 'getAppointmentType': {
                const typeId = inputs.appointmentTypeId ?? inputs.id;
                const res = await fetch(`${baseUrl}/appointment-types/${typeId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { appointmentType: data } };
            }
            case 'listCalendars': {
                const res = await fetch(`${baseUrl}/calendars`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { calendars: data } };
            }
            case 'getCalendar': {
                const calendarId = inputs.calendarId ?? inputs.id;
                const res = await fetch(`${baseUrl}/calendars/${calendarId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { calendar: data } };
            }
            case 'listAvailableTimes': {
                const params = new URLSearchParams({
                    month: String(inputs.month),
                    appointmentTypeID: String(inputs.appointmentTypeID),
                });
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                if (inputs.timezone) params.set('timezone', inputs.timezone);
                const res = await fetch(`${baseUrl}/availability/times?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { times: data } };
            }
            case 'listAvailableDates': {
                const params = new URLSearchParams({
                    month: String(inputs.month),
                    appointmentTypeID: String(inputs.appointmentTypeID),
                });
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                const res = await fetch(`${baseUrl}/availability/dates?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { dates: data } };
            }
            case 'getClientFields': {
                const res = await fetch(`${baseUrl}/forms`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { forms: data } };
            }
            case 'createClient': {
                const body = {
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    email: inputs.email,
                    phone: inputs.phone,
                    fields: inputs.fields,
                };
                const res = await fetch(`${baseUrl}/clients`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { client: data } };
            }
            case 'listForms': {
                const res = await fetch(`${baseUrl}/forms`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { forms: data } };
            }
            case 'getForm': {
                const formId = inputs.formId ?? inputs.id;
                const res = await fetch(`${baseUrl}/forms/${formId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { form: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
