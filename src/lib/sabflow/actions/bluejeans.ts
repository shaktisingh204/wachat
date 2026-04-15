'use server';

export async function executeBlueJeansAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://api.bluejeans.com/v1';

        const getToken = async (): Promise<string> => {
            const res = await fetch(`${BASE}/oauth2/token?Password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'client_credentials',
                    client_id: inputs.clientId,
                    client_secret: inputs.clientSecret,
                }),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`BlueJeans OAuth error ${res.status}: ${text}`);
            const json = JSON.parse(text);
            return json.access_token;
        };

        const token = inputs.accessToken || (await getToken());

        const bjFetch = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`BlueJeans API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'listMeetings': {
                const userId = inputs.userId || 'me';
                const params = new URLSearchParams();
                if (inputs.numericMeetingId) params.set('numericMeetingId', inputs.numericMeetingId);
                const data = await bjFetch('GET', `/user/${userId}/scheduled_meeting?${params}`);
                return { output: data };
            }
            case 'getMeeting': {
                const userId = inputs.userId || 'me';
                const data = await bjFetch('GET', `/user/${userId}/scheduled_meeting/${inputs.meetingId}`);
                return { output: data };
            }
            case 'createMeeting': {
                const userId = inputs.userId || 'me';
                const body: any = {
                    title: inputs.title,
                    description: inputs.description,
                    start: inputs.start,
                    end: inputs.end,
                    timezone: inputs.timezone,
                    passwordRequired: inputs.passwordRequired ?? false,
                    addAttendeePasscode: inputs.addAttendeePasscode ?? false,
                    attendees: inputs.attendees,
                    advancedMeetingOptions: inputs.advancedMeetingOptions,
                };
                const data = await bjFetch('POST', `/user/${userId}/scheduled_meeting`, body);
                return { output: data };
            }
            case 'updateMeeting': {
                const userId = inputs.userId || 'me';
                const body: any = {
                    title: inputs.title,
                    description: inputs.description,
                    start: inputs.start,
                    end: inputs.end,
                    timezone: inputs.timezone,
                    passwordRequired: inputs.passwordRequired,
                };
                const data = await bjFetch('PUT', `/user/${userId}/scheduled_meeting/${inputs.meetingId}`, body);
                return { output: data };
            }
            case 'deleteMeeting': {
                const userId = inputs.userId || 'me';
                await bjFetch('DELETE', `/user/${userId}/scheduled_meeting/${inputs.meetingId}`);
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'listRecordings': {
                const userId = inputs.userId || 'me';
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageNumber) params.set('pageNumber', inputs.pageNumber);
                const data = await bjFetch('GET', `/user/${userId}/meeting_history/recordings?${params}`);
                return { output: data };
            }
            case 'getRecording': {
                const userId = inputs.userId || 'me';
                const data = await bjFetch('GET', `/user/${userId}/meeting_history/${inputs.meetingGuid}/recordings`);
                return { output: data };
            }
            case 'deleteRecording': {
                const userId = inputs.userId || 'me';
                await bjFetch('DELETE', `/user/${userId}/meeting_history/${inputs.meetingGuid}/recordings/${inputs.recordingEntityId}`);
                return { output: { success: true, recordingEntityId: inputs.recordingEntityId } };
            }
            case 'listEndpoints': {
                const data = await bjFetch('GET', `/enterprise/${inputs.enterpriseId}/endpoints`);
                return { output: data };
            }
            case 'getEndpoint': {
                const data = await bjFetch('GET', `/enterprise/${inputs.enterpriseId}/endpoints/${inputs.endpointGuid}`);
                return { output: data };
            }
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageNumber) params.set('pageNumber', inputs.pageNumber);
                if (inputs.filterType) params.set('filterType', inputs.filterType);
                const data = await bjFetch('GET', `/enterprise/${inputs.enterpriseId}/users?${params}`);
                return { output: data };
            }
            case 'getUser': {
                const data = await bjFetch('GET', `/enterprise/${inputs.enterpriseId}/users/${inputs.userId}`);
                return { output: data };
            }
            case 'getUserMeetings': {
                const userId = inputs.userId || 'me';
                const params = new URLSearchParams();
                if (inputs.meetingType) params.set('meetingType', inputs.meetingType);
                const data = await bjFetch('GET', `/user/${userId}/meeting_history?${params}`);
                return { output: data };
            }
            case 'sendDialOutRequest': {
                const body = {
                    numericMeetingId: inputs.numericMeetingId,
                    endpointType: inputs.endpointType || 'PSTN',
                    dialOutType: inputs.dialOutType || 'INDIVIDUAL',
                    dialOutContacts: inputs.dialOutContacts,
                };
                const data = await bjFetch('POST', `/v2/meetings/${inputs.meetingId}/dialout`, body);
                return { output: data };
            }
            case 'getMeetingNumbers': {
                const data = await bjFetch('GET', `/meetings/info/${inputs.numericMeetingId}`);
                return { output: data };
            }
            default:
                return { error: `BlueJeans: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`BlueJeans action error: ${err.message}`);
        return { error: err.message };
    }
}
