'use server';

export async function executeLineMessagingAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.line.me/v2/bot';
        const headers = {
            'Authorization': `Bearer ${inputs.channelAccessToken}`,
            'Content-Type': 'application/json',
        };

        const post = (path: string, body: any) =>
            fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }).then(r => r.json());

        const get = (path: string) =>
            fetch(`${baseUrl}${path}`, { method: 'GET', headers }).then(r => r.json());

        const del = (path: string) =>
            fetch(`${baseUrl}${path}`, { method: 'DELETE', headers }).then(r => r.json());

        switch (actionName) {
            case 'sendReplyMessage': {
                const data = await post('/message/reply', {
                    replyToken: inputs.replyToken,
                    messages: inputs.messages || [{ type: 'text', text: inputs.text }],
                    notificationDisabled: inputs.notificationDisabled || false,
                });
                return { output: data };
            }

            case 'sendPushMessage': {
                const data = await post('/message/push', {
                    to: inputs.to,
                    messages: inputs.messages || [{ type: 'text', text: inputs.text }],
                    notificationDisabled: inputs.notificationDisabled || false,
                });
                return { output: data };
            }

            case 'sendBroadcastMessage': {
                const data = await post('/message/broadcast', {
                    messages: inputs.messages || [{ type: 'text', text: inputs.text }],
                    notificationDisabled: inputs.notificationDisabled || false,
                });
                return { output: data };
            }

            case 'sendMulticastMessage': {
                const data = await post('/message/multicast', {
                    to: inputs.to || [],
                    messages: inputs.messages || [{ type: 'text', text: inputs.text }],
                    notificationDisabled: inputs.notificationDisabled || false,
                });
                return { output: data };
            }

            case 'getProfile': {
                const data = await get(`/profile/${inputs.userId}`);
                return { output: data };
            }

            case 'getGroupMemberProfile': {
                const data = await get(`/group/${inputs.groupId}/member/${inputs.userId}`);
                return { output: data };
            }

            case 'leaveGroup': {
                const data = await post(`/group/${inputs.groupId}/leave`, {});
                return { output: data };
            }

            case 'getMessageContent': {
                const res = await fetch(`https://api-data.line.me/v2/bot/message/${inputs.messageId}/content`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${inputs.channelAccessToken}` },
                });
                if (!res.ok) {
                    return { error: `LINE getMessageContent failed: ${res.status} ${res.statusText}` };
                }
                return { output: { messageId: inputs.messageId, contentType: res.headers.get('content-type'), status: 'fetched' } };
            }

            case 'sendFlexMessage': {
                const data = await post('/message/push', {
                    to: inputs.to,
                    messages: [{
                        type: 'flex',
                        altText: inputs.altText || 'Flex Message',
                        contents: inputs.contents,
                    }],
                });
                return { output: data };
            }

            case 'sendImagemapMessage': {
                const data = await post('/message/push', {
                    to: inputs.to,
                    messages: [{
                        type: 'imagemap',
                        baseUrl: inputs.baseUrl,
                        altText: inputs.altText || 'Imagemap Message',
                        baseSize: inputs.baseSize || { width: 1040, height: 585 },
                        actions: inputs.actions || [],
                    }],
                });
                return { output: data };
            }

            case 'createRichMenu': {
                const data = await post('/richmenu', {
                    size: inputs.size || { width: 2500, height: 843 },
                    selected: inputs.selected || false,
                    name: inputs.name,
                    chatBarText: inputs.chatBarText || 'Tap to open',
                    areas: inputs.areas || [],
                });
                return { output: data };
            }

            case 'setDefaultRichMenu': {
                const res = await fetch(`${baseUrl}/user/all/richmenu/${inputs.richMenuId}`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteRichMenu': {
                const data = await del(`/richmenu/${inputs.richMenuId}`);
                return { output: data };
            }

            case 'sendNarrowcastMessage': {
                const data = await post('/message/narrowcast', {
                    messages: inputs.messages || [{ type: 'text', text: inputs.text }],
                    recipient: inputs.recipient,
                    filter: inputs.filter,
                    limit: inputs.limit,
                    notificationDisabled: inputs.notificationDisabled || false,
                });
                return { output: data };
            }

            case 'sendLoadingAnimation': {
                const data = await post('/chat/loading/start', {
                    chatId: inputs.chatId,
                    loadingSeconds: inputs.loadingSeconds || 5,
                });
                return { output: data };
            }

            default:
                return { error: `LINE Messaging action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'LINE Messaging action failed with an unknown error.' };
    }
}
