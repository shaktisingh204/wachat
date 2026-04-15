'use server';

const CALCOM_BASE = 'https://api.cal.com/v1';

async function calcomFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Cal.com] ${method} ${path}`);
    const separator = path.includes('?') ? '&' : '?';
    const url = method === 'GET'
        ? `${CALCOM_BASE}${path}${separator}apiKey=${apiKey}`
        : `${CALCOM_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (body && method !== 'GET') {
        options.body = JSON.stringify({ ...body, apiKey });
    }
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}: ${text}`);
    return data;
}

export async function executeCalcomAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        if (!apiKey) return { error: 'Missing apiKey' };

        switch (actionName) {
            case 'listEventTypes': {
                const params = new URLSearchParams();
                if (inputs.userId) params.set('userId', String(inputs.userId));
                const data = await calcomFetch(apiKey, 'GET', `/event-types?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getEventType': {
                const id = inputs.eventTypeId;
                if (!id) return { error: 'Missing eventTypeId' };
                const data = await calcomFetch(apiKey, 'GET', `/event-types/${id}`, undefined, logger);
                return { output: data };
            }
            case 'createEventType': {
                const body = {
                    title: inputs.title,
                    slug: inputs.slug,
                    length: inputs.length,
                    ...(inputs.description ? { description: inputs.description } : {}),
                    ...(inputs.locations ? { locations: inputs.locations } : {}),
                };
                if (!body.title || !body.slug || !body.length) {
                    return { error: 'Missing title, slug, or length' };
                }
                const data = await calcomFetch(apiKey, 'POST', '/event-types', body, logger);
                return { output: data };
            }
            case 'updateEventType': {
                const id = inputs.eventTypeId;
                if (!id) return { error: 'Missing eventTypeId' };
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.slug) body.slug = inputs.slug;
                if (inputs.length) body.length = inputs.length;
                if (inputs.description) body.description = inputs.description;
                if (inputs.locations) body.locations = inputs.locations;
                const data = await calcomFetch(apiKey, 'PATCH', `/event-types/${id}`, body, logger);
                return { output: data };
            }
            case 'deleteEventType': {
                const id = inputs.eventTypeId;
                if (!id) return { error: 'Missing eventTypeId' };
                const data = await calcomFetch(apiKey, 'DELETE', `/event-types/${id}`, undefined, logger);
                return { output: { success: true, data } };
            }
            case 'listBookings': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.take) params.set('take', String(inputs.take));
                if (inputs.skip) params.set('skip', String(inputs.skip));
                const data = await calcomFetch(apiKey, 'GET', `/bookings?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getBooking': {
                const id = inputs.bookingId;
                if (!id) return { error: 'Missing bookingId' };
                const data = await calcomFetch(apiKey, 'GET', `/bookings/${id}`, undefined, logger);
                return { output: data };
            }
            case 'createBooking': {
                const body = {
                    eventTypeId: inputs.eventTypeId,
                    start: inputs.start,
                    end: inputs.end,
                    name: inputs.name,
                    email: inputs.email,
                    ...(inputs.timeZone ? { timeZone: inputs.timeZone } : {}),
                    ...(inputs.language ? { language: inputs.language } : {}),
                    ...(inputs.metadata ? { metadata: inputs.metadata } : {}),
                };
                if (!body.eventTypeId || !body.start || !body.name || !body.email) {
                    return { error: 'Missing eventTypeId, start, name, or email' };
                }
                const data = await calcomFetch(apiKey, 'POST', '/bookings', body, logger);
                return { output: data };
            }
            case 'cancelBooking': {
                const id = inputs.bookingId;
                if (!id) return { error: 'Missing bookingId' };
                const body: any = {};
                if (inputs.reason) body.reason = inputs.reason;
                const data = await calcomFetch(apiKey, 'DELETE', `/bookings/${id}`, body, logger);
                return { output: { success: true, data } };
            }
            case 'rescheduleBooking': {
                const id = inputs.bookingId;
                if (!id) return { error: 'Missing bookingId' };
                const body = {
                    start: inputs.start,
                    end: inputs.end,
                    ...(inputs.reason ? { rescheduleReason: inputs.reason } : {}),
                };
                if (!body.start) return { error: 'Missing start' };
                const data = await calcomFetch(apiKey, 'PATCH', `/bookings/${id}`, body, logger);
                return { output: data };
            }
            case 'listAvailability': {
                const params = new URLSearchParams();
                if (inputs.eventTypeId) params.set('eventTypeId', String(inputs.eventTypeId));
                if (inputs.dateFrom) params.set('dateFrom', inputs.dateFrom);
                if (inputs.dateTo) params.set('dateTo', inputs.dateTo);
                const data = await calcomFetch(apiKey, 'GET', `/slots?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getAvailability': {
                const id = inputs.availabilityId;
                if (!id) return { error: 'Missing availabilityId' };
                const data = await calcomFetch(apiKey, 'GET', `/availabilities/${id}`, undefined, logger);
                return { output: data };
            }
            case 'listSchedules': {
                const data = await calcomFetch(apiKey, 'GET', '/schedules', undefined, logger);
                return { output: data };
            }
            case 'createSchedule': {
                const body = {
                    name: inputs.name,
                    timeZone: inputs.timeZone,
                    ...(inputs.availability ? { availability: inputs.availability } : {}),
                };
                if (!body.name || !body.timeZone) return { error: 'Missing name or timeZone' };
                const data = await calcomFetch(apiKey, 'POST', '/schedules', body, logger);
                return { output: data };
            }
            case 'listWebhooks': {
                const data = await calcomFetch(apiKey, 'GET', '/webhooks', undefined, logger);
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Cal.com] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
