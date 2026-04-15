
'use server';

const WEBEX_BASE = 'https://webexapis.com/v1';

async function webexFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${WEBEX_BASE}${path}`;
    logger?.log(`[Webex] ${method} ${path}`);

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
        throw new Error(data?.message || data?.errors?.[0]?.description || `Webex API error: ${res.status}`);
    }
    return data;
}

export async function executeWebexAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const wx = (method: string, path: string, body?: any) =>
            webexFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'sendMessage': {
                const roomId = String(inputs.roomId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!text) throw new Error('text is required.');

                const body: any = { roomId, text };
                if (inputs.markdown) body.markdown = String(inputs.markdown);

                const data = await wx('POST', '/messages', body);
                logger.log(`[Webex] Message sent to room ${roomId}`);
                return { output: { id: data.id, text: data.text } };
            }

            case 'listRooms': {
                const data = await wx('GET', '/rooms?max=500');
                const rooms = data.items ?? [];
                return { output: { rooms, count: rooms.length } };
            }

            case 'createRoom': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');

                const data = await wx('POST', '/rooms', { title });
                return { output: { id: data.id, title: data.title } };
            }

            case 'getRoom': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                const data = await wx('GET', `/rooms/${roomId}`);
                return { output: { id: data.id, title: data.title, type: data.type, isLocked: data.isLocked } };
            }

            case 'listMessages': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                const max = Number(inputs.max ?? 50);
                const data = await wx('GET', `/messages?roomId=${encodeURIComponent(roomId)}&max=${max}`);
                const messages = data.items ?? [];
                return { output: { messages, count: messages.length } };
            }

            case 'getMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');

                const data = await wx('GET', `/messages/${messageId}`);
                return { output: { id: data.id, text: data.text ?? '', personEmail: data.personEmail, roomId: data.roomId } };
            }

            case 'deleteMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');

                await wx('DELETE', `/messages/${messageId}`);
                return { output: { deleted: true, messageId } };
            }

            case 'listPeople': {
                const params: string[] = [];
                if (inputs.email) params.push(`email=${encodeURIComponent(String(inputs.email))}`);
                params.push('max=200');
                const data = await wx('GET', `/people?${params.join('&')}`);
                const people = data.items ?? [];
                return { output: { people, count: people.length } };
            }

            case 'getPerson': {
                const personId = String(inputs.personId ?? '').trim();
                if (!personId) throw new Error('personId is required.');

                const data = await wx('GET', `/people/${personId}`);
                return {
                    output: {
                        id: data.id,
                        displayName: data.displayName,
                        emails: data.emails ?? [],
                        orgId: data.orgId,
                        type: data.type,
                    },
                };
            }

            case 'listTeams': {
                const data = await wx('GET', '/teams?max=200');
                const teams = data.items ?? [];
                return { output: { teams, count: teams.length } };
            }

            case 'createTeam': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');

                const data = await wx('POST', '/teams', { name });
                return { output: { id: data.id, name: data.name } };
            }

            case 'listMemberships': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                const data = await wx('GET', `/memberships?roomId=${encodeURIComponent(roomId)}&max=200`);
                const memberships = data.items ?? [];
                return { output: { memberships, count: memberships.length } };
            }

            case 'createMembership': {
                const roomId = String(inputs.roomId ?? '').trim();
                const personEmail = String(inputs.personEmail ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!personEmail) throw new Error('personEmail is required.');

                const data = await wx('POST', '/memberships', { roomId, personEmail });
                return { output: { id: data.id, personEmail: data.personEmail, roomId: data.roomId } };
            }

            case 'scheduleMeeting': {
                const title = String(inputs.title ?? '').trim();
                const start = String(inputs.start ?? '').trim();
                const end = String(inputs.end ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!start) throw new Error('start is required.');
                if (!end) throw new Error('end is required.');

                const body: any = { title, start, end };
                if (inputs.invitees) {
                    const rawInvitees = inputs.invitees;
                    if (Array.isArray(rawInvitees)) {
                        body.invitees = rawInvitees.map((e: any) => ({ email: String(e) }));
                    } else if (typeof rawInvitees === 'string') {
                        body.invitees = rawInvitees.split(',').map((e: string) => ({ email: e.trim() })).filter((e: any) => e.email);
                    }
                }

                const data = await wx('POST', '/meetings', body);
                return { output: { id: data.id, webLink: data.webLink, title: data.title, start: data.start, end: data.end } };
            }

            default:
                return { error: `Webex action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Webex action failed.' };
    }
}
