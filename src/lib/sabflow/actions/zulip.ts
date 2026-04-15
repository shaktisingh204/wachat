'use server';

export async function executeZulipAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const { serverUrl, email, apiKey } = inputs;

        if (!serverUrl) return { error: 'Zulip: serverUrl is required.' };
        if (!email) return { error: 'Zulip: email is required.' };
        if (!apiKey) return { error: 'Zulip: apiKey is required.' };

        const baseUrl = `${serverUrl.replace(/\/$/, '')}/api/v1`;
        const authHeader = `Basic ${Buffer.from(`${email}:${apiKey}`).toString('base64')}`;

        const headers: Record<string, string> = {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        const jsonHeaders: Record<string, string> = {
            Authorization: authHeader,
            Accept: 'application/json',
        };

        async function apiRequest(
            method: string,
            path: string,
            body?: URLSearchParams
        ): Promise<any> {
            const opts: RequestInit = {
                method,
                headers: body ? headers : jsonHeaders,
            };
            if (body) opts.body = body.toString();

            const res = await fetch(`${baseUrl}${path}`, opts);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.msg || `Zulip API error: ${res.status}`);
            }
            return data;
        }

        // Helper: core sendMessage
        async function sendMessageCore(
            type: string,
            to: string,
            content: string,
            topic?: string
        ) {
            const body = new URLSearchParams({ type, to, content });
            if (topic) body.set('topic', topic);
            const data = await apiRequest('POST', '/messages', body);
            return { output: { id: data.id, msg: data.msg } };
        }

        logger.log(`Executing Zulip action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'sendMessage': {
                const { type, to, content, topic } = inputs;
                if (!type) return { error: 'Zulip sendMessage: type is required.' };
                if (!to) return { error: 'Zulip sendMessage: to is required.' };
                if (!content) return { error: 'Zulip sendMessage: content is required.' };
                const toStr =
                    type === 'stream'
                        ? (typeof to === 'string' ? to : JSON.stringify(to))
                        : JSON.stringify(Array.isArray(to) ? to : [to]);
                return sendMessageCore(type, toStr, content, topic);
            }

            case 'sendStreamMessage': {
                const { stream, topic, content } = inputs;
                if (!stream) return { error: 'Zulip sendStreamMessage: stream is required.' };
                if (!topic) return { error: 'Zulip sendStreamMessage: topic is required.' };
                if (!content) return { error: 'Zulip sendStreamMessage: content is required.' };
                const result = await sendMessageCore('stream', stream, content, topic);
                return { output: { id: (result as any).output?.id } };
            }

            case 'sendDirectMessage': {
                const { toUserIds, content } = inputs;
                if (!toUserIds) return { error: 'Zulip sendDirectMessage: toUserIds is required.' };
                if (!content) return { error: 'Zulip sendDirectMessage: content is required.' };
                const ids = Array.isArray(toUserIds) ? toUserIds : [toUserIds];
                const result = await sendMessageCore('direct', JSON.stringify(ids), content);
                return { output: { id: (result as any).output?.id } };
            }

            case 'getMessages': {
                const { anchor, numBefore, numAfter, narrow } = inputs;
                const params = new URLSearchParams({
                    anchor: anchor ?? 'newest',
                    num_before: String(numBefore ?? 20),
                    num_after: String(numAfter ?? 0),
                    narrow: encodeURIComponent(JSON.stringify(narrow ?? [])),
                });
                const data = await apiRequest('GET', `/messages?${params.toString()}`);
                return {
                    output: {
                        messages: (data.messages ?? []).map((m: any) => ({
                            id: m.id,
                            content: m.content,
                            sender_full_name: m.sender_full_name,
                            timestamp: m.timestamp,
                            type: m.type,
                            stream_id: m.stream_id,
                            subject: m.subject,
                        })),
                    },
                };
            }

            case 'updateMessage': {
                const { messageId, content, topic } = inputs;
                if (!messageId) return { error: 'Zulip updateMessage: messageId is required.' };
                const body = new URLSearchParams({ propagate_mode: 'change_later' });
                if (content) body.set('content', content);
                if (topic) body.set('topic', topic);
                const data = await apiRequest('PATCH', `/messages/${messageId}`, body);
                return { output: { msg: data.msg } };
            }

            case 'deleteMessage': {
                const { messageId } = inputs;
                if (!messageId) return { error: 'Zulip deleteMessage: messageId is required.' };
                const data = await apiRequest('DELETE', `/messages/${messageId}`);
                return { output: { msg: data.msg } };
            }

            case 'addReaction': {
                const { messageId, emojiName } = inputs;
                if (!messageId) return { error: 'Zulip addReaction: messageId is required.' };
                if (!emojiName) return { error: 'Zulip addReaction: emojiName is required.' };
                const body = new URLSearchParams({
                    emoji_name: emojiName,
                    emoji_code: '',
                    reaction_type: 'unicode_emoji',
                });
                const data = await apiRequest('POST', `/messages/${messageId}/reactions`, body);
                return { output: { msg: data.msg } };
            }

            case 'getStreams': {
                const data = await apiRequest('GET', '/streams');
                return {
                    output: {
                        streams: (data.streams ?? []).map((s: any) => ({
                            stream_id: s.stream_id,
                            name: s.name,
                            description: s.description,
                        })),
                    },
                };
            }

            case 'createStream': {
                const { name, description, isWebPublic, isPrivate } = inputs;
                if (!name) return { error: 'Zulip createStream: name is required.' };
                const sub: Record<string, any> = { name };
                if (description) sub.description = description;
                const body = new URLSearchParams({
                    subscriptions: JSON.stringify([sub]),
                });
                if (isWebPublic !== undefined) body.set('is_web_public', String(isWebPublic));
                if (isPrivate !== undefined) body.set('invite_only', String(isPrivate));
                const data = await apiRequest('POST', '/users/me/subscriptions', body);
                return {
                    output: {
                        already_subscribed: data.already_subscribed ?? {},
                        subscribed: data.subscribed ?? {},
                    },
                };
            }

            case 'getUsers': {
                const data = await apiRequest('GET', '/users');
                return {
                    output: {
                        members: (data.members ?? []).map((m: any) => ({
                            user_id: m.user_id,
                            full_name: m.full_name,
                            email: m.email,
                            is_active: m.is_active,
                            is_bot: m.is_bot,
                        })),
                    },
                };
            }

            case 'getUser': {
                const { userId } = inputs;
                if (!userId) return { error: 'Zulip getUser: userId is required.' };
                const data = await apiRequest('GET', `/users/${userId}`);
                return {
                    output: {
                        user: {
                            user_id: data.user?.user_id,
                            full_name: data.user?.full_name,
                            email: data.user?.email,
                        },
                    },
                };
            }

            case 'getUserPresence': {
                const { email: presenceEmail } = inputs;
                if (!presenceEmail) return { error: 'Zulip getUserPresence: email is required.' };
                const data = await apiRequest(
                    'GET',
                    `/users/${encodeURIComponent(presenceEmail)}/presence`
                );
                return {
                    output: {
                        presence: {
                            zulip: {
                                status: data.presence?.zulip?.status,
                                timestamp: data.presence?.zulip?.timestamp,
                            },
                        },
                    },
                };
            }

            case 'updateUserStatus': {
                const { statusText, emojiName } = inputs;
                const body = new URLSearchParams();
                if (statusText !== undefined) body.set('status_text', statusText);
                if (emojiName !== undefined) body.set('emoji_name', emojiName);
                const data = await apiRequest('POST', '/users/me/status', body);
                return { output: { msg: data.msg } };
            }

            case 'getServerInfo': {
                const data = await apiRequest('GET', '/server_settings');
                return {
                    output: {
                        realm_uri: data.realm_uri,
                        server_generation: data.server_generation,
                        zulip_version: data.zulip_version,
                    },
                };
            }

            default:
                return { error: `Zulip: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Zulip action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Zulip: An unexpected error occurred.' };
    }
}
