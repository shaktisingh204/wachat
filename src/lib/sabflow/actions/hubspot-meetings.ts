'use server';

const HUBSPOT_BASE = 'https://api.hubapi.com/scheduler/v3';

async function hubspotFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[HubSpot Meetings] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${HUBSPOT_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
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

export async function executeHubspotMeetingsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = inputs.accessToken;
        if (!token) return { error: 'Missing accessToken' };

        switch (actionName) {
            case 'listMeetingsLinks': {
                const data = await hubspotFetch(token, 'GET', '/meetings/links', undefined, logger);
                return { output: data };
            }
            case 'getMeetingsLink': {
                const slug = inputs.slug;
                if (!slug) return { error: 'Missing slug' };
                const data = await hubspotFetch(token, 'GET', `/meetings/links/${slug}`, undefined, logger);
                return { output: data };
            }
            case 'createMeetingsLink': {
                const body = {
                    slug: inputs.slug,
                    name: inputs.name,
                    ...(inputs.duration ? { duration: inputs.duration } : {}),
                    ...(inputs.description ? { description: inputs.description } : {}),
                    ...(inputs.location ? { location: inputs.location } : {}),
                    ...(inputs.ownerId ? { ownerId: inputs.ownerId } : {}),
                };
                if (!body.slug || !body.name) return { error: 'Missing slug or name' };
                const data = await hubspotFetch(token, 'POST', '/meetings/links', body, logger);
                return { output: data };
            }
            case 'updateMeetingsLink': {
                const slug = inputs.slug;
                if (!slug) return { error: 'Missing slug' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.duration) body.duration = inputs.duration;
                if (inputs.description) body.description = inputs.description;
                if (inputs.location) body.location = inputs.location;
                const data = await hubspotFetch(token, 'PATCH', `/meetings/links/${slug}`, body, logger);
                return { output: data };
            }
            case 'deleteMeetingsLink': {
                const slug = inputs.slug;
                if (!slug) return { error: 'Missing slug' };
                const data = await hubspotFetch(token, 'DELETE', `/meetings/links/${slug}`, undefined, logger);
                return { output: { success: true, data } };
            }
            case 'listBookings': {
                const params = new URLSearchParams();
                if (inputs.slug) params.set('slug', inputs.slug);
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await hubspotFetch(token, 'GET', `/meetings/bookings?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getBooking': {
                const id = inputs.bookingId;
                if (!id) return { error: 'Missing bookingId' };
                const data = await hubspotFetch(token, 'GET', `/meetings/bookings/${id}`, undefined, logger);
                return { output: data };
            }
            case 'cancelBooking': {
                const id = inputs.bookingId;
                if (!id) return { error: 'Missing bookingId' };
                const body: any = {};
                if (inputs.reason) body.reason = inputs.reason;
                const data = await hubspotFetch(token, 'POST', `/meetings/bookings/${id}/cancel`, body, logger);
                return { output: { success: true, data } };
            }
            case 'listAvailability': {
                const slug = inputs.slug;
                if (!slug) return { error: 'Missing slug' };
                const params = new URLSearchParams({ slug });
                if (inputs.startTime) params.set('startTime', inputs.startTime);
                if (inputs.endTime) params.set('endTime', inputs.endTime);
                const data = await hubspotFetch(token, 'GET', `/meetings/availability?${params}`, undefined, logger);
                return { output: data };
            }
            case 'getOrganizer': {
                const id = inputs.organizerId;
                if (!id) return { error: 'Missing organizerId' };
                const data = await hubspotFetch(token, 'GET', `/meetings/organizers/${id}`, undefined, logger);
                return { output: data };
            }
            case 'listOrganizers': {
                const data = await hubspotFetch(token, 'GET', '/meetings/organizers', undefined, logger);
                return { output: data };
            }
            case 'updateOrganizer': {
                const id = inputs.organizerId;
                if (!id) return { error: 'Missing organizerId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.email) body.email = inputs.email;
                if (inputs.timeZone) body.timeZone = inputs.timeZone;
                const data = await hubspotFetch(token, 'PATCH', `/meetings/organizers/${id}`, body, logger);
                return { output: data };
            }
            case 'createBookingPage': {
                const body = {
                    name: inputs.name,
                    slug: inputs.slug,
                    ...(inputs.duration ? { duration: inputs.duration } : {}),
                    ...(inputs.ownerId ? { ownerId: inputs.ownerId } : {}),
                    ...(inputs.description ? { description: inputs.description } : {}),
                };
                if (!body.name || !body.slug) return { error: 'Missing name or slug' };
                const data = await hubspotFetch(token, 'POST', '/meetings/booking-pages', body, logger);
                return { output: data };
            }
            case 'listBookingPages': {
                const data = await hubspotFetch(token, 'GET', '/meetings/booking-pages', undefined, logger);
                return { output: data };
            }
            case 'getBookingPage': {
                const id = inputs.pageId;
                if (!id) return { error: 'Missing pageId' };
                const data = await hubspotFetch(token, 'GET', `/meetings/booking-pages/${id}`, undefined, logger);
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[HubSpot Meetings] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
