'use server';

export async function executeYouCanBookMeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const email = String(inputs.email ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        const basicAuth = Buffer.from(`${email}:${apiKey}`).toString('base64');
        const baseUrl = 'https://api.youcanbook.me';
        const headers: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProfiles': {
                const res = await fetch(`${baseUrl}/v1/profiles`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { profiles: data } };
            }
            case 'getProfile': {
                const profileId = inputs.profileId ?? inputs.id;
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { profile: data } };
            }
            case 'createProfile': {
                const body = {
                    subdomain: inputs.subdomain,
                    title: inputs.title,
                    description: inputs.description,
                    timeZone: inputs.timeZone,
                };
                const res = await fetch(`${baseUrl}/v1/profiles`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { profile: data } };
            }
            case 'updateProfile': {
                const profileId = inputs.profileId ?? inputs.id;
                const body: Record<string, any> = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.timeZone !== undefined) body.timeZone = inputs.timeZone;
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { profile: data } };
            }
            case 'deleteProfile': {
                const profileId = inputs.profileId ?? inputs.id;
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { deleted: true, profileId } };
            }
            case 'listBookings': {
                const profileId = inputs.profileId;
                const params = new URLSearchParams();
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.before) params.set('before', inputs.before);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                const query = params.toString() ? `?${params}` : '';
                const url = profileId
                    ? `${baseUrl}/v1/profiles/${profileId}/bookings${query}`
                    : `${baseUrl}/v1/bookings${query}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { bookings: data } };
            }
            case 'getBooking': {
                const bookingId = inputs.bookingId ?? inputs.id;
                const profileId = inputs.profileId;
                const url = profileId
                    ? `${baseUrl}/v1/profiles/${profileId}/bookings/${bookingId}`
                    : `${baseUrl}/v1/bookings/${bookingId}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { booking: data } };
            }
            case 'createBooking': {
                const profileId = inputs.profileId;
                const body = {
                    startTime: inputs.startTime,
                    endTime: inputs.endTime,
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    email: inputs.email,
                    answers: inputs.answers,
                };
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}/bookings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { booking: data } };
            }
            case 'cancelBooking': {
                const bookingId = inputs.bookingId ?? inputs.id;
                const profileId = inputs.profileId;
                const url = profileId
                    ? `${baseUrl}/v1/profiles/${profileId}/bookings/${bookingId}`
                    : `${baseUrl}/v1/bookings/${bookingId}`;
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { cancelled: true, bookingId } };
            }
            case 'listSlots': {
                const profileId = inputs.profileId;
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}/slots?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { slots: data } };
            }
            case 'getAvailableSlots': {
                const profileId = inputs.profileId;
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.timeZone) params.set('timeZone', inputs.timeZone);
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}/slots?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                const available = Array.isArray(data) ? data.filter((s: any) => s.available !== false) : data;
                return { output: { slots: available } };
            }
            case 'listForms': {
                const profileId = inputs.profileId;
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}/fields`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { forms: data } };
            }
            case 'getForm': {
                const profileId = inputs.profileId;
                const formId = inputs.formId ?? inputs.id;
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}/fields/${formId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { form: data } };
            }
            case 'updateForm': {
                const profileId = inputs.profileId;
                const formId = inputs.formId ?? inputs.id;
                const body: Record<string, any> = {};
                if (inputs.label !== undefined) body.label = inputs.label;
                if (inputs.required !== undefined) body.required = inputs.required;
                if (inputs.visible !== undefined) body.visible = inputs.visible;
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}/fields/${formId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { form: data } };
            }
            case 'listNotifications': {
                const profileId = inputs.profileId;
                const res = await fetch(`${baseUrl}/v1/profiles/${profileId}/reminders`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.error || `API error: ${res.status}`);
                return { output: { notifications: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
