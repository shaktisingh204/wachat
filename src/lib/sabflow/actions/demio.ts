'use server';

export async function executeDemioAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://my.demio.com/api/v1';
        const apiKey = String(inputs.apiKey ?? '').trim();
        const apiSecret = String(inputs.apiSecret ?? '').trim();

        const headers: Record<string, string> = {
            'Api-Key': apiKey,
            'Api-Secret': apiSecret,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', String(inputs.type));
                const res = await fetch(`${BASE}/events?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { events: data } };
            }
            case 'getEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const res = await fetch(`${BASE}/events/${eventId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { event: data } };
            }
            case 'registerForEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                if (!inputs.email) throw new Error('email is required.');
                const body: Record<string, any> = {
                    email: inputs.email,
                    name: inputs.name,
                    date_id: inputs.dateId,
                };
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.customFields) body.custom_fields = inputs.customFields;
                const res = await fetch(`${BASE}/event/${eventId}/register`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { registration: data } };
            }
            case 'listRegistrants': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const params = new URLSearchParams();
                if (inputs.dateId) params.set('date_id', String(inputs.dateId));
                const res = await fetch(`${BASE}/event/${eventId}/registrants?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { registrants: data } };
            }
            case 'getRegistrant': {
                const eventId = String(inputs.eventId ?? '').trim();
                const registrantId = String(inputs.registrantId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                if (!registrantId) throw new Error('registrantId is required.');
                const res = await fetch(`${BASE}/event/${eventId}/registrant/${registrantId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { registrant: data } };
            }
            case 'listSessions': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const res = await fetch(`${BASE}/event/${eventId}/dates`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { sessions: data } };
            }
            case 'getSession': {
                const eventId = String(inputs.eventId ?? '').trim();
                const dateId = String(inputs.dateId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                if (!dateId) throw new Error('dateId is required.');
                const res = await fetch(`${BASE}/event/${eventId}/date/${dateId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { session: data } };
            }
            case 'listAttendees': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const params = new URLSearchParams();
                if (inputs.dateId) params.set('date_id', String(inputs.dateId));
                const res = await fetch(`${BASE}/event/${eventId}/attendees?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { attendees: data } };
            }
            case 'getAttendee': {
                const eventId = String(inputs.eventId ?? '').trim();
                const attendeeId = String(inputs.attendeeId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                if (!attendeeId) throw new Error('attendeeId is required.');
                const res = await fetch(`${BASE}/event/${eventId}/attendee/${attendeeId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { attendee: data } };
            }
            case 'createEvent': {
                if (!inputs.name) throw new Error('name is required.');
                const body: Record<string, any> = {
                    name: inputs.name,
                    type: inputs.type || 'standard',
                    description: inputs.description,
                    timezone: inputs.timezone || 'UTC',
                };
                if (inputs.dates) body.dates = inputs.dates;
                const res = await fetch(`${BASE}/events`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { event: data } };
            }
            case 'updateEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.timezone !== undefined) body.timezone = inputs.timezone;
                const res = await fetch(`${BASE}/events/${eventId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { event: data } };
            }
            case 'deleteEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const res = await fetch(`${BASE}/events/${eventId}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, eventId } };
            }
            case 'listReports': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', String(inputs.type));
                const res = await fetch(`${BASE}/reports?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { reports: data } };
            }
            case 'getReport': {
                const reportId = String(inputs.reportId ?? '').trim();
                if (!reportId) throw new Error('reportId is required.');
                const res = await fetch(`${BASE}/reports/${reportId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { report: data } };
            }
            case 'listCustomFields': {
                const params = new URLSearchParams();
                if (inputs.eventId) params.set('event_id', String(inputs.eventId));
                const res = await fetch(`${BASE}/custom-fields?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { customFields: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
