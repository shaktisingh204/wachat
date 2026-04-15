'use server';

const GTW_BASE_URL = 'https://api.getgo.com/G2W/rest/v2';

async function gtwRequest(
    method: string,
    path: string,
    accessToken: string,
    body?: any
): Promise<any> {
    const url = `${GTW_BASE_URL}${path}`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return { deleted: true };

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
        throw new Error(data?.description ?? data?.message ?? `GoToWebinar API error ${res.status}: ${text}`);
    }
    return data;
}

export async function executeGotowebinarAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output: any } | { error: string }> {
    try {
        if (!inputs.accessToken) return { error: 'Missing required input: accessToken' };
        if (!inputs.organizerKey) return { error: 'Missing required input: organizerKey' };

        const { accessToken, organizerKey } = inputs;
        logger.log(`Executing GoToWebinar action: ${actionName}`);

        switch (actionName) {

            case 'listWebinars': {
                const fromTime = inputs.fromTime ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const toTime = inputs.toTime ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
                const params = new URLSearchParams({ fromTime, toTime });
                const data = await gtwRequest('GET', `/organizers/${organizerKey}/webinars?${params}`, accessToken);
                const webinars = data?._embedded?.webinars ?? data?.webinars ?? [];
                return { output: { webinars } };
            }

            case 'getWebinar': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                const data = await gtwRequest('GET', `/organizers/${organizerKey}/webinars/${inputs.webinarKey}`, accessToken);
                return { output: { webinar: data } };
            }

            case 'createWebinar': {
                if (!inputs.subject) return { error: 'Missing required input: subject' };
                if (!inputs.times) return { error: 'Missing required input: times' };
                const body = {
                    subject: inputs.subject,
                    description: inputs.description ?? '',
                    times: inputs.times,
                    type: inputs.type ?? 'single_session',
                    timeZone: inputs.timeZone ?? 'UTC',
                };
                const data = await gtwRequest('POST', `/organizers/${organizerKey}/webinars`, accessToken, body);
                return { output: { webinarKey: data?.webinarKey, webinar: data } };
            }

            case 'deleteWebinar': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                await gtwRequest('DELETE', `/organizers/${organizerKey}/webinars/${inputs.webinarKey}`, accessToken);
                return { output: { deleted: true, webinarKey: inputs.webinarKey } };
            }

            case 'listRegistrants': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                const status = inputs.status ?? 'APPROVED';
                const data = await gtwRequest(
                    'GET',
                    `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/registrants?status=${status}`,
                    accessToken
                );
                const registrants = data?.registrants ?? data?._embedded?.registrants ?? data ?? [];
                return { output: { registrants } };
            }

            case 'registerAttendee': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                if (!inputs.firstName) return { error: 'Missing required input: firstName' };
                if (!inputs.lastName) return { error: 'Missing required input: lastName' };
                if (!inputs.email) return { error: 'Missing required input: email' };
                const body: any = {
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    email: inputs.email,
                };
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.organization) body.organization = inputs.organization;
                const data = await gtwRequest(
                    'POST',
                    `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/registrants`,
                    accessToken,
                    body
                );
                return { output: { registrantKey: data?.registrantKey, joinUrl: data?.joinUrl, registrant: data } };
            }

            case 'deleteRegistrant': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                if (!inputs.registrantKey) return { error: 'Missing required input: registrantKey' };
                await gtwRequest(
                    'DELETE',
                    `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/registrants/${inputs.registrantKey}`,
                    accessToken
                );
                return { output: { deleted: true } };
            }

            case 'listSessions': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                const data = await gtwRequest(
                    'GET',
                    `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/sessions`,
                    accessToken
                );
                const sessions = data?.sessions ?? data?._embedded?.sessions ?? data ?? [];
                return { output: { sessions } };
            }

            case 'getAttendees': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                // First list sessions to get session keys
                const sessionsData = await gtwRequest(
                    'GET',
                    `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/sessions`,
                    accessToken
                );
                const sessions: any[] = sessionsData?.sessions ?? sessionsData?._embedded?.sessions ?? sessionsData ?? [];
                if (!sessions.length) return { output: { attendees: [], sessions: [] } };

                const allAttendees: any[] = [];
                for (const session of sessions) {
                    const sessionKey = session.sessionKey ?? session.key;
                    if (!sessionKey) continue;
                    try {
                        const attData = await gtwRequest(
                            'GET',
                            `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/sessions/${sessionKey}/attendees`,
                            accessToken
                        );
                        const attendees: any[] = attData?.attendees ?? attData?._embedded?.attendees ?? attData ?? [];
                        allAttendees.push(...attendees.map((a: any) => ({ ...a, sessionKey })));
                    } catch {
                        // Skip sessions that have no attendee data
                    }
                }
                return { output: { attendees: allAttendees, sessions } };
            }

            case 'getSessionPerformance': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                if (!inputs.sessionKey) return { error: 'Missing required input: sessionKey' };
                const data = await gtwRequest(
                    'GET',
                    `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/sessions/${inputs.sessionKey}/performance`,
                    accessToken
                );
                return { output: { performance: data } };
            }

            case 'listPanelists': {
                if (!inputs.webinarKey) return { error: 'Missing required input: webinarKey' };
                const data = await gtwRequest(
                    'GET',
                    `/organizers/${organizerKey}/webinars/${inputs.webinarKey}/panelists`,
                    accessToken
                );
                const panelists = data?.panelists ?? data?._embedded?.panelists ?? data ?? [];
                return { output: { panelists } };
            }

            default:
                return { error: `GoToWebinar action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`GoToWebinar action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown GoToWebinar error' };
    }
}
