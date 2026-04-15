'use server';

export async function executeCapacitorCalendarAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const baseUrl = inputs.baseUrl;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listCalendars': {
                const res = await fetch(`${baseUrl}/calendars`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list calendars' };
                return { output: data };
            }
            case 'getCalendar': {
                const res = await fetch(`${baseUrl}/calendars/${inputs.calendarId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get calendar' };
                return { output: data };
            }
            case 'createCalendar': {
                const body: Record<string, any> = { title: inputs.title || 'New Calendar' };
                if (inputs.color) body.color = inputs.color;
                if (inputs.isLocal !== undefined) body.isLocal = inputs.isLocal;
                const res = await fetch(`${baseUrl}/calendars`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create calendar' };
                return { output: data };
            }
            case 'deleteCalendar': {
                const res = await fetch(`${baseUrl}/calendars/${inputs.calendarId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete calendar' };
                return { output: data };
            }
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.calendarId) params.append('calendarId', inputs.calendarId);
                if (inputs.startDate) params.append('startDate', inputs.startDate);
                if (inputs.endDate) params.append('endDate', inputs.endDate);
                const res = await fetch(`${baseUrl}/events?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list events' };
                return { output: data };
            }
            case 'getEvent': {
                const res = await fetch(`${baseUrl}/events/${inputs.eventId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get event' };
                return { output: data };
            }
            case 'createEvent': {
                const body: Record<string, any> = {
                    title: inputs.title || '',
                    startDate: inputs.startDate,
                    endDate: inputs.endDate,
                };
                if (inputs.calendarId) body.calendarId = inputs.calendarId;
                if (inputs.location) body.location = inputs.location;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.isAllDay !== undefined) body.isAllDay = inputs.isAllDay;
                if (inputs.url) body.url = inputs.url;
                if (inputs.alarms) body.alarms = inputs.alarms;
                const res = await fetch(`${baseUrl}/events`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create event' };
                return { output: data };
            }
            case 'updateEvent': {
                const body: Record<string, any> = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.startDate) body.startDate = inputs.startDate;
                if (inputs.endDate) body.endDate = inputs.endDate;
                if (inputs.location) body.location = inputs.location;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.isAllDay !== undefined) body.isAllDay = inputs.isAllDay;
                if (inputs.url) body.url = inputs.url;
                if (inputs.alarms) body.alarms = inputs.alarms;
                const res = await fetch(`${baseUrl}/events/${inputs.eventId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update event' };
                return { output: data };
            }
            case 'deleteEvent': {
                const params = new URLSearchParams();
                if (inputs.span) params.append('span', inputs.span);
                const res = await fetch(`${baseUrl}/events/${inputs.eventId}?${params.toString()}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete event' };
                return { output: data };
            }
            case 'listReminders': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.append('startDate', inputs.startDate);
                if (inputs.endDate) params.append('endDate', inputs.endDate);
                const res = await fetch(`${baseUrl}/reminders?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list reminders' };
                return { output: data };
            }
            case 'createReminder': {
                const body: Record<string, any> = {
                    title: inputs.title || '',
                    dueDate: inputs.dueDate,
                };
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.priority !== undefined) body.priority = inputs.priority;
                if (inputs.isCompleted !== undefined) body.isCompleted = inputs.isCompleted;
                if (inputs.listId) body.listId = inputs.listId;
                const res = await fetch(`${baseUrl}/reminders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create reminder' };
                return { output: data };
            }
            case 'deleteReminder': {
                const res = await fetch(`${baseUrl}/reminders/${inputs.reminderId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete reminder' };
                return { output: data };
            }
            case 'checkPermissions': {
                const res = await fetch(`${baseUrl}/permissions/check`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to check permissions' };
                return { output: data };
            }
            case 'requestPermissions': {
                const body: Record<string, any> = {};
                if (inputs.permissions) body.permissions = inputs.permissions;
                const res = await fetch(`${baseUrl}/permissions/request`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to request permissions' };
                return { output: data };
            }
            case 'openCalendar': {
                const body: Record<string, any> = {};
                if (inputs.date) body.date = inputs.date;
                if (inputs.calendarId) body.calendarId = inputs.calendarId;
                const res = await fetch(`${baseUrl}/calendar/open`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to open calendar' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in capacitor-calendar action' };
    }
}
