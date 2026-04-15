'use server';

export async function executeZoomEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://api.zoom.us/v2';

        const getToken = async (): Promise<string> => {
            if (inputs.accessToken) return inputs.accessToken;
            const creds = Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64');
            const res = await fetch(
                `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${inputs.accountId}`,
                { method: 'POST', headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
            const data = await res.json();
            return data.access_token;
        };

        const zoomFetch = async (method: string, path: string, body?: any) => {
            const token = await getToken();
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Zoom API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'createMeeting': {
                const data = await zoomFetch('POST', `/users/${inputs.userId || 'me'}/meetings`, {
                    topic: inputs.topic,
                    type: inputs.type ?? 2,
                    start_time: inputs.startTime,
                    duration: inputs.duration,
                    timezone: inputs.timezone,
                    agenda: inputs.agenda,
                    settings: inputs.settings,
                });
                return { output: data };
            }
            case 'getMeeting': {
                const data = await zoomFetch('GET', `/meetings/${inputs.meetingId}`);
                return { output: data };
            }
            case 'updateMeeting': {
                await zoomFetch('PATCH', `/meetings/${inputs.meetingId}`, {
                    topic: inputs.topic,
                    start_time: inputs.startTime,
                    duration: inputs.duration,
                    agenda: inputs.agenda,
                    settings: inputs.settings,
                });
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'deleteMeeting': {
                await zoomFetch('DELETE', `/meetings/${inputs.meetingId}`);
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'listMeetings': {
                const qs = new URLSearchParams({ type: inputs.type || 'scheduled', page_size: String(inputs.pageSize || 30) });
                const data = await zoomFetch('GET', `/users/${inputs.userId || 'me'}/meetings?${qs}`);
                return { output: data };
            }
            case 'getMeetingParticipants': {
                const qs = new URLSearchParams({ page_size: String(inputs.pageSize || 30) });
                const data = await zoomFetch('GET', `/report/meetings/${inputs.meetingId}/participants?${qs}`);
                return { output: data };
            }
            case 'listRecordings': {
                const qs = new URLSearchParams({ from: inputs.from, to: inputs.to });
                const data = await zoomFetch('GET', `/users/${inputs.userId || 'me'}/recordings?${qs}`);
                return { output: data };
            }
            case 'deleteRecording': {
                const qs = inputs.deleteAll ? '?delete_child=true' : '';
                await zoomFetch('DELETE', `/meetings/${inputs.meetingId}/recordings${qs}`);
                return { output: { success: true } };
            }
            case 'createWebinar': {
                const data = await zoomFetch('POST', `/users/${inputs.userId || 'me'}/webinars`, {
                    topic: inputs.topic,
                    type: inputs.type ?? 5,
                    start_time: inputs.startTime,
                    duration: inputs.duration,
                    timezone: inputs.timezone,
                    agenda: inputs.agenda,
                    settings: inputs.settings,
                });
                return { output: data };
            }
            case 'getWebinar': {
                const data = await zoomFetch('GET', `/webinars/${inputs.webinarId}`);
                return { output: data };
            }
            case 'listWebinars': {
                const qs = new URLSearchParams({ page_size: String(inputs.pageSize || 30) });
                const data = await zoomFetch('GET', `/users/${inputs.userId || 'me'}/webinars?${qs}`);
                return { output: data };
            }
            case 'updateWebinar': {
                await zoomFetch('PATCH', `/webinars/${inputs.webinarId}`, {
                    topic: inputs.topic,
                    start_time: inputs.startTime,
                    duration: inputs.duration,
                    agenda: inputs.agenda,
                    settings: inputs.settings,
                });
                return { output: { success: true, webinarId: inputs.webinarId } };
            }
            case 'addPanelist': {
                const data = await zoomFetch('POST', `/webinars/${inputs.webinarId}/panelists`, {
                    panelists: [{ name: inputs.name, email: inputs.email }],
                });
                return { output: data };
            }
            case 'getWebinarParticipants': {
                const qs = new URLSearchParams({ page_size: String(inputs.pageSize || 30) });
                const data = await zoomFetch('GET', `/report/webinars/${inputs.webinarId}/participants?${qs}`);
                return { output: data };
            }
            case 'createUser': {
                const data = await zoomFetch('POST', `/users`, {
                    action: inputs.action || 'create',
                    user_info: {
                        email: inputs.email,
                        type: inputs.userType ?? 1,
                        first_name: inputs.firstName,
                        last_name: inputs.lastName,
                    },
                });
                return { output: data };
            }
            default:
                return { error: `Unknown Zoom Enhanced action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`Zoom Enhanced action error: ${e.message}`);
        return { error: e.message };
    }
}
