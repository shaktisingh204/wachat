'use server';

export async function executeCalComAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const baseUrl = 'https://api.cal.com/v1';

        async function calFetch(method: string, path: string, body?: any) {
            const separator = path.includes('?') ? '&' : '?';
            const url = `${baseUrl}${path}${separator}apiKey=${encodeURIComponent(apiKey)}`;
            const options: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listEventTypes': {
                const data = await calFetch('GET', '/event-types');
                return { output: { eventTypes: data.event_types ?? data } };
            }
            case 'getEventType': {
                const id = inputs.eventTypeId ?? inputs.id;
                const data = await calFetch('GET', `/event-types/${id}`);
                return { output: { eventType: data.event_type ?? data } };
            }
            case 'createEventType': {
                const body = {
                    title: inputs.title,
                    slug: inputs.slug,
                    length: inputs.length,
                    description: inputs.description,
                    hidden: inputs.hidden,
                    locations: inputs.locations,
                };
                const data = await calFetch('POST', '/event-types', body);
                return { output: { eventType: data.event_type ?? data } };
            }
            case 'updateEventType': {
                const id = inputs.eventTypeId ?? inputs.id;
                const body: Record<string, any> = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.slug !== undefined) body.slug = inputs.slug;
                if (inputs.length !== undefined) body.length = inputs.length;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.hidden !== undefined) body.hidden = inputs.hidden;
                const data = await calFetch('PATCH', `/event-types/${id}`, body);
                return { output: { eventType: data.event_type ?? data } };
            }
            case 'deleteEventType': {
                const id = inputs.eventTypeId ?? inputs.id;
                const data = await calFetch('DELETE', `/event-types/${id}`);
                return { output: { result: data } };
            }
            case 'listBookings': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('take', String(inputs.limit));
                if (inputs.skip) params.set('skip', String(inputs.skip));
                const query = params.toString() ? `?${params}` : '';
                const data = await calFetch('GET', `/bookings${query}`);
                return { output: { bookings: data.bookings ?? data } };
            }
            case 'getBooking': {
                const id = inputs.bookingId ?? inputs.id;
                const data = await calFetch('GET', `/bookings/${id}`);
                return { output: { booking: data.booking ?? data } };
            }
            case 'createBooking': {
                const body = {
                    eventTypeId: inputs.eventTypeId,
                    start: inputs.start,
                    end: inputs.end,
                    responses: inputs.responses,
                    timeZone: inputs.timeZone,
                    language: inputs.language ?? 'en',
                    metadata: inputs.metadata,
                };
                const data = await calFetch('POST', '/bookings', body);
                return { output: { booking: data.booking ?? data } };
            }
            case 'cancelBooking': {
                const id = inputs.bookingId ?? inputs.id;
                const data = await calFetch('DELETE', `/bookings/${id}`);
                return { output: { result: data } };
            }
            case 'rescheduleBooking': {
                const id = inputs.bookingId ?? inputs.id;
                const body = {
                    start: inputs.start,
                    end: inputs.end,
                    rescheduleReason: inputs.rescheduleReason,
                };
                const data = await calFetch('POST', `/bookings/${id}/reschedule`, body);
                return { output: { booking: data.booking ?? data } };
            }
            case 'listAvailability': {
                const params = new URLSearchParams();
                if (inputs.dateFrom) params.set('dateFrom', inputs.dateFrom);
                if (inputs.dateTo) params.set('dateTo', inputs.dateTo);
                if (inputs.eventTypeId) params.set('eventTypeId', String(inputs.eventTypeId));
                if (inputs.username) params.set('username', inputs.username);
                const data = await calFetch('GET', `/availability?${params}`);
                return { output: { availability: data } };
            }
            case 'getAvailability': {
                const id = inputs.scheduleId ?? inputs.id;
                const params = new URLSearchParams();
                if (inputs.dateFrom) params.set('dateFrom', inputs.dateFrom);
                if (inputs.dateTo) params.set('dateTo', inputs.dateTo);
                const data = await calFetch('GET', `/schedules/${id}/availability?${params}`);
                return { output: { availability: data } };
            }
            case 'listSchedules': {
                const data = await calFetch('GET', '/schedules');
                return { output: { schedules: data.schedules ?? data } };
            }
            case 'getSchedule': {
                const id = inputs.scheduleId ?? inputs.id;
                const data = await calFetch('GET', `/schedules/${id}`);
                return { output: { schedule: data.schedule ?? data } };
            }
            case 'createSchedule': {
                const body = {
                    name: inputs.name,
                    timeZone: inputs.timeZone,
                    availability: inputs.availability,
                    isDefault: inputs.isDefault,
                };
                const data = await calFetch('POST', '/schedules', body);
                return { output: { schedule: data.schedule ?? data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
