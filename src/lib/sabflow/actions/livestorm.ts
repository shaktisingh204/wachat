'use server';

export async function executeLivestormAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://api.livestorm.co/v1';
        const apiKey = String(inputs.apiKey ?? '').trim();

        const headers: Record<string, string> = {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page[number]', String(inputs.page));
                if (inputs.perPage) params.set('page[size]', String(inputs.perPage));
                const res = await fetch(`${BASE}/events?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { events: data.data, meta: data.meta } };
            }
            case 'getEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const res = await fetch(`${BASE}/events/${eventId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { event: data.data } };
            }
            case 'createEvent': {
                const body: Record<string, any> = {
                    data: {
                        type: 'event',
                        attributes: {
                            title: inputs.title,
                            slug: inputs.slug,
                            description: inputs.description,
                            language: inputs.language || 'en',
                            estimated_duration: inputs.estimatedDuration,
                            registration_required: inputs.registrationRequired !== false,
                        },
                    },
                };
                const res = await fetch(`${BASE}/events`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { event: data.data } };
            }
            case 'updateEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const attributes: Record<string, any> = {};
                if (inputs.title !== undefined) attributes.title = inputs.title;
                if (inputs.description !== undefined) attributes.description = inputs.description;
                if (inputs.estimatedDuration !== undefined) attributes.estimated_duration = inputs.estimatedDuration;
                if (inputs.registrationRequired !== undefined) attributes.registration_required = inputs.registrationRequired;
                const res = await fetch(`${BASE}/events/${eventId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ data: { type: 'event', attributes } }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { event: data.data } };
            }
            case 'deleteEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const res = await fetch(`${BASE}/events/${eventId}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                }
                return { output: { success: true, eventId } };
            }
            case 'listSessions': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page[number]', String(inputs.page));
                if (inputs.perPage) params.set('page[size]', String(inputs.perPage));
                const res = await fetch(`${BASE}/events/${eventId}/sessions?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { sessions: data.data, meta: data.meta } };
            }
            case 'getSession': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                const res = await fetch(`${BASE}/sessions/${sessionId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { session: data.data } };
            }
            case 'createSession': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                if (!inputs.startedAt) throw new Error('startedAt is required.');
                const body = {
                    data: {
                        type: 'session',
                        attributes: {
                            started_at: inputs.startedAt,
                            timezone: inputs.timezone || 'UTC',
                        },
                    },
                };
                const res = await fetch(`${BASE}/events/${eventId}/sessions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { session: data.data } };
            }
            case 'updateSession': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                const attributes: Record<string, any> = {};
                if (inputs.startedAt !== undefined) attributes.started_at = inputs.startedAt;
                if (inputs.timezone !== undefined) attributes.timezone = inputs.timezone;
                const res = await fetch(`${BASE}/sessions/${sessionId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ data: { type: 'session', attributes } }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { session: data.data } };
            }
            case 'deleteSession': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                const res = await fetch(`${BASE}/sessions/${sessionId}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                }
                return { output: { success: true, sessionId } };
            }
            case 'listRegistrants': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page[number]', String(inputs.page));
                if (inputs.perPage) params.set('page[size]', String(inputs.perPage));
                const res = await fetch(`${BASE}/sessions/${sessionId}/registrants?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { registrants: data.data, meta: data.meta } };
            }
            case 'getRegistrant': {
                const registrantId = String(inputs.registrantId ?? '').trim();
                if (!registrantId) throw new Error('registrantId is required.');
                const res = await fetch(`${BASE}/registrants/${registrantId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { registrant: data.data } };
            }
            case 'registerAttendee': {
                const sessionId = String(inputs.sessionId ?? '').trim();
                if (!sessionId) throw new Error('sessionId is required.');
                if (!inputs.email) throw new Error('email is required.');
                const body = {
                    data: {
                        type: 'registrant',
                        attributes: {
                            email: inputs.email,
                            first_name: inputs.firstName,
                            last_name: inputs.lastName,
                            timezone: inputs.timezone || 'UTC',
                        },
                    },
                };
                const res = await fetch(`${BASE}/sessions/${sessionId}/registrants`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { registrant: data.data } };
            }
            case 'listPeople': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page[number]', String(inputs.page));
                if (inputs.perPage) params.set('page[size]', String(inputs.perPage));
                if (inputs.email) params.set('filter[email]', inputs.email);
                const res = await fetch(`${BASE}/people?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { people: data.data, meta: data.meta } };
            }
            case 'getPerson': {
                const personId = String(inputs.personId ?? '').trim();
                if (!personId) throw new Error('personId is required.');
                const res = await fetch(`${BASE}/people/${personId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.detail || `API error: ${res.status}`);
                return { output: { person: data.data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
