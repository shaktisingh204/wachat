'use server';

export async function executeRocketChatAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const userId = String(inputs.userId ?? '').trim();
        const authToken = String(inputs.authToken ?? '').trim();
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '');
        const baseUrl = `${serverUrl}/api/v1`;

        const headers: Record<string, string> = {
            'X-User-Id': userId,
            'X-Auth-Token': authToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/chat.sendMessage`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message: {
                            rid: inputs.roomId,
                            msg: inputs.message,
                            alias: inputs.alias,
                            emoji: inputs.emoji,
                            avatar: inputs.avatar,
                            attachments: inputs.attachments || [],
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { message: data.message } };
            }

            case 'sendDirectMessage': {
                const openRes = await fetch(`${baseUrl}/im.create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ username: inputs.username }),
                });
                const openData = await openRes.json();
                if (!openRes.ok || !openData.success) throw new Error(openData?.error || `API error: ${openRes.status}`);
                const roomId = openData.room?.rid;
                const res = await fetch(`${baseUrl}/chat.sendMessage`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ message: { rid: roomId, msg: inputs.message } }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { message: data.message } };
            }

            case 'listChannels': {
                const params = new URLSearchParams({ count: String(inputs.count || 50) });
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.sort) params.set('sort', inputs.sort);
                const res = await fetch(`${baseUrl}/channels.list?${params}`, { headers });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channels: data.channels || [], total: data.total } };
            }

            case 'getChannel': {
                const params = new URLSearchParams();
                if (inputs.roomId) params.set('roomId', inputs.roomId);
                if (inputs.roomName) params.set('roomName', inputs.roomName);
                const res = await fetch(`${baseUrl}/channels.info?${params}`, { headers });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'createChannel': {
                const res = await fetch(`${baseUrl}/channels.create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        members: inputs.members || [],
                        readOnly: inputs.readOnly || false,
                        customFields: inputs.customFields || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'listUsers': {
                const params = new URLSearchParams({ count: String(inputs.count || 50) });
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.fields) params.set('fields', JSON.stringify(inputs.fields));
                const res = await fetch(`${baseUrl}/users.list?${params}`, { headers });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { users: data.users || [], total: data.total } };
            }

            case 'getUser': {
                const params = new URLSearchParams();
                if (inputs.userId2) params.set('userId', inputs.userId2);
                if (inputs.username) params.set('username', inputs.username);
                const res = await fetch(`${baseUrl}/users.info?${params}`, { headers });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { user: data.user } };
            }

            case 'createUser': {
                const res = await fetch(`${baseUrl}/users.create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        email: inputs.email,
                        name: inputs.name,
                        password: inputs.password,
                        username: inputs.username,
                        roles: inputs.roles || ['user'],
                        verified: inputs.verified || false,
                        requirePasswordChange: inputs.requirePasswordChange || false,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { user: data.user } };
            }

            case 'setUserStatus': {
                const res = await fetch(`${baseUrl}/users.setStatus`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message: inputs.message,
                        status: inputs.status,
                        userId: inputs.targetUserId,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: 'status updated' } };
            }

            case 'listRooms': {
                const params = new URLSearchParams({ count: String(inputs.count || 50) });
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/rooms.get?${params}`, { headers });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { rooms: data.update || [], removed: data.remove || [] } };
            }

            case 'getRoomInfo': {
                const params = new URLSearchParams();
                if (inputs.roomId) params.set('roomId', inputs.roomId);
                const res = await fetch(`${baseUrl}/rooms.info?${params}`, { headers });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { room: data.room } };
            }

            case 'kickUser': {
                const res = await fetch(`${baseUrl}/channels.kick`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ roomId: inputs.roomId, userId: inputs.targetUserId }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { result: 'user kicked' } };
            }

            case 'addUserToRoom': {
                const res = await fetch(`${baseUrl}/channels.invite`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ roomId: inputs.roomId, userId: inputs.targetUserId }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { channel: data.channel } };
            }

            case 'uploadFile': {
                const encoded = Buffer.from(String(inputs.content ?? '')).toString('base64');
                const res = await fetch(`${baseUrl}/rooms.upload/${inputs.roomId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        file: encoded,
                        filename: inputs.filename,
                        description: inputs.description,
                        msg: inputs.msg || '',
                        tmid: inputs.tmid,
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { message: data.message } };
            }

            case 'searchMessages': {
                const params = new URLSearchParams({ roomId: inputs.roomId, searchText: inputs.searchText });
                if (inputs.count) params.set('count', String(inputs.count));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/chat.search?${params}`, { headers });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data?.error || `API error: ${res.status}`);
                return { output: { messages: data.messages?.docs || [], total: data.messages?.total } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
