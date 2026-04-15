'use server';

const BASE = 'https://www.googleapis.com/calendar/v3';

async function req(accessToken: string, method: string, url: string, body?: any, logger?: any) {
    logger?.log(`[GCalEnhanced] ${method} ${url}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Calendar API error ${res.status}`);
    return data;
}

export async function executeGoogleCalendarEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const g = (method: string, path: string, body?: any) => req(accessToken, method, `${BASE}${path}`, body, logger);

        switch (actionName) {
            case 'listCalendars': {
                const data = await g('GET', '/users/me/calendarList?fields=items(id,summary,description,primary,accessRole,backgroundColor),nextPageToken');
                return { output: { calendars: data.items ?? [], count: (data.items ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getCalendar': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const data = await g('GET', `/calendars/${encodeURIComponent(calendarId)}`);
                return { output: { id: data.id, summary: data.summary ?? '', description: data.description ?? '', timeZone: data.timeZone ?? '' } };
            }

            case 'createCalendar': {
                const summary = String(inputs.summary ?? '').trim();
                const timeZone = String(inputs.timeZone ?? 'UTC').trim();
                if (!summary) throw new Error('summary is required.');
                const body: any = { summary, timeZone };
                if (inputs.description) body.description = String(inputs.description);
                const data = await g('POST', '/calendars', body);
                return { output: { id: data.id, summary: data.summary, timeZone: data.timeZone ?? timeZone } };
            }

            case 'updateCalendar': {
                const calendarId = String(inputs.calendarId ?? '').trim();
                if (!calendarId) throw new Error('calendarId is required.');
                const body: any = {};
                if (inputs.summary) body.summary = String(inputs.summary).trim();
                if (inputs.description !== undefined) body.description = String(inputs.description);
                if (inputs.timeZone) body.timeZone = String(inputs.timeZone).trim();
                const data = await g('PATCH', `/calendars/${encodeURIComponent(calendarId)}`, body);
                return { output: { id: data.id, summary: data.summary ?? '', timeZone: data.timeZone ?? '' } };
            }

            case 'deleteCalendar': {
                const calendarId = String(inputs.calendarId ?? '').trim();
                if (!calendarId) throw new Error('calendarId is required.');
                await g('DELETE', `/calendars/${encodeURIComponent(calendarId)}`);
                return { output: { deleted: true, calendarId } };
            }

            case 'listEvents': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const timeMin = String(inputs.timeMin ?? '').trim();
                const timeMax = String(inputs.timeMax ?? '').trim();
                const maxResults = Number(inputs.maxResults ?? 25);
                const pageToken = String(inputs.pageToken ?? '').trim();
                let path = `/calendars/${encodeURIComponent(calendarId)}/events?maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
                if (timeMin) path += `&timeMin=${encodeURIComponent(timeMin)}`;
                if (timeMax) path += `&timeMax=${encodeURIComponent(timeMax)}`;
                if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
                const data = await g('GET', path);
                return { output: { events: data.items ?? [], count: (data.items ?? []).length, nextPageToken: data.nextPageToken ?? '', summary: data.summary ?? '' } };
            }

            case 'getEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const data = await g('GET', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
                return { output: { id: data.id, summary: data.summary ?? '', start: data.start ?? {}, end: data.end ?? {}, description: data.description ?? '', status: data.status ?? '', htmlLink: data.htmlLink ?? '' } };
            }

            case 'createEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const summary = String(inputs.summary ?? '').trim();
                if (!summary) throw new Error('summary is required.');
                const body: any = {
                    summary,
                    start: inputs.start ?? { dateTime: new Date().toISOString(), timeZone: 'UTC' },
                    end: inputs.end ?? { dateTime: new Date(Date.now() + 3600000).toISOString(), timeZone: 'UTC' },
                };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.location) body.location = String(inputs.location);
                if (inputs.attendees) body.attendees = inputs.attendees;
                if (inputs.recurrence) body.recurrence = inputs.recurrence;
                const data = await g('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, body);
                return { output: { id: data.id, summary: data.summary, htmlLink: data.htmlLink ?? '', start: data.start ?? {}, end: data.end ?? {} } };
            }

            case 'updateEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const body: any = {};
                if (inputs.summary) body.summary = String(inputs.summary).trim();
                if (inputs.description !== undefined) body.description = String(inputs.description);
                if (inputs.start) body.start = inputs.start;
                if (inputs.end) body.end = inputs.end;
                if (inputs.location) body.location = String(inputs.location);
                if (inputs.attendees) body.attendees = inputs.attendees;
                const data = await g('PATCH', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, body);
                return { output: { id: data.id, summary: data.summary ?? '', start: data.start ?? {}, end: data.end ?? {}, htmlLink: data.htmlLink ?? '' } };
            }

            case 'deleteEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!calendarId || !eventId) throw new Error('calendarId and eventId are required.');
                await g('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
                return { output: { deleted: true, calendarId, eventId } };
            }

            case 'quickAddEvent': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');
                const data = await g('POST', `/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?text=${encodeURIComponent(text)}`, undefined);
                return { output: { id: data.id, summary: data.summary ?? '', start: data.start ?? {}, end: data.end ?? {}, htmlLink: data.htmlLink ?? '' } };
            }

            case 'watchEvents': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const id = String(inputs.channelId ?? '').trim();
                const address = String(inputs.webhookUrl ?? '').trim();
                if (!id || !address) throw new Error('channelId and webhookUrl are required.');
                const data = await g('POST', `/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
                    id,
                    type: 'web_hook',
                    address,
                    expiration: inputs.expiration ?? String(Date.now() + 604800000),
                });
                return { output: { channelId: data.id ?? id, resourceId: data.resourceId ?? '', expiration: data.expiration ?? '' } };
            }

            case 'listAcl': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const data = await g('GET', `/calendars/${encodeURIComponent(calendarId)}/acl`);
                return { output: { items: data.items ?? [], count: (data.items ?? []).length } };
            }

            case 'insertAcl': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const role = String(inputs.role ?? 'reader').trim();
                const scopeType = String(inputs.scopeType ?? 'user').trim();
                const scopeValue = String(inputs.scopeValue ?? '').trim();
                if (!scopeValue) throw new Error('scopeValue is required.');
                const data = await g('POST', `/calendars/${encodeURIComponent(calendarId)}/acl`, {
                    role,
                    scope: { type: scopeType, value: scopeValue },
                });
                return { output: { id: data.id, role: data.role ?? role, scope: data.scope ?? {} } };
            }

            case 'deleteAcl': {
                const calendarId = String(inputs.calendarId ?? 'primary').trim();
                const ruleId = String(inputs.ruleId ?? '').trim();
                if (!calendarId || !ruleId) throw new Error('calendarId and ruleId are required.');
                await g('DELETE', `/calendars/${encodeURIComponent(calendarId)}/acl/${encodeURIComponent(ruleId)}`);
                return { output: { deleted: true, calendarId, ruleId } };
            }

            default:
                return { error: `Google Calendar Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Google Calendar Enhanced action failed.' };
    }
}
