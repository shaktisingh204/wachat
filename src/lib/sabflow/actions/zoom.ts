
'use server';

const ZOOM_BASE = 'https://api.zoom.us/v2';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';

async function getZoomAccessToken(
    accountId: string,
    clientId: string,
    clientSecret: string
): Promise<string> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const url = `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.reason ?? data?.message ?? `Zoom auth failed: ${res.status}`);
    }
    return data.access_token;
}

async function zoomFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${ZOOM_BASE}${path}`;
    logger?.log(`[Zoom] ${method} ${path}`);

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

    // 204 No Content (e.g. delete success)
    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        const msg = data?.message ?? `Zoom API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeZoomAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        const accountId = String(inputs.accountId ?? '').trim();
        const clientId = String(inputs.clientId ?? '').trim();
        const clientSecret = String(inputs.clientSecret ?? '').trim();
        if (!accountId) throw new Error('"accountId" is required.');
        if (!clientId) throw new Error('"clientId" is required.');
        if (!clientSecret) throw new Error('"clientSecret" is required.');

        const accessToken = await getZoomAccessToken(accountId, clientId, clientSecret);
        const zm = (method: string, path: string, body?: any) =>
            zoomFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'createMeeting': {
                const userId = String(inputs.userId ?? 'me').trim();
                const topic = String(inputs.topic ?? '').trim();
                const type = Number(inputs.type ?? 2);
                const startTime = String(inputs.startTime ?? '').trim();
                const duration = Number(inputs.duration ?? 60);
                if (!topic) throw new Error('"topic" is required.');
                if (!startTime) throw new Error('"startTime" is required (ISO 8601).');
                const body: any = { topic, type, start_time: startTime, duration };
                if (inputs.timezone) body.timezone = String(inputs.timezone);
                if (inputs.password) body.password = String(inputs.password);
                logger.log(`[Zoom] createMeeting for user "${userId}": "${topic}"`);
                const data = await zm('POST', `/users/${userId}/meetings`, body);
                return {
                    output: {
                        meetingId: data.id,
                        joinUrl: data.join_url,
                        startUrl: data.start_url,
                        password: data.password ?? null,
                        topic: data.topic,
                        startTime: data.start_time,
                        duration: data.duration,
                        timezone: data.timezone,
                    },
                };
            }

            case 'getMeeting': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('"meetingId" is required.');
                logger.log(`[Zoom] getMeeting ${meetingId}`);
                const data = await zm('GET', `/meetings/${meetingId}`);
                return { output: { meeting: data } };
            }

            case 'updateMeeting': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('"meetingId" is required.');
                const body: any = {};
                if (inputs.topic !== undefined && inputs.topic !== '') body.topic = String(inputs.topic);
                if (inputs.startTime !== undefined && inputs.startTime !== '') body.start_time = String(inputs.startTime);
                if (inputs.duration !== undefined && inputs.duration !== '') body.duration = Number(inputs.duration);
                logger.log(`[Zoom] updateMeeting ${meetingId}`);
                await zm('PATCH', `/meetings/${meetingId}`, body);
                return { output: { updated: true, meetingId } };
            }

            case 'deleteMeeting': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('"meetingId" is required.');
                logger.log(`[Zoom] deleteMeeting ${meetingId}`);
                await zm('DELETE', `/meetings/${meetingId}`);
                return { output: { deleted: true, meetingId } };
            }

            case 'listMeetings': {
                const userId = String(inputs.userId ?? 'me').trim();
                const type = String(inputs.type ?? 'scheduled').trim();
                logger.log(`[Zoom] listMeetings for user "${userId}" type="${type}"`);
                const data = await zm('GET', `/users/${userId}/meetings?type=${encodeURIComponent(type)}`);
                return {
                    output: {
                        meetings: data.meetings ?? [],
                        totalRecords: data.total_records ?? 0,
                        pageCount: data.page_count ?? 1,
                        pageSize: data.page_size ?? 30,
                    },
                };
            }

            case 'getMeetingRegistrants': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                if (!meetingId) throw new Error('"meetingId" is required.');
                logger.log(`[Zoom] getMeetingRegistrants ${meetingId}`);
                const data = await zm('GET', `/meetings/${meetingId}/registrants`);
                return {
                    output: {
                        registrants: data.registrants ?? [],
                        totalRecords: data.total_records ?? 0,
                    },
                };
            }

            case 'addMeetingRegistrant': {
                const meetingId = String(inputs.meetingId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                if (!meetingId) throw new Error('"meetingId" is required.');
                if (!email) throw new Error('"email" is required.');
                if (!firstName) throw new Error('"firstName" is required.');
                const body: any = { email, first_name: firstName };
                if (inputs.lastName) body.last_name = String(inputs.lastName);
                logger.log(`[Zoom] addMeetingRegistrant ${email} to meeting ${meetingId}`);
                const data = await zm('POST', `/meetings/${meetingId}/registrants`, body);
                return {
                    output: {
                        registrantId: data.registrant_id,
                        joinUrl: data.join_url,
                        startTime: data.start_time,
                        topic: data.topic,
                    },
                };
            }

            case 'createWebinar': {
                const userId = String(inputs.userId ?? 'me').trim();
                const topic = String(inputs.topic ?? '').trim();
                const startTime = String(inputs.startTime ?? '').trim();
                const duration = Number(inputs.duration ?? 60);
                if (!topic) throw new Error('"topic" is required.');
                if (!startTime) throw new Error('"startTime" is required (ISO 8601).');
                const body: any = { topic, type: 5, start_time: startTime, duration };
                if (inputs.timezone) body.timezone = String(inputs.timezone);
                logger.log(`[Zoom] createWebinar for user "${userId}": "${topic}"`);
                const data = await zm('POST', `/users/${userId}/webinars`, body);
                return {
                    output: {
                        webinarId: data.id,
                        joinUrl: data.join_url,
                        startUrl: data.start_url,
                        topic: data.topic,
                        startTime: data.start_time,
                        duration: data.duration,
                    },
                };
            }

            case 'listWebinars': {
                const userId = String(inputs.userId ?? 'me').trim();
                logger.log(`[Zoom] listWebinars for user "${userId}"`);
                const data = await zm('GET', `/users/${userId}/webinars`);
                return {
                    output: {
                        webinars: data.webinars ?? [],
                        totalRecords: data.total_records ?? 0,
                    },
                };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? 'me').trim();
                logger.log(`[Zoom] getUser "${userId}"`);
                const data = await zm('GET', `/users/${userId}`);
                return {
                    output: {
                        user: {
                            id: data.id,
                            email: data.email,
                            firstName: data.first_name,
                            lastName: data.last_name,
                            type: data.type,
                            status: data.status,
                            timezone: data.timezone,
                            dept: data.dept ?? null,
                            jobTitle: data.job_title ?? null,
                        },
                    },
                };
            }

            case 'listUsers': {
                logger.log(`[Zoom] listUsers`);
                const data = await zm('GET', `/users`);
                return {
                    output: {
                        users: data.users ?? [],
                        totalRecords: data.total_records ?? 0,
                        pageCount: data.page_count ?? 1,
                    },
                };
            }

            case 'updateUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                const body: any = {};
                if (inputs.firstName !== undefined && inputs.firstName !== '') body.first_name = String(inputs.firstName);
                if (inputs.lastName !== undefined && inputs.lastName !== '') body.last_name = String(inputs.lastName);
                if (inputs.jobTitle !== undefined && inputs.jobTitle !== '') body.job_title = String(inputs.jobTitle);
                logger.log(`[Zoom] updateUser "${userId}"`);
                await zm('PATCH', `/users/${userId}`, body);
                return { output: { updated: true, userId } };
            }

            default:
                return { error: `Zoom action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'Zoom action failed.';
        logger.log(`[Zoom] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
