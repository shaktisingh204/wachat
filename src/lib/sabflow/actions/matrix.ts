
'use server';

async function matrixFetch(
    homeserverUrl: string,
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = String(homeserverUrl).replace(/\/$/, '');
    // path may already be a full URL (for special endpoints) — detect by protocol prefix
    const url = path.startsWith('http') ? path : `${base}${path}`;
    logger?.log(`[Matrix] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204 || res.status === 200 && method === 'DELETE') return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.error || `Matrix API error: ${res.status}`);
    }
    return data;
}

export async function executeMatrixAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const homeserverUrl = String(inputs.homeserverUrl ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!homeserverUrl) throw new Error('homeserverUrl is required.');
        if (!accessToken) throw new Error('accessToken is required.');

        const clientBase = `${homeserverUrl.replace(/\/$/, '')}/_matrix/client/v3`;

        const mx = (method: string, path: string, body?: any) =>
            matrixFetch(homeserverUrl, accessToken, method, path, body, logger);

        switch (actionName) {
            case 'sendMessage': {
                const roomId = String(inputs.roomId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!message) throw new Error('message is required.');

                const msgtype = String(inputs.msgtype ?? 'm.text').trim() || 'm.text';
                const txnId = Date.now();
                const path = `${clientBase}/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`;
                const data = await mx('PUT', path, { msgtype, body: message });
                logger.log(`[Matrix] Message sent to ${roomId}: ${data.event_id}`);
                return { output: { eventId: data.event_id } };
            }

            case 'joinRoom': {
                const roomIdOrAlias = String(inputs.roomIdOrAlias ?? '').trim();
                if (!roomIdOrAlias) throw new Error('roomIdOrAlias is required.');

                const data = await mx('POST', `${clientBase}/join/${encodeURIComponent(roomIdOrAlias)}`, {});
                logger.log(`[Matrix] Joined room: ${data.room_id}`);
                return { output: { roomId: data.room_id } };
            }

            case 'leaveRoom': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                await mx('POST', `${clientBase}/rooms/${encodeURIComponent(roomId)}/leave`, {});
                logger.log(`[Matrix] Left room: ${roomId}`);
                return { output: { left: true } };
            }

            case 'listJoinedRooms': {
                const data = await mx('GET', `${clientBase}/joined_rooms`);
                return { output: { joinedRooms: data.joined_rooms ?? [] } };
            }

            case 'getRoomMessages': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                const params = new URLSearchParams({ dir: 'b' });
                if (inputs.limit !== undefined && inputs.limit !== '')
                    params.set('limit', String(inputs.limit));
                if (inputs.from !== undefined && inputs.from !== '')
                    params.set('from', String(inputs.from));

                const data = await mx('GET', `${clientBase}/rooms/${encodeURIComponent(roomId)}/messages?${params.toString()}`);
                return { output: { chunk: data.chunk ?? [], end: data.end ?? null } };
            }

            case 'createRoom': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');

                const payload: any = { name };
                if (inputs.topic) payload.topic = String(inputs.topic);
                if (inputs.isPublic !== undefined)
                    payload.visibility = inputs.isPublic ? 'public' : 'private';
                if (inputs.inviteUserIds) {
                    const inviteList = Array.isArray(inputs.inviteUserIds)
                        ? inputs.inviteUserIds
                        : String(inputs.inviteUserIds).split(',').map((s: string) => s.trim()).filter(Boolean);
                    if (inviteList.length) payload.invite = inviteList;
                }

                const data = await mx('POST', `${clientBase}/createRoom`, payload);
                logger.log(`[Matrix] Room created: ${data.room_id}`);
                return { output: { roomId: data.room_id } };
            }

            case 'inviteUser': {
                const roomId = String(inputs.roomId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!userId) throw new Error('userId is required.');

                await mx('POST', `${clientBase}/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: userId });
                logger.log(`[Matrix] Invited ${userId} to ${roomId}`);
                return { output: { invited: true } };
            }

            case 'kickUser': {
                const roomId = String(inputs.roomId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!userId) throw new Error('userId is required.');

                const payload: any = { user_id: userId };
                if (inputs.reason) payload.reason = String(inputs.reason);

                await mx('POST', `${clientBase}/rooms/${encodeURIComponent(roomId)}/kick`, payload);
                logger.log(`[Matrix] Kicked ${userId} from ${roomId}`);
                return { output: { kicked: true } };
            }

            case 'banUser': {
                const roomId = String(inputs.roomId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!userId) throw new Error('userId is required.');

                const payload: any = { user_id: userId };
                if (inputs.reason) payload.reason = String(inputs.reason);

                await mx('POST', `${clientBase}/rooms/${encodeURIComponent(roomId)}/ban`, payload);
                logger.log(`[Matrix] Banned ${userId} from ${roomId}`);
                return { output: { banned: true } };
            }

            case 'getProfile': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');

                const data = await mx('GET', `${clientBase}/profile/${encodeURIComponent(userId)}`);
                return { output: { displayname: data.displayname ?? null, avatarUrl: data.avatar_url ?? null } };
            }

            case 'sendReaction': {
                const roomId = String(inputs.roomId ?? '').trim();
                const reactionEventId = String(inputs.reactionEventId ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!reactionEventId) throw new Error('reactionEventId is required.');
                if (!key) throw new Error('key is required.');

                const txnId = Date.now();
                const path = `${clientBase}/rooms/${encodeURIComponent(roomId)}/send/m.reaction/${txnId}`;
                const data = await mx('PUT', path, {
                    'm.relates_to': { rel_type: 'm.annotation', event_id: reactionEventId, key },
                });
                logger.log(`[Matrix] Reaction sent: ${data.event_id}`);
                return { output: { eventId: data.event_id } };
            }

            case 'redactEvent': {
                const roomId = String(inputs.roomId ?? '').trim();
                const eventId = String(inputs.eventId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!eventId) throw new Error('eventId is required.');

                const txnId = Date.now();
                const payload: any = {};
                if (inputs.reason) payload.reason = String(inputs.reason);

                const path = `${clientBase}/rooms/${encodeURIComponent(roomId)}/redact/${eventId}/${txnId}`;
                const data = await mx('PUT', path, payload);
                logger.log(`[Matrix] Event redacted: ${data.event_id}`);
                return { output: { eventId: data.event_id } };
            }

            default:
                return { error: `Matrix action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Matrix action failed.' };
    }
}
