'use server';

export async function executeGoogleMeetAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const meetBase = 'https://meet.googleapis.com/v2';
        const calendarBase = 'https://www.googleapis.com/calendar/v3';
        const token = inputs.accessToken;
        const authHeader = `Bearer ${token}`;

        const meetFetch = async (url: string, method = 'GET', body?: any) => {
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || `Google Meet API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'createSpace': {
                const data = await meetFetch(`${meetBase}/spaces`, 'POST', {
                    config: {
                        accessType: inputs.accessType || 'OPEN',
                        entryPointAccess: inputs.entryPointAccess || 'ALL',
                    },
                });
                return { output: { space: data } };
            }
            case 'getSpace': {
                const data = await meetFetch(`${meetBase}/spaces/${inputs.spaceName}`);
                return { output: { space: data } };
            }
            case 'endActiveConference': {
                const data = await meetFetch(`${meetBase}/spaces/${inputs.spaceName}:endActiveConference`, 'POST', {});
                return { output: { success: true, result: data } };
            }
            case 'listConferenceRecords': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.filter) params.set('filter', inputs.filter);
                const data = await meetFetch(`${meetBase}/conferenceRecords?${params.toString()}`);
                return { output: { conferenceRecords: data.conferenceRecords || [], nextPageToken: data.nextPageToken } };
            }
            case 'getConferenceRecord': {
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}`);
                return { output: { conferenceRecord: data } };
            }
            case 'listParticipants': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.filter) params.set('filter', inputs.filter);
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}/participants?${params.toString()}`);
                return { output: { participants: data.participants || [], nextPageToken: data.nextPageToken } };
            }
            case 'getParticipant': {
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}/participants/${inputs.participantId}`);
                return { output: { participant: data } };
            }
            case 'listParticipantSessions': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}/participants/${inputs.participantId}/participantSessions?${params.toString()}`);
                return { output: { participantSessions: data.participantSessions || [], nextPageToken: data.nextPageToken } };
            }
            case 'listTranscripts': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}/transcripts?${params.toString()}`);
                return { output: { transcripts: data.transcripts || [], nextPageToken: data.nextPageToken } };
            }
            case 'getTranscript': {
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}/transcripts/${inputs.transcriptId}`);
                return { output: { transcript: data } };
            }
            case 'listRecordings': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}/recordings?${params.toString()}`);
                return { output: { recordings: data.recordings || [], nextPageToken: data.nextPageToken } };
            }
            case 'getRecording': {
                const data = await meetFetch(`${meetBase}/conferenceRecords/${inputs.conferenceRecordId}/recordings/${inputs.recordingId}`);
                return { output: { recording: data } };
            }
            case 'createCalendarMeeting': {
                const calendarId = inputs.calendarId || 'primary';
                const event: any = {
                    summary: inputs.summary || 'Google Meet Meeting',
                    description: inputs.description || '',
                    start: {
                        dateTime: inputs.startDateTime,
                        timeZone: inputs.timeZone || 'UTC',
                    },
                    end: {
                        dateTime: inputs.endDateTime,
                        timeZone: inputs.timeZone || 'UTC',
                    },
                    conferenceData: {
                        createRequest: {
                            requestId: `sabflow-${Date.now()}`,
                            conferenceSolutionKey: { type: 'hangoutsMeet' },
                        },
                    },
                    attendees: (inputs.attendees || []).map((email: string) => ({ email })),
                };
                const data = await meetFetch(
                    `${calendarBase}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
                    'POST',
                    event
                );
                return { output: { event: data, meetLink: data.hangoutLink, conferenceData: data.conferenceData } };
            }
            case 'listCalendarMeetings': {
                const calendarId = inputs.calendarId || 'primary';
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', inputs.maxResults);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.timeMin) params.set('timeMin', inputs.timeMin);
                if (inputs.timeMax) params.set('timeMax', inputs.timeMax);
                params.set('q', 'meet.google.com');
                const data = await meetFetch(`${calendarBase}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
                return { output: { events: data.items || [], nextPageToken: data.nextPageToken } };
            }
            case 'deleteMeeting': {
                const calendarId = inputs.calendarId || 'primary';
                await meetFetch(
                    `${calendarBase}/calendars/${encodeURIComponent(calendarId)}/events/${inputs.eventId}`,
                    'DELETE'
                );
                return { output: { success: true } };
            }
            default:
                logger.log(`Google Meet: unknown action "${actionName}"`);
                return { error: `Unknown Google Meet action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Google Meet action error: ${err.message}`);
        return { error: err.message || 'Google Meet action failed' };
    }
}
