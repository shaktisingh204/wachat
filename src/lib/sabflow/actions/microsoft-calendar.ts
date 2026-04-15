'use server';

export async function executeMicrosoftCalendarAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const userId = String(inputs.userId ?? 'me').trim();
        const baseUrl = `https://graph.microsoft.com/v1.0/users/${userId}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function graphRequest(method: string, path: string, body?: any) {
            logger?.log(`[MicrosoftCalendar] ${method} ${path}`);
            const opts: RequestInit = { method, headers };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.message || `Graph error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listCalendars': {
                const data = await graphRequest('GET', '/calendars');
                return { output: { calendars: data.value ?? [] } };
            }

            case 'getCalendar': {
                const calendarId = String(inputs.calendarId ?? '').trim();
                if (!calendarId) throw new Error('calendarId is required.');
                const data = await graphRequest('GET', `/calendars/${calendarId}`);
                return { output: data };
            }

            case 'createCalendar': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await graphRequest('POST', '/calendars', {
                    name,
                    color: inputs.color ? String(inputs.color) : undefined,
                });
                return { output: data };
            }

            case 'updateCalendar': {
                const calendarId = String(inputs.calendarId ?? '').trim();
                if (!calendarId) throw new Error('calendarId is required.');
                const patch: any = {};
                if (inputs.name) patch.name = String(inputs.name);
                if (inputs.color) patch.color = String(inputs.color);
                const data = await graphRequest('PATCH', `/calendars/${calendarId}`, patch);
                return { output: data };
            }

            case 'deleteCalendar': {
                const calendarId = String(inputs.calendarId ?? '').trim();
                if (!calendarId) throw new Error('calendarId is required.');
                await graphRequest('DELETE', `/calendars/${calendarId}`);
                return { output: { success: true, deleted: calendarId } };
            }

            case 'listEvents': {
                const calendarId = inputs.calendarId ? String(inputs.calendarId).trim() : null;
                const top = Math.max(1, Math.min(100, Number(inputs.top ?? 20)));
                const startDateTime = inputs.startDateTime ? `startDateTime=${encodeURIComponent(String(inputs.startDateTime))}&` : '';
                const endDateTime = inputs.endDateTime ? `endDateTime=${encodeURIComponent(String(inputs.endDateTime))}&` : '';
                const path = calendarId
                    ? `/calendars/${calendarId}/calendarView?${startDateTime}${endDateTime}$top=${top}`
                    : `/events?$top=${top}&$orderby=start/dateTime`;
                const data = await graphRequest('GET', path);
                return { output: { events: data.value ?? [], nextLink: data['@odata.nextLink'] ?? null } };
            }

            case 'getEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const data = await graphRequest('GET', `/events/${eventId}`);
                return { output: data };
            }

            case 'createEvent': {
                const subject = String(inputs.subject ?? '').trim();
                const startDateTime = String(inputs.startDateTime ?? '').trim();
                const endDateTime = String(inputs.endDateTime ?? '').trim();
                if (!subject || !startDateTime || !endDateTime) throw new Error('subject, startDateTime, and endDateTime are required.');
                const event: any = {
                    subject,
                    start: { dateTime: startDateTime, timeZone: String(inputs.timeZone ?? 'UTC') },
                    end: { dateTime: endDateTime, timeZone: String(inputs.timeZone ?? 'UTC') },
                };
                if (inputs.body) event.body = { contentType: String(inputs.bodyType ?? 'HTML'), content: String(inputs.body) };
                if (inputs.location) event.location = { displayName: String(inputs.location) };
                if (inputs.attendees) {
                    const emails = Array.isArray(inputs.attendees) ? inputs.attendees : String(inputs.attendees).split(',');
                    event.attendees = emails.map((e: string) => ({ emailAddress: { address: e.trim() }, type: 'required' }));
                }
                if (inputs.isOnlineMeeting) event.isOnlineMeeting = true;
                const calendarId = inputs.calendarId ? String(inputs.calendarId).trim() : null;
                const path = calendarId ? `/calendars/${calendarId}/events` : '/events';
                const data = await graphRequest('POST', path, event);
                return { output: data };
            }

            case 'updateEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const patch: any = {};
                if (inputs.subject) patch.subject = String(inputs.subject);
                if (inputs.startDateTime) patch.start = { dateTime: String(inputs.startDateTime), timeZone: String(inputs.timeZone ?? 'UTC') };
                if (inputs.endDateTime) patch.end = { dateTime: String(inputs.endDateTime), timeZone: String(inputs.timeZone ?? 'UTC') };
                if (inputs.body) patch.body = { contentType: String(inputs.bodyType ?? 'HTML'), content: String(inputs.body) };
                if (inputs.location) patch.location = { displayName: String(inputs.location) };
                const data = await graphRequest('PATCH', `/events/${eventId}`, patch);
                return { output: data };
            }

            case 'deleteEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                await graphRequest('DELETE', `/events/${eventId}`);
                return { output: { success: true, deleted: eventId } };
            }

            case 'acceptEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                await graphRequest('POST', `/events/${eventId}/accept`, {
                    comment: inputs.comment ? String(inputs.comment) : '',
                    sendResponse: inputs.sendResponse !== false,
                });
                return { output: { success: true, accepted: eventId } };
            }

            case 'declineEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                await graphRequest('POST', `/events/${eventId}/decline`, {
                    comment: inputs.comment ? String(inputs.comment) : '',
                    sendResponse: inputs.sendResponse !== false,
                });
                return { output: { success: true, declined: eventId } };
            }

            case 'listCalendarGroups': {
                const data = await graphRequest('GET', '/calendarGroups');
                return { output: { calendarGroups: data.value ?? [] } };
            }

            case 'createCalendarGroup': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await graphRequest('POST', '/calendarGroups', { name });
                return { output: data };
            }

            case 'findMeetingTimes': {
                const attendees = inputs.attendees
                    ? (Array.isArray(inputs.attendees) ? inputs.attendees : String(inputs.attendees).split(','))
                        .map((e: string) => ({ emailAddress: { address: e.trim() }, type: 'required' }))
                    : [];
                const timeConstraint = inputs.startDateTime && inputs.endDateTime
                    ? {
                        activityDomain: String(inputs.activityDomain ?? 'work'),
                        timeslots: [{ start: { dateTime: String(inputs.startDateTime), timeZone: String(inputs.timeZone ?? 'UTC') }, end: { dateTime: String(inputs.endDateTime), timeZone: String(inputs.timeZone ?? 'UTC') } }],
                    }
                    : undefined;
                const body: any = { attendees };
                if (timeConstraint) body.timeConstraint = timeConstraint;
                if (inputs.meetingDuration) body.meetingDuration = String(inputs.meetingDuration);
                const data = await graphRequest('POST', '/findMeetingTimes', body);
                return { output: { meetingTimeSuggestions: data.meetingTimeSuggestions ?? [], emptySuggestionsReason: data.emptySuggestionsReason ?? null } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
