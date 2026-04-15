
'use server';

const LINE_BOT_BASE = 'https://api.line.me/v2/bot';

async function lineFetch(
    channelAccessToken: string,
    method: string,
    url: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[LINE] ${method} ${url}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${channelAccessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    // Some LINE endpoints return 200 with empty body on success (e.g. leave)
    if (res.status === 200 && method !== 'GET') {
        const text = await res.text();
        if (!text || text === '{}') return { success: true };
        try { return JSON.parse(text); } catch { return { success: true }; }
    }

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `LINE API error: ${res.status}`);
    }
    return data;
}

function normalizeMessages(messages: any): Array<{ type: string; text: string }> {
    if (Array.isArray(messages)) return messages;
    // Accept a single string as a text message
    const text = String(messages ?? '').trim();
    if (text) return [{ type: 'text', text }];
    return [];
}

export async function executeLineAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const channelAccessToken = String(inputs.channelAccessToken ?? '').trim();
        if (!channelAccessToken) throw new Error('channelAccessToken is required.');

        const line = (method: string, url: string, body?: any) =>
            lineFetch(channelAccessToken, method, url, body, logger);

        switch (actionName) {
            case 'pushMessage': {
                const to = String(inputs.to ?? '').trim();
                if (!to) throw new Error('to is required.');

                const messages = normalizeMessages(inputs.messages);
                if (!messages.length) throw new Error('messages is required.');

                const data = await line('POST', `${LINE_BOT_BASE}/message/push`, { to, messages });
                logger.log(`[LINE] Push message sent to ${to}`);
                return { output: { sentMessages: data.sentMessages ?? [] } };
            }

            case 'replyMessage': {
                const replyToken = String(inputs.replyToken ?? '').trim();
                if (!replyToken) throw new Error('replyToken is required.');

                const messages = normalizeMessages(inputs.messages);
                if (!messages.length) throw new Error('messages is required.');

                const data = await line('POST', `${LINE_BOT_BASE}/message/reply`, { replyToken, messages });
                logger.log('[LINE] Reply message sent');
                return { output: { sentMessages: data.sentMessages ?? [] } };
            }

            case 'broadcastMessage': {
                const messages = normalizeMessages(inputs.messages);
                if (!messages.length) throw new Error('messages is required.');

                const data = await line('POST', `${LINE_BOT_BASE}/message/broadcast`, { messages });
                logger.log('[LINE] Broadcast message sent');
                return { output: { sentMessages: data.sentMessages ?? [] } };
            }

            case 'multicastMessage': {
                const toInput = inputs.to;
                const toList: string[] = Array.isArray(toInput)
                    ? toInput.map(String)
                    : String(toInput ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
                if (!toList.length) throw new Error('to (list of user IDs) is required.');

                const messages = normalizeMessages(inputs.messages);
                if (!messages.length) throw new Error('messages is required.');

                const data = await line('POST', `${LINE_BOT_BASE}/message/multicast`, { to: toList, messages });
                logger.log(`[LINE] Multicast message sent to ${toList.length} users`);
                return { output: { sentMessages: data.sentMessages ?? [] } };
            }

            case 'getProfile': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');

                const data = await line('GET', `${LINE_BOT_BASE}/profile/${encodeURIComponent(userId)}`);
                return {
                    output: {
                        userId: data.userId,
                        displayName: data.displayName,
                        pictureUrl: data.pictureUrl ?? null,
                        statusMessage: data.statusMessage ?? null,
                    },
                };
            }

            case 'getGroupProfile': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');

                const data = await line('GET', `${LINE_BOT_BASE}/group/${encodeURIComponent(groupId)}/summary`);
                return {
                    output: {
                        groupId: data.groupId,
                        groupName: data.groupName,
                        pictureUrl: data.pictureUrl ?? null,
                    },
                };
            }

            case 'getMemberProfile': {
                const groupId = String(inputs.groupId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                if (!userId) throw new Error('userId is required.');

                const data = await line('GET', `${LINE_BOT_BASE}/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`);
                return { output: { userId: data.userId, displayName: data.displayName } };
            }

            case 'leaveGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');

                await line('POST', `${LINE_BOT_BASE}/group/${encodeURIComponent(groupId)}/leave`);
                logger.log(`[LINE] Left group: ${groupId}`);
                return { output: { left: true } };
            }

            case 'getRoomMemberProfile': {
                const roomId = String(inputs.roomId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!roomId) throw new Error('roomId is required.');
                if (!userId) throw new Error('userId is required.');

                const data = await line('GET', `${LINE_BOT_BASE}/room/${encodeURIComponent(roomId)}/member/${encodeURIComponent(userId)}`);
                return { output: { userId: data.userId, displayName: data.displayName } };
            }

            case 'listFollowers': {
                const data = await line('GET', `${LINE_BOT_BASE}/followers/ids`);
                return { output: { userIds: data.userIds ?? [] } };
            }

            case 'createRichMenu': {
                const richMenu = inputs.richMenu;
                if (!richMenu) throw new Error('richMenu is required.');

                const payload = typeof richMenu === 'string' ? JSON.parse(richMenu) : richMenu;
                const data = await line('POST', 'https://api.line.me/v2/bot/richmenu', payload);
                logger.log(`[LINE] Rich menu created: ${data.richMenuId}`);
                return { output: { richMenuId: data.richMenuId } };
            }

            case 'setDefaultRichMenu': {
                const richMenuId = String(inputs.richMenuId ?? '').trim();
                if (!richMenuId) throw new Error('richMenuId is required.');

                await line('POST', `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`);
                logger.log(`[LINE] Default rich menu set: ${richMenuId}`);
                return { output: { set: true } };
            }

            default:
                return { error: `LINE action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'LINE action failed.' };
    }
}
