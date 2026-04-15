'use server';

async function eventbriteFetch(
    privateToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Eventbrite] ${method} ${path}`);
    const BASE = 'https://www.eventbriteapi.com/v3';
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${privateToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            data?.error_description ?? data?.detail ?? data?.error ?? `Eventbrite API error: ${res.status}`
        );
    }
    return data;
}

export async function executeEventbriteAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const privateToken = String(inputs.privateToken ?? '').trim();
        if (!privateToken) throw new Error('privateToken is required.');

        const eb = (method: string, path: string, body?: any) =>
            eventbriteFetch(privateToken, method, path, body, logger);

        switch (actionName) {
            case 'getMe': {
                const data = await eb('GET', '/users/me/');
                return {
                    output: {
                        id: String(data.id ?? ''),
                        name: data.name ?? '',
                        email: data.emails?.[0]?.email ?? '',
                    },
                };
            }

            case 'getOrganizations': {
                const data = await eb('GET', '/users/me/organizations/');
                const organizations = (data.organizations ?? []).map((o: any) => ({
                    id: String(o.id ?? ''),
                    name: o.name ?? '',
                }));
                return { output: { organizations } };
            }

            case 'listEvents': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                params.set('time_filter', String(inputs.timeFilter ?? 'current_future'));
                params.set('page', String(inputs.pageNumber ?? 1));
                const data = await eb('GET', `/organizations/${organizationId}/events/?${params.toString()}`);
                const events = (data.events ?? []).map((e: any) => ({
                    id: String(e.id ?? ''),
                    name: e.name ?? {},
                    status: e.status ?? '',
                    start: e.start ?? {},
                    capacity: String(e.capacity ?? ''),
                }));
                return { output: { events, pagination: data.pagination ?? {} } };
            }

            case 'getEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const data = await eb('GET', `/events/${eventId}/`);
                return {
                    output: {
                        id: String(data.id ?? eventId),
                        name: data.name ?? {},
                        description: data.description ?? {},
                        status: data.status ?? '',
                        start: data.start ?? {},
                        end: data.end ?? {},
                        capacity: String(data.capacity ?? ''),
                        onlineEvent: String(data.online_event ?? false),
                    },
                };
            }

            case 'createEvent': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const start = String(inputs.start ?? '').trim();
                const end = String(inputs.end ?? '').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                if (!name) throw new Error('name is required.');
                if (!start) throw new Error('start is required.');
                if (!end) throw new Error('end is required.');
                const currency = String(inputs.currency ?? 'USD');
                const eventBody: Record<string, any> = {
                    name: { html: name },
                    start: { timezone: 'UTC', utc: start },
                    end: { timezone: 'UTC', utc: end },
                    currency,
                    online_event: inputs.isOnline === true || inputs.isOnline === 'true' ? true : false,
                };
                if (inputs.summary) eventBody.summary = String(inputs.summary);
                if (inputs.capacity !== undefined) eventBody.capacity = Number(inputs.capacity);
                const data = await eb('POST', `/organizations/${organizationId}/events/`, { event: eventBody });
                return {
                    output: {
                        id: String(data.id ?? ''),
                        name: data.name ?? {},
                    },
                };
            }

            case 'publishEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                await eb('POST', `/events/${eventId}/publish/`);
                return { output: { published: true } };
            }

            case 'cancelEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                await eb('POST', `/events/${eventId}/cancel/`);
                return { output: { canceled: true } };
            }

            case 'getOrders': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                params.set('page', String(inputs.pageNumber ?? 1));
                const data = await eb('GET', `/events/${eventId}/orders/?${params.toString()}`);
                const orders = (data.orders ?? []).map((o: any) => ({
                    id: String(o.id ?? ''),
                    name: o.name ?? '',
                    email: o.email ?? '',
                    costs: o.costs ?? {},
                }));
                return { output: { orders, pagination: data.pagination ?? {} } };
            }

            case 'getAttendees': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.pageNumber) params.set('page', String(inputs.pageNumber));
                const data = await eb('GET', `/events/${eventId}/attendees/?${params.toString()}`);
                const attendees = (data.attendees ?? []).map((a: any) => ({
                    id: String(a.id ?? ''),
                    profile: a.profile ?? {},
                    status: a.status ?? '',
                }));
                return { output: { attendees, pagination: data.pagination ?? {} } };
            }

            case 'getTicketClasses': {
                const eventId = String(inputs.eventId ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                const data = await eb('GET', `/events/${eventId}/ticket_classes/`);
                const ticketClasses = (data.ticket_classes ?? []).map((t: any) => ({
                    id: String(t.id ?? ''),
                    name: t.name ?? '',
                    free: String(t.free ?? false),
                    capacity: String(t.capacity ?? ''),
                    quantitySold: String(t.quantity_sold ?? 0),
                }));
                return { output: { ticketClasses } };
            }

            case 'createTicketClass': {
                const eventId = String(inputs.eventId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!eventId) throw new Error('eventId is required.');
                if (!name) throw new Error('name is required.');
                const isFree = inputs.free === true || inputs.free === 'true';
                const ticketClassBody: Record<string, any> = {
                    name,
                    free: isFree,
                };
                if (inputs.quantity !== undefined) ticketClassBody.quantity_total = Number(inputs.quantity);
                if (!isFree && inputs.cost !== undefined) {
                    // cost should be in format "USD,1000" (currency,cents)
                    ticketClassBody.cost = String(inputs.cost);
                }
                const data = await eb('POST', `/events/${eventId}/ticket_classes/`, { ticket_class: ticketClassBody });
                return {
                    output: {
                        id: String(data.id ?? ''),
                        name: data.name ?? name,
                    },
                };
            }

            case 'getVenues': {
                const organizationId = String(inputs.organizationId ?? '').trim();
                if (!organizationId) throw new Error('organizationId is required.');
                const data = await eb('GET', `/organizations/${organizationId}/venues/`);
                const venues = (data.venues ?? []).map((v: any) => ({
                    id: String(v.id ?? ''),
                    name: v.name ?? '',
                    address: v.address ?? {},
                }));
                return { output: { venues } };
            }

            default:
                return { error: `Eventbrite action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[Eventbrite] Error in ${actionName}: ${e.message}`);
        return { error: e.message || 'Eventbrite action failed.' };
    }
}
