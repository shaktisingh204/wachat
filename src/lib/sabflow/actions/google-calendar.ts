
'use server';

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

async function gcalFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Google Calendar] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${GCAL_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `Google Calendar API error: ${res.status}`);
    }
    return data;
}

export async function executeGoogleCalendarAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const gcal = (method: string, path: string, body?: any) => gcalFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'createEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const summary = String(inputs.summary ?? '').trim();
                const startDateTime = String(inputs.startDateTime ?? '').trim();
                const endDateTime = String(inputs.endDateTime ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                const location = String(inputs.location ?? '').trim();
                const attendees = inputs.attendees;
                if (!summary || !startDateTime || !endDateTime) throw new Error('summary, startDateTime, and endDateTime are required.');
                const event: any = {
                    summary,
                    start: { dateTime: startDateTime, timeZone: inputs.timeZone ?? 'UTC' },
                    end: { dateTime: endDateTime, timeZone: inputs.timeZone ?? 'UTC' },
                };
                if (description) event.description = description;
                if (location) event.location = location;
                if (attendees) {
                    const attendeesArr = Array.isArray(attendees) ? attendees : String(attendees).split(',').map((e: string) => ({ email: e.trim() }));
                    event.attendees = attendeesArr;
                }
                const data = await gcal('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, event);
                return { output: { id: data.id, htmlLink: data.htmlLink, summary: data.summary, status: data.status } };
            }

            case 'getEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const data = await gcal('GET', `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
                return { output: { id: data.id, summary: data.summary, start: data.start?.dateTime ?? data.start?.date ?? '', end: data.end?.dateTime ?? data.end?.date ?? '', status: data.status } };
            }

            case 'updateEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const patch: any = {};
                if (inputs.summary) patch.summary = String(inputs.summary);
                if (inputs.description) patch.description = String(inputs.description);
                if (inputs.startDateTime) patch.start = { dateTime: String(inputs.startDateTime), timeZone: inputs.timeZone ?? 'UTC' };
                if (inputs.endDateTime) patch.end = { dateTime: String(inputs.endDateTime), timeZone: inputs.timeZone ?? 'UTC' };
                const data = await gcal('PATCH', `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, patch);
                return { output: { id: data.id, summary: data.summary, status: data.status } };
            }

            case 'deleteEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                await gcal('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`);
                return { output: { deleted: 'true', eventId } };
            }

            case 'listEvents': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const timeMin = String(inputs.timeMin ?? '').trim();
                const timeMax = String(inputs.timeMax ?? '').trim();
                const maxResults = Number(inputs.maxResults ?? 50);
                let path = `/calendars/${encodeURIComponent(calendarId)}/events?maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
                if (timeMin) path += `&timeMin=${encodeURIComponent(timeMin)}`;
                if (timeMax) path += `&timeMax=${encodeURIComponent(timeMax)}`;
                const data = await gcal('GET', path);
                return { output: { events: data.items ?? [], count: (data.items ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'quickAddEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');
                const data = await gcal('POST', `/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?text=${encodeURIComponent(text)}`);
                return { output: { id: data.id, summary: data.summary, htmlLink: data.htmlLink } };
            }

            case 'listCalendars': {
                const data = await gcal('GET', '/users/me/calendarList');
                return { output: { calendars: data.items ?? [], count: (data.items ?? []).length } };
            }

            case 'createCalendar': {
                const summary = String(inputs.summary ?? '').trim();
                const timeZone = String(inputs.timeZone ?? 'UTC').trim();
                if (!summary) throw new Error('summary is required.');
                const data = await gcal('POST', '/calendars', { summary, timeZone });
                return { output: { id: data.id, summary: data.summary, timeZone: data.timeZone } };
            }

            case 'checkAvailability': {
                const timeMin = String(inputs.timeMin ?? '').trim();
                const timeMax = String(inputs.timeMax ?? '').trim();
                const calendars = inputs.calendars;
                if (!timeMin || !timeMax || !calendars) throw new Error('timeMin, timeMax, and calendars are required.');
                const calArr = Array.isArray(calendars) ? calendars : String(calendars).split(',').map((c: string) => ({ id: c.trim() }));
                const body: any = { timeMin, timeMax, timeZone: inputs.timeZone ?? 'UTC', items: calArr };
                const data = await gcal('POST', '/freeBusy', body);
                return { output: { calendars: data.calendars ?? {}, timeMin: data.timeMin, timeMax: data.timeMax } };
            }

            case 'importEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const iCalUID = String(inputs.iCalUID ?? `uid_${Date.now()}@sabnode`).trim();
                const summary = String(inputs.summary ?? '').trim();
                const startDateTime = String(inputs.startDateTime ?? '').trim();
                const endDateTime = String(inputs.endDateTime ?? '').trim();
                if (!summary || !startDateTime || !endDateTime) throw new Error('summary, startDateTime, and endDateTime are required.');
                const event = { iCalUID, summary, start: { dateTime: startDateTime }, end: { dateTime: endDateTime } };
                const data = await gcal('POST', `/calendars/${encodeURIComponent(calendarId)}/events/import`, event);
                return { output: { id: data.id, summary: data.summary } };
            }

            default:
                return { error: `Google Calendar action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Google Calendar action failed.' };
    }
}
