'use server';

async function bevyFetch(apiKey: string, domain: string, method: string, path: string, body?: any, logger?: any) {
    const baseUrl = `https://${domain}.bevy.com/api/v1`;
    logger?.log(`[Bevy] ${method} ${baseUrl}${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Bevy API error: ${res.status}`);
    }
    return data;
}

export async function executeBevyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const domain = String(inputs.domain ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!domain) throw new Error('domain is required.');
        const bevy = (method: string, path: string, body?: any) => bevyFetch(apiKey, domain, method, path, body, logger);

        switch (actionName) {
            case 'listChapters': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await bevy('GET', `/chapter${query}`);
                return { output: { chapters: data.results ?? data } };
            }

            case 'getChapter': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                const data = await bevy('GET', `/chapter/${chapterId}`);
                return { output: data };
            }

            case 'createChapter': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.slug) body.slug = inputs.slug;
                if (inputs.country) body.country = inputs.country;
                if (inputs.city) body.city = inputs.city;
                if (inputs.description) body.description = inputs.description;
                const data = await bevy('POST', '/chapter', body);
                return { output: data };
            }

            case 'updateChapter': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.country) body.country = inputs.country;
                if (inputs.city) body.city = inputs.city;
                const data = await bevy('PATCH', `/chapter/${chapterId}`, body);
                return { output: data };
            }

            case 'listEvents': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const query = params.toString() ? `?${params.toString()}` : '';
                const path = chapterId ? `/chapter/${chapterId}/event${query}` : `/event${query}`;
                const data = await bevy('GET', path);
                return { output: { events: data.results ?? data } };
            }

            case 'getEvent': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                if (!eventId) throw new Error('eventId is required.');
                const data = await bevy('GET', `/chapter/${chapterId}/event/${eventId}`);
                return { output: data };
            }

            case 'createEvent': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.endDate) body.end_date = inputs.endDate;
                if (inputs.description) body.description = inputs.description;
                if (inputs.eventUrl) body.event_url = inputs.eventUrl;
                if (inputs.visibility) body.visibility = inputs.visibility;
                const data = await bevy('POST', `/chapter/${chapterId}/event`, body);
                return { output: data };
            }

            case 'updateEvent': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                if (!eventId) throw new Error('eventId is required.');
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.endDate) body.end_date = inputs.endDate;
                if (inputs.description) body.description = inputs.description;
                const data = await bevy('PATCH', `/chapter/${chapterId}/event/${eventId}`, body);
                return { output: data };
            }

            case 'deleteEvent': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                if (!eventId) throw new Error('eventId is required.');
                await bevy('DELETE', `/chapter/${chapterId}/event/${eventId}`);
                return { output: { success: true, eventId } };
            }

            case 'listEventAttendees': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                if (!eventId) throw new Error('eventId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await bevy('GET', `/chapter/${chapterId}/event/${eventId}/rsvp${query}`);
                return { output: { attendees: data.results ?? data } };
            }

            case 'addAttendee': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                if (!eventId) throw new Error('eventId is required.');
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                const data = await bevy('POST', `/chapter/${chapterId}/event/${eventId}/rsvp`, body);
                return { output: data };
            }

            case 'removeAttendee': {
                const chapterId = String(inputs.chapterId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                const rsvpId = String(inputs.rsvpId ?? '').trim();
                if (!chapterId) throw new Error('chapterId is required.');
                if (!eventId) throw new Error('eventId is required.');
                if (!rsvpId) throw new Error('rsvpId is required.');
                await bevy('DELETE', `/chapter/${chapterId}/event/${eventId}/rsvp/${rsvpId}`);
                return { output: { success: true, rsvpId } };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.search) params.set('search', String(inputs.search));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await bevy('GET', `/user${query}`);
                return { output: { users: data.results ?? data } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await bevy('GET', `/user/${userId}`);
                return { output: data };
            }

            case 'createUser': {
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.role) body.role = inputs.role;
                const data = await bevy('POST', '/user', body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Bevy action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Bevy] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
