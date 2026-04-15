
'use server';

async function rcFetch(
    serverUrl: string,
    authToken: string,
    userId: string,
    method: string,
    path: string,
    body?: any,
    isFormData?: boolean,
    logger?: any
): Promise<any> {
    const base = String(serverUrl).replace(/\/$/, '');
    const url = `${base}/api/v1${path}`;
    logger?.log(`[RocketChat] ${method} ${path}`);

    const headers: Record<string, string> = {
        'X-Auth-Token': authToken,
        'X-User-Id': userId,
    };
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const options: RequestInit = { method, headers };
    if (body !== undefined) {
        options.body = isFormData ? (body as FormData) : JSON.stringify(body);
    }

    const res = await fetch(url, options);

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Rocket.Chat API error: ${res.status}`);
    }
    return data;
}

export async function executeRocketchatAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        const authToken = String(inputs.authToken ?? '').trim();
        const userId = String(inputs.userId ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!authToken) throw new Error('authToken is required.');
        if (!userId) throw new Error('userId is required.');

        const rc = (method: string, path: string, body?: any, isFormData?: boolean) =>
            rcFetch(serverUrl, authToken, userId, method, path, body, isFormData, logger);

        switch (actionName) {
            case 'sendMessage': {
                const roomId = String(inputs.roomId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!text) throw new Error('text is required.');

                const message: any = { rid: roomId, msg: text };
                if (inputs.alias) message.alias = String(inputs.alias);
                if (inputs.emoji) message.emoji = String(inputs.emoji);

                const data = await rc('POST', '/chat.sendMessage', { message });
                logger.log(`[RocketChat] Message sent to ${roomId}`);
                return { output: { message: { id: data.message?._id, msg: data.message?.msg } } };
            }

            case 'sendDirectMessage': {
                const username = String(inputs.username ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!username) throw new Error('username is required.');
                if (!text) throw new Error('text is required.');

                const data = await rc('POST', '/chat.postMessage', { channel: `@${username}`, text });
                logger.log(`[RocketChat] Direct message sent to @${username}`);
                return { output: { message: data.message ?? {} } };
            }

            case 'getChannels': {
                const data = await rc('GET', '/channels.list');
                return { output: { channels: data.channels ?? [] } };
            }

            case 'createChannel': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');

                const payload: any = { name };
                if (inputs.members) {
                    payload.members = Array.isArray(inputs.members)
                        ? inputs.members
                        : String(inputs.members).split(',').map((s: string) => s.trim()).filter(Boolean);
                }
                if (inputs.readOnly !== undefined) payload.readOnly = Boolean(inputs.readOnly);

                const data = await rc('POST', '/channels.create', payload);
                logger.log(`[RocketChat] Channel created: ${data.channel?.name}`);
                return { output: { channel: { id: data.channel?._id, name: data.channel?.name } } };
            }

            case 'joinChannel': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                const data = await rc('POST', '/channels.join', { roomId });
                logger.log(`[RocketChat] Joined channel: ${roomId}`);
                return { output: { channel: data.channel ?? {} } };
            }

            case 'leaveChannel': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                await rc('POST', '/channels.leave', { roomId });
                logger.log(`[RocketChat] Left channel: ${roomId}`);
                return { output: { left: true } };
            }

            case 'getMessages': {
                const roomId = String(inputs.roomId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');

                const params = new URLSearchParams({ roomId });
                if (inputs.count !== undefined && inputs.count !== '')
                    params.set('count', String(inputs.count));
                if (inputs.oldest !== undefined && inputs.oldest !== '')
                    params.set('oldest', String(inputs.oldest));

                const data = await rc('GET', `/channels.messages?${params.toString()}`);
                return { output: { messages: data.messages ?? [] } };
            }

            case 'getUsers': {
                const data = await rc('GET', '/users.list');
                return { output: { users: data.users ?? [] } };
            }

            case 'getUser': {
                const username = String(inputs.username ?? '').trim();
                if (!username) throw new Error('username is required.');

                const data = await rc('GET', `/users.info?username=${encodeURIComponent(username)}`);
                return { output: { user: data.user ?? {} } };
            }

            case 'setUserStatus': {
                const payload: any = {};
                if (inputs.message !== undefined) payload.message = String(inputs.message);
                if (inputs.status !== undefined) payload.status = String(inputs.status);

                const data = await rc('POST', '/users.setStatus', payload);
                logger.log('[RocketChat] User status updated');
                return { output: { success: data.success ?? true } };
            }

            case 'uploadFile': {
                const roomId = String(inputs.roomId ?? '').trim();
                const filename = String(inputs.filename ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!filename) throw new Error('filename is required.');

                const formData = new FormData();
                if (inputs.description) formData.append('description', String(inputs.description));
                if (inputs.fileContent) {
                    const buffer = Buffer.from(String(inputs.fileContent), 'base64');
                    const blob = new Blob([buffer]);
                    formData.append('file', blob, filename);
                } else {
                    formData.append('file', new Blob(['']), filename);
                }

                const base = String(serverUrl).replace(/\/$/, '');
                const uploadRes = await fetch(`${base}/api/v1/rooms.upload/${roomId}`, {
                    method: 'POST',
                    headers: {
                        'X-Auth-Token': authToken,
                        'X-User-Id': userId,
                    },
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData?.error || `File upload error: ${uploadRes.status}`);
                logger.log(`[RocketChat] File uploaded to ${roomId}`);
                return { output: { message: uploadData.message ?? {} } };
            }

            case 'createDirectRoom': {
                const username = String(inputs.username ?? '').trim();
                if (!username) throw new Error('username is required.');

                const data = await rc('POST', '/dm.create', { username });
                logger.log(`[RocketChat] Direct room created with ${username}`);
                return { output: { room: data.room ?? {} } };
            }

            case 'pinMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');

                const data = await rc('POST', '/chat.pinMessage', { messageId });
                logger.log(`[RocketChat] Message pinned: ${messageId}`);
                return { output: { message: data.message ?? {} } };
            }

            default:
                return { error: `Rocket.Chat action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Rocket.Chat action failed.' };
    }
}
