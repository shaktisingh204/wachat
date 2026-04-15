'use server';

export async function executeOutlookEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const userId = String(inputs.userId ?? 'me').trim() || 'me';
        const base = `https://graph.microsoft.com/v1.0/${userId}`;
        switch (actionName) {
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.filter) params.set('$filter', String(inputs.filter));
                if (inputs.select) params.set('$select', String(inputs.select));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${base}/messages${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { messages: data.value, count: data.value?.length ?? 0, nextLink: data['@odata.nextLink'] } };
            }
            case 'getMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                const res = await fetch(`${base}/messages/${messageId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }
            case 'sendMessage': {
                const body = {
                    message: {
                        subject: String(inputs.subject ?? ''),
                        body: {
                            contentType: inputs.contentType ?? 'Text',
                            content: String(inputs.content ?? ''),
                        },
                        toRecipients: (inputs.toRecipients ?? []).map((addr: string) => ({
                            emailAddress: { address: addr },
                        })),
                        ccRecipients: (inputs.ccRecipients ?? []).map((addr: string) => ({
                            emailAddress: { address: addr },
                        })),
                    },
                    saveToSentItems: inputs.saveToSentItems !== false,
                };
                const res = await fetch(`${base}/sendMail`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true } };
            }
            case 'createDraftMessage': {
                const body = {
                    subject: String(inputs.subject ?? ''),
                    body: {
                        contentType: inputs.contentType ?? 'Text',
                        content: String(inputs.content ?? ''),
                    },
                    toRecipients: (inputs.toRecipients ?? []).map((addr: string) => ({
                        emailAddress: { address: addr },
                    })),
                };
                const res = await fetch(`${base}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { draft: data } };
            }
            case 'updateMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                const updateBody: Record<string, any> = {};
                if (inputs.subject !== undefined) updateBody.subject = inputs.subject;
                if (inputs.isRead !== undefined) updateBody.isRead = inputs.isRead;
                if (inputs.categories !== undefined) updateBody.categories = inputs.categories;
                const res = await fetch(`${base}/messages/${messageId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateBody),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }
            case 'deleteMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                const res = await fetch(`${base}/messages/${messageId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, messageId } };
            }
            case 'listMailFolders': {
                const res = await fetch(`${base}/mailFolders`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { folders: data.value, count: data.value?.length ?? 0 } };
            }
            case 'createMailFolder': {
                const body = {
                    displayName: String(inputs.displayName ?? ''),
                    isHidden: inputs.isHidden ?? false,
                };
                const res = await fetch(`${base}/mailFolders`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { folder: data } };
            }
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.filter) params.set('$filter', String(inputs.filter));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${base}/events${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { events: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                const res = await fetch(`${base}/events/${eventId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { event: data } };
            }
            case 'createEvent': {
                const body: Record<string, any> = {
                    subject: String(inputs.subject ?? ''),
                    body: {
                        contentType: inputs.contentType ?? 'HTML',
                        content: String(inputs.content ?? ''),
                    },
                    start: { dateTime: String(inputs.startDateTime ?? ''), timeZone: inputs.timeZone ?? 'UTC' },
                    end: { dateTime: String(inputs.endDateTime ?? ''), timeZone: inputs.timeZone ?? 'UTC' },
                };
                if (inputs.attendees) body.attendees = inputs.attendees;
                if (inputs.location) body.location = { displayName: inputs.location };
                const res = await fetch(`${base}/events`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { event: data } };
            }
            case 'updateEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                const updateBody: Record<string, any> = {};
                if (inputs.subject !== undefined) updateBody.subject = inputs.subject;
                if (inputs.startDateTime !== undefined) updateBody.start = { dateTime: inputs.startDateTime, timeZone: inputs.timeZone ?? 'UTC' };
                if (inputs.endDateTime !== undefined) updateBody.end = { dateTime: inputs.endDateTime, timeZone: inputs.timeZone ?? 'UTC' };
                if (inputs.content !== undefined) updateBody.body = { contentType: inputs.contentType ?? 'HTML', content: inputs.content };
                const res = await fetch(`${base}/events/${eventId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateBody),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { event: data } };
            }
            case 'deleteEvent': {
                const eventId = String(inputs.eventId ?? '').trim();
                const res = await fetch(`${base}/events/${eventId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, eventId } };
            }
            case 'listCalendars': {
                const res = await fetch(`${base}/calendars`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { calendars: data.value, count: data.value?.length ?? 0 } };
            }
            case 'createCalendar': {
                const body = {
                    name: String(inputs.name ?? ''),
                    color: inputs.color ?? 'auto',
                };
                const res = await fetch(`${base}/calendars`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { calendar: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
