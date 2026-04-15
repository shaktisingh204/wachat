'use server';

const ACUITY_BASE = 'https://acuityscheduling.com/api/v1';

async function acuityFetch(userId: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Acuity Enhanced] ${method} ${path}`);
    const credentials = `${userId}:${apiKey}`;
    const encoded = Buffer.from(credentials).toString('base64');
    const url = path.startsWith('http') ? path : `${ACUITY_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Basic ${encoded}`,
            'Content-Type': 'application/json',
        },
    };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (res.status === 204) return { success: true };
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}: ${text}`);
    return data;
}

export async function executeAcuityEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const userId = inputs.userId;
        const apiKey = inputs.apiKey;
        if (!userId || !apiKey) return { error: 'Missing userId or apiKey' };

        switch (actionName) {
            case 'listAppointments': {
                const params = new URLSearchParams();
                if (inputs.max) params.set('max', String(inputs.max));
                if (inputs.minDate) params.set('minDate', inputs.minDate);
                if (inputs.maxDate) params.set('maxDate', inputs.maxDate);
                if (inputs.appointmentTypeID) params.set('appointmentTypeID', String(inputs.appointmentTypeID));
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                if (inputs.firstName) params.set('firstName', inputs.firstName);
                if (inputs.lastName) params.set('lastName', inputs.lastName);
                if (inputs.email) params.set('email', inputs.email);
                const data = await acuityFetch(userId, apiKey, 'GET', `/appointments?${params}`, undefined, logger);
                return { output: { appointments: data } };
            }
            case 'getAppointment': {
                const id = inputs.appointmentId;
                if (!id) return { error: 'Missing appointmentId' };
                const data = await acuityFetch(userId, apiKey, 'GET', `/appointments/${id}`, undefined, logger);
                return { output: data };
            }
            case 'createAppointment': {
                const body = {
                    datetime: inputs.datetime,
                    appointmentTypeID: inputs.appointmentTypeID,
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    email: inputs.email,
                    ...(inputs.phone ? { phone: inputs.phone } : {}),
                    ...(inputs.calendarID ? { calendarID: inputs.calendarID } : {}),
                    ...(inputs.notes ? { notes: inputs.notes } : {}),
                    ...(inputs.fields ? { fields: inputs.fields } : {}),
                };
                if (!body.datetime || !body.appointmentTypeID || !body.firstName || !body.lastName || !body.email) {
                    return { error: 'Missing required fields: datetime, appointmentTypeID, firstName, lastName, email' };
                }
                const data = await acuityFetch(userId, apiKey, 'POST', '/appointments', body, logger);
                return { output: data };
            }
            case 'updateAppointment': {
                const id = inputs.appointmentId;
                if (!id) return { error: 'Missing appointmentId' };
                const body: any = {};
                if (inputs.datetime) body.datetime = inputs.datetime;
                if (inputs.calendarID) body.calendarID = inputs.calendarID;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.firstName) body.firstName = inputs.firstName;
                if (inputs.lastName) body.lastName = inputs.lastName;
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.fields) body.fields = inputs.fields;
                const data = await acuityFetch(userId, apiKey, 'PUT', `/appointments/${id}`, body, logger);
                return { output: data };
            }
            case 'cancelAppointment': {
                const id = inputs.appointmentId;
                if (!id) return { error: 'Missing appointmentId' };
                const body: any = {};
                if (inputs.cancelNote) body.cancelNote = inputs.cancelNote;
                const data = await acuityFetch(userId, apiKey, 'PUT', `/appointments/${id}/cancel`, body, logger);
                return { output: data };
            }
            case 'listAppointmentTypes': {
                const data = await acuityFetch(userId, apiKey, 'GET', '/appointment-types', undefined, logger);
                return { output: { appointmentTypes: data } };
            }
            case 'getAppointmentType': {
                const id = inputs.appointmentTypeId;
                if (!id) return { error: 'Missing appointmentTypeId' };
                const data = await acuityFetch(userId, apiKey, 'GET', `/appointment-types/${id}`, undefined, logger);
                return { output: data };
            }
            case 'listCalendars': {
                const data = await acuityFetch(userId, apiKey, 'GET', '/calendars', undefined, logger);
                return { output: { calendars: data } };
            }
            case 'getCalendar': {
                const id = inputs.calendarId;
                if (!id) return { error: 'Missing calendarId' };
                const data = await acuityFetch(userId, apiKey, 'GET', `/calendars/${id}`, undefined, logger);
                return { output: data };
            }
            case 'listBlocks': {
                const params = new URLSearchParams();
                if (inputs.minDate) params.set('minDate', inputs.minDate);
                if (inputs.maxDate) params.set('maxDate', inputs.maxDate);
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                const data = await acuityFetch(userId, apiKey, 'GET', `/blocks?${params}`, undefined, logger);
                return { output: { blocks: data } };
            }
            case 'createBlock': {
                const body = {
                    start: inputs.start,
                    end: inputs.end,
                    calendarID: inputs.calendarID,
                    ...(inputs.notes ? { notes: inputs.notes } : {}),
                };
                if (!body.start || !body.end || !body.calendarID) {
                    return { error: 'Missing start, end, or calendarID' };
                }
                const data = await acuityFetch(userId, apiKey, 'POST', '/blocks', body, logger);
                return { output: data };
            }
            case 'deleteBlock': {
                const id = inputs.blockId;
                if (!id) return { error: 'Missing blockId' };
                const data = await acuityFetch(userId, apiKey, 'DELETE', `/blocks/${id}`, undefined, logger);
                return { output: { success: true, data } };
            }
            case 'checkAvailability': {
                const params = new URLSearchParams();
                if (inputs.appointmentTypeID) params.set('appointmentTypeID', String(inputs.appointmentTypeID));
                if (inputs.month) params.set('month', inputs.month);
                if (inputs.calendarID) params.set('calendarID', String(inputs.calendarID));
                const data = await acuityFetch(userId, apiKey, 'GET', `/availability/times?${params}`, undefined, logger);
                return { output: { availability: data } };
            }
            case 'listForms': {
                const data = await acuityFetch(userId, apiKey, 'GET', '/forms', undefined, logger);
                return { output: { forms: data } };
            }
            case 'getClient': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.firstName) params.set('firstName', inputs.firstName);
                if (inputs.lastName) params.set('lastName', inputs.lastName);
                const data = await acuityFetch(userId, apiKey, 'GET', `/clients?${params}`, undefined, logger);
                return { output: { clients: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Acuity Enhanced] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
