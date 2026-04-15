
'use server';

async function lodgifyFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Lodgify] ${method} ${path}`);
    const url = `https://api.lodgify.com/v2${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'X-ApiKey': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Lodgify API error: ${res.status}`);
    }
    return data;
}

export async function executeLodgifyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const lf = (method: string, path: string, body?: any) => lodgifyFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listProperties': {
                const page = Number(inputs.page ?? 1);
                const size = Number(inputs.size ?? 25);
                const data = await lf('GET', `/properties?page=${page}&size=${size}`);
                return { output: { properties: Array.isArray(data) ? data : data.items ?? data, count: String(Array.isArray(data) ? data.length : data.count ?? 0) } };
            }

            case 'getProperty': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const data = await lf('GET', `/properties/${propertyId}`);
                return { output: { property: data } };
            }

            case 'createProperty': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.address) body.address = inputs.address;
                if (inputs.type) body.type = String(inputs.type);
                const data = await lf('POST', '/properties', body);
                return { output: { property: data, propertyId: String(data.id ?? '') } };
            }

            case 'updateProperty': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.address) body.address = inputs.address;
                const data = await lf('PUT', `/properties/${propertyId}`, body);
                return { output: { property: data } };
            }

            case 'listRooms': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const data = await lf('GET', `/properties/${propertyId}/rooms`);
                return { output: { rooms: Array.isArray(data) ? data : data.items ?? data } };
            }

            case 'getRoomTypes': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const data = await lf('GET', `/properties/${propertyId}/roomtypes`);
                return { output: { roomTypes: Array.isArray(data) ? data : data.items ?? data } };
            }

            case 'createRoomType': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!propertyId || !name) throw new Error('propertyId and name are required.');
                const body: any = { name };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.capacity) body.capacity = Number(inputs.capacity);
                const data = await lf('POST', `/properties/${propertyId}/roomtypes`, body);
                return { output: { roomType: data, roomTypeId: String(data.id ?? '') } };
            }

            case 'getAvailability': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const startDate = String(inputs.startDate ?? '').trim();
                const endDate = String(inputs.endDate ?? '').trim();
                if (!propertyId || !startDate || !endDate) throw new Error('propertyId, startDate, and endDate are required.');
                const data = await lf('GET', `/availability?propertyId=${propertyId}&startDate=${startDate}&endDate=${endDate}`);
                return { output: { availability: data } };
            }

            case 'updateAvailability': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const roomTypeId = String(inputs.roomTypeId ?? '').trim();
                if (!propertyId || !roomTypeId) throw new Error('propertyId and roomTypeId are required.');
                const body: any = {};
                if (inputs.periods) body.periods = inputs.periods;
                if (inputs.available !== undefined) body.available = inputs.available;
                const data = await lf('PUT', `/properties/${propertyId}/roomtypes/${roomTypeId}/availability`, body);
                return { output: { result: data } };
            }

            case 'listBookings': {
                const page = Number(inputs.page ?? 1);
                const size = Number(inputs.size ?? 25);
                const qs = [`page=${page}`, `size=${size}`];
                if (inputs.propertyId) qs.push(`propertyId=${inputs.propertyId}`);
                if (inputs.startDate) qs.push(`startDate=${inputs.startDate}`);
                if (inputs.endDate) qs.push(`endDate=${inputs.endDate}`);
                const data = await lf('GET', `/reservations?${qs.join('&')}`);
                return { output: { bookings: Array.isArray(data) ? data : data.items ?? data, count: String(Array.isArray(data) ? data.length : data.count ?? 0) } };
            }

            case 'getBooking': {
                const bookingId = String(inputs.bookingId ?? '').trim();
                if (!bookingId) throw new Error('bookingId is required.');
                const data = await lf('GET', `/reservations/${bookingId}`);
                return { output: { booking: data } };
            }

            case 'createBooking': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const arrivalDate = String(inputs.arrivalDate ?? '').trim();
                const departureDate = String(inputs.departureDate ?? '').trim();
                if (!propertyId || !arrivalDate || !departureDate) throw new Error('propertyId, arrivalDate, and departureDate are required.');
                const body: any = { propertyId, arrivalDate, departureDate };
                if (inputs.guestName) body.guestName = String(inputs.guestName);
                if (inputs.guestEmail) body.guestEmail = String(inputs.guestEmail);
                if (inputs.roomTypeId) body.roomTypeId = String(inputs.roomTypeId);
                if (inputs.adults) body.adults = Number(inputs.adults);
                if (inputs.children) body.children = Number(inputs.children);
                const data = await lf('POST', '/reservations', body);
                return { output: { booking: data, bookingId: String(data.id ?? '') } };
            }

            case 'updateBooking': {
                const bookingId = String(inputs.bookingId ?? '').trim();
                if (!bookingId) throw new Error('bookingId is required.');
                const body: any = {};
                if (inputs.arrivalDate) body.arrivalDate = String(inputs.arrivalDate);
                if (inputs.departureDate) body.departureDate = String(inputs.departureDate);
                if (inputs.guestName) body.guestName = String(inputs.guestName);
                if (inputs.guestEmail) body.guestEmail = String(inputs.guestEmail);
                const data = await lf('PUT', `/reservations/${bookingId}`, body);
                return { output: { booking: data } };
            }

            case 'cancelBooking': {
                const bookingId = String(inputs.bookingId ?? '').trim();
                if (!bookingId) throw new Error('bookingId is required.');
                await lf('DELETE', `/reservations/${bookingId}`);
                return { output: { cancelled: 'true', bookingId } };
            }

            case 'listRates': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                if (!propertyId) throw new Error('propertyId is required.');
                const data = await lf('GET', `/properties/${propertyId}/rates`);
                return { output: { rates: Array.isArray(data) ? data : data.items ?? data } };
            }

            case 'updateRates': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const roomTypeId = String(inputs.roomTypeId ?? '').trim();
                if (!propertyId || !roomTypeId) throw new Error('propertyId and roomTypeId are required.');
                const body: any = {};
                if (inputs.periods) body.periods = inputs.periods;
                if (inputs.minStay !== undefined) body.minStay = Number(inputs.minStay);
                const data = await lf('PUT', `/properties/${propertyId}/roomtypes/${roomTypeId}/rates`, body);
                return { output: { result: data } };
            }

            case 'getQuote': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const arrivalDate = String(inputs.arrivalDate ?? '').trim();
                const departureDate = String(inputs.departureDate ?? '').trim();
                if (!propertyId || !arrivalDate || !departureDate) throw new Error('propertyId, arrivalDate, and departureDate are required.');
                const qs = `propertyId=${propertyId}&arrivalDate=${arrivalDate}&departureDate=${departureDate}`;
                const data = await lf('GET', `/quotes?${qs}`);
                return { output: { quote: data } };
            }

            case 'createInquiry': {
                const propertyId = String(inputs.propertyId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!propertyId || !name || !email) throw new Error('propertyId, name, and email are required.');
                const body: any = { propertyId, name, email };
                if (inputs.message) body.message = String(inputs.message);
                if (inputs.arrivalDate) body.arrivalDate = String(inputs.arrivalDate);
                if (inputs.departureDate) body.departureDate = String(inputs.departureDate);
                const data = await lf('POST', '/inquiries', body);
                return { output: { inquiry: data, inquiryId: String(data.id ?? '') } };
            }

            default:
                return { error: `Lodgify action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Lodgify action failed.' };
    }
}
