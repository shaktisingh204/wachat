
'use server';

const GOTO_BASE = 'https://api.getgo.com/G2M/rest';

async function gotoFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${GOTO_BASE}${path}`;
    logger?.log(`[GoTo] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(
            data?.description ||
            data?.error_description ||
            data?.message ||
            `GoTo API error: ${res.status}`
        );
    }

    return data;
}

export async function executeGoToAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const gt = (method: string, path: string, body?: any) =>
            gotoFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listMeetings': {
                const params = new URLSearchParams({ scheduled: 'true' });
                if (inputs.startDate) params.set('startDate', String(inputs.startDate));
                if (inputs.endDate) params.set('endDate', String(inputs.endDate));
                const data = await gt('GET', `/meetings?${params.toString()}`);
                return { output: { meetings: data } };
            }

            case 'getMeeting': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('meetingId is required.');
                const data = await gt('GET', `/meetings/${meetingId}`);
                return { output: { meeting: data } };
            }

            case 'createMeeting': {
                const subject = String(inputs.subject ?? '').trim();
                const starttime = String(inputs.starttime ?? '').trim();
                const endtime = String(inputs.endtime ?? '').trim();
                if (!subject) throw new Error('subject is required.');
                if (!starttime) throw new Error('starttime is required.');
                if (!endtime) throw new Error('endtime is required.');

                const payload: any = {
                    subject,
                    starttime,
                    endtime,
                    passwordRequired: Boolean(inputs.passwordRequired ?? false),
                };
                if (inputs.meetingType) payload.meetingType = String(inputs.meetingType);
                if (inputs.conferenceCallInfo) payload.conferenceCallInfo = String(inputs.conferenceCallInfo);

                const data = await gt('POST', '/meetings', payload);
                logger.log(`[GoTo] Meeting created.`);
                return { output: { meeting: data } };
            }

            case 'updateMeeting': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('meetingId is required.');
                const payload: any = {};
                if (inputs.subject) payload.subject = String(inputs.subject);
                if (inputs.starttime) payload.starttime = String(inputs.starttime);
                if (inputs.endtime) payload.endtime = String(inputs.endtime);
                if (inputs.passwordRequired !== undefined) payload.passwordRequired = Boolean(inputs.passwordRequired);
                const data = await gt('PUT', `/meetings/${meetingId}`, payload);
                return { output: { meeting: data } };
            }

            case 'deleteMeeting': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('meetingId is required.');
                await gt('DELETE', `/meetings/${meetingId}`);
                logger.log(`[GoTo] Meeting deleted: ${meetingId}`);
                return { output: { deleted: true } };
            }

            case 'startMeeting': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('meetingId is required.');
                const data = await gt('POST', `/meetings/${meetingId}/start`);
                return { output: { hostUrl: data.hostURL, joinUrl: data.joinURL } };
            }

            case 'listAttendees': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('meetingId is required.');
                const data = await gt('GET', `/meetings/${meetingId}/attendees`);
                return { output: { attendees: data } };
            }

            case 'getHistoricalMeetings': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', String(inputs.startDate));
                if (inputs.endDate) params.set('endDate', String(inputs.endDate));
                const qs = params.toString();
                const data = await gt('GET', `/historicalMeetings${qs ? `?${qs}` : ''}`);
                return { output: { meetings: data } };
            }

            case 'getOrganizerSettings': {
                const data = await gt('GET', '/organizers');
                return { output: { organizer: data } };
            }

            case 'listRecordings': {
                const params = new URLSearchParams();
                if (inputs.meetingId) params.set('meetingId', String(inputs.meetingId));
                const qs = params.toString();
                const data = await gt('GET', `/recordings${qs ? `?${qs}` : ''}`);
                return { output: { recordings: data } };
            }

            default:
                return { error: `GoTo action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'GoTo action failed.' };
    }
}
