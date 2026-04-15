'use server';

export async function executeGotoMeetingAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://api.getgo.com/G2M/rest';

        const getToken = async (): Promise<string> => {
            if (inputs.accessToken) return inputs.accessToken;
            const creds = Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64');
            const res = await fetch('https://api.getgo.com/oauth/v2/token', {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${creds}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ grant_type: 'password', username: inputs.username, password: inputs.password }),
            });
            if (!res.ok) throw new Error(`GoTo token error: ${await res.text()}`);
            const data = await res.json();
            return data.access_token;
        };

        const gotoFetch = async (method: string, path: string, body?: any) => {
            const token = await getToken();
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`GoToMeeting API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'createMeeting': {
                const data = await gotoFetch('POST', '/meetings', {
                    subject: inputs.subject,
                    starttime: inputs.startTime,
                    endtime: inputs.endTime,
                    passwordrequired: inputs.passwordRequired ?? false,
                    conferencecallinfo: inputs.conferenceCallInfo || 'Hybrid',
                    timezonekey: inputs.timezoneKey || 'America/New_York',
                    meetingtype: inputs.meetingType || 'scheduled',
                });
                return { output: data };
            }
            case 'getMeeting': {
                const data = await gotoFetch('GET', `/meetings/${inputs.meetingId}`);
                return { output: data };
            }
            case 'updateMeeting': {
                await gotoFetch('PUT', `/meetings/${inputs.meetingId}`, {
                    subject: inputs.subject,
                    starttime: inputs.startTime,
                    endtime: inputs.endTime,
                    passwordrequired: inputs.passwordRequired,
                    conferencecallinfo: inputs.conferenceCallInfo,
                    timezonekey: inputs.timezoneKey,
                    meetingtype: inputs.meetingType,
                });
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'deleteMeeting': {
                await gotoFetch('DELETE', `/meetings/${inputs.meetingId}`);
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'listMeetings': {
                const qs = new URLSearchParams({ history: inputs.history ? 'true' : 'false' });
                if (inputs.startDate) qs.set('startDate', inputs.startDate);
                if (inputs.endDate) qs.set('endDate', inputs.endDate);
                const data = await gotoFetch('GET', `/meetings?${qs}`);
                return { output: data };
            }
            case 'startMeeting': {
                const data = await gotoFetch('GET', `/meetings/${inputs.meetingId}/start`);
                return { output: data };
            }
            case 'endMeeting': {
                await gotoFetch('DELETE', `/meetings/${inputs.meetingId}/end`);
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'getAttendees': {
                const data = await gotoFetch('GET', `/meetings/${inputs.meetingId}/attendees`);
                return { output: data };
            }
            case 'getCoOrganizers': {
                const data = await gotoFetch('GET', `/meetings/${inputs.meetingId}/coorganizers`);
                return { output: data };
            }
            case 'addCoOrganizer': {
                const data = await gotoFetch('POST', `/meetings/${inputs.meetingId}/coorganizers`, [
                    { givenName: inputs.givenName, email: inputs.email, organizerid: inputs.organizerId },
                ]);
                return { output: data };
            }
            case 'removeCoOrganizer': {
                await gotoFetch('DELETE', `/meetings/${inputs.meetingId}/coorganizers/${inputs.coOrganizerId}`);
                return { output: { success: true, coOrganizerId: inputs.coOrganizerId } };
            }
            case 'listRecordings': {
                const data = await gotoFetch('GET', `/meetings/${inputs.meetingId}/recordings`);
                return { output: data };
            }
            case 'getRecording': {
                const data = await gotoFetch('GET', `/recordings/${inputs.recordingId}`);
                return { output: data };
            }
            case 'deleteRecording': {
                await gotoFetch('DELETE', `/recordings/${inputs.recordingId}`);
                return { output: { success: true, recordingId: inputs.recordingId } };
            }
            case 'getAccountInfo': {
                const data = await gotoFetch('GET', '/accounts');
                return { output: data };
            }
            default:
                return { error: `Unknown GoToMeeting action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`GoToMeeting action error: ${e.message}`);
        return { error: e.message };
    }
}
