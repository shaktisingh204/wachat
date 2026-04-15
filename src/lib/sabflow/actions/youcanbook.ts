'use server';

export async function executeYouCanBookAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://api.youcanbook.me/v1';
        const accountId = inputs.accountId;

        // Auth: Basic auth with accountId:password, or API token as password
        const password = inputs.password || inputs.apiToken || '';
        const basicAuth = Buffer.from(`${accountId}:${password}`).toString('base64');
        const headers: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProfiles': {
                const res = await fetch(`${baseUrl}/${accountId}/profiles`, { headers });
                if (!res.ok) return { error: `listProfiles failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getProfile': {
                const profileId = inputs.profileId;
                const res = await fetch(`${baseUrl}/${accountId}/profiles/${profileId}`, { headers });
                if (!res.ok) return { error: `getProfile failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listBookings': {
                const params = new URLSearchParams();
                if (inputs.status) params.append('status', inputs.status);
                if (inputs.start) params.append('start', inputs.start);
                if (inputs.end) params.append('end', inputs.end);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/${accountId}/bookings${query}`, { headers });
                if (!res.ok) return { error: `listBookings failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getBooking': {
                const bookingId = inputs.bookingId;
                const res = await fetch(`${baseUrl}/${accountId}/bookings/${bookingId}`, { headers });
                if (!res.ok) return { error: `getBooking failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'cancelBooking': {
                const bookingId = inputs.bookingId;
                const res = await fetch(`${baseUrl}/${accountId}/bookings/${bookingId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `cancelBooking failed: ${res.status} ${await res.text()}` };
                return { output: { success: true } };
            }
            case 'listAvailableSlots': {
                const profileId = inputs.profileId;
                const params = new URLSearchParams();
                if (inputs.start) params.append('start', inputs.start);
                if (inputs.end) params.append('end', inputs.end);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/${accountId}/profiles/${profileId}/slots${query}`, { headers });
                if (!res.ok) return { error: `listAvailableSlots failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createBooking': {
                const body = {
                    profileId: inputs.profileId,
                    slotStart: inputs.slotStart,
                    slotEnd: inputs.slotEnd,
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    email: inputs.email,
                };
                const res = await fetch(`${baseUrl}/${accountId}/bookings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createBooking failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateBooking': {
                const bookingId = inputs.bookingId;
                const res = await fetch(`${baseUrl}/${accountId}/bookings/${bookingId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.booking || {}),
                });
                if (!res.ok) return { error: `updateBooking failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTimezones': {
                const res = await fetch(`${baseUrl}/timezones`, { headers });
                if (!res.ok) return { error: `listTimezones failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getAccountInfo': {
                const res = await fetch(`${baseUrl}/${accountId}`, { headers });
                if (!res.ok) return { error: `getAccountInfo failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown YouCanBook.me action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeYouCanBookAction error: ${err.message}`);
        return { error: err.message || 'YouCanBook.me action failed' };
    }
}
