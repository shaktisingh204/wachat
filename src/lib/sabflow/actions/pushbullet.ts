
'use server';

const PUSHBULLET_BASE = 'https://api.pushbullet.com/v2';

async function pbFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${PUSHBULLET_BASE}${path}`;
    logger?.log(`[Pushbullet] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            'Access-Token': apiKey,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204) return { deleted: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || `Pushbullet API error: ${res.status}`);
    }
    return data;
}

export async function executePushbulletAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const pb = (method: string, path: string, body?: any) =>
            pbFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'sendNote': {
                const title = String(inputs.title ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!body) throw new Error('body is required.');

                const payload: any = { type: 'note', title, body };
                if (inputs.deviceIden) payload.device_iden = String(inputs.deviceIden);
                if (inputs.email) payload.email = String(inputs.email);
                if (inputs.channelTag) payload.channel_tag = String(inputs.channelTag);

                const data = await pb('POST', '/pushes', payload);
                logger.log(`[Pushbullet] Note sent: ${data.iden}`);
                return { output: { iden: data.iden, type: data.type, title: data.title } };
            }

            case 'sendLink': {
                const title = String(inputs.title ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!url) throw new Error('url is required.');

                const payload: any = { type: 'link', title, url };
                if (inputs.body) payload.body = String(inputs.body);
                if (inputs.deviceIden) payload.device_iden = String(inputs.deviceIden);
                if (inputs.email) payload.email = String(inputs.email);

                const data = await pb('POST', '/pushes', payload);
                logger.log(`[Pushbullet] Link sent: ${data.iden}`);
                return { output: { iden: data.iden, url: data.url } };
            }

            case 'sendFile': {
                const fileName = String(inputs.fileName ?? '').trim();
                const fileType = String(inputs.fileType ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!fileName) throw new Error('fileName is required.');
                if (!fileType) throw new Error('fileType is required.');
                if (!fileUrl) throw new Error('fileUrl is required.');

                const payload: any = { type: 'file', file_name: fileName, file_type: fileType, file_url: fileUrl };
                if (inputs.body) payload.body = String(inputs.body);
                if (inputs.deviceIden) payload.device_iden = String(inputs.deviceIden);

                const data = await pb('POST', '/pushes', payload);
                logger.log(`[Pushbullet] File push sent: ${data.iden}`);
                return { output: { iden: data.iden } };
            }

            case 'listPushes': {
                const params = new URLSearchParams();
                if (inputs.modifiedAfter !== undefined && inputs.modifiedAfter !== '')
                    params.set('modified_after', String(inputs.modifiedAfter));
                if (inputs.limit !== undefined && inputs.limit !== '')
                    params.set('limit', String(inputs.limit));

                const qs = params.toString();
                const data = await pb('GET', `/pushes${qs ? `?${qs}` : ''}`);
                return { output: { pushes: data.pushes ?? [] } };
            }

            case 'deletePush': {
                const pushIden = String(inputs.pushIden ?? '').trim();
                if (!pushIden) throw new Error('pushIden is required.');

                await pb('DELETE', `/pushes/${pushIden}`);
                logger.log(`[Pushbullet] Push deleted: ${pushIden}`);
                return { output: { deleted: true } };
            }

            case 'listDevices': {
                const data = await pb('GET', '/devices');
                return { output: { devices: data.devices ?? [] } };
            }

            case 'createDevice': {
                const nickname = String(inputs.nickname ?? '').trim();
                if (!nickname) throw new Error('nickname is required.');

                const payload: any = { nickname };
                if (inputs.model) payload.model = String(inputs.model);
                if (inputs.pushToken) payload.push_token = String(inputs.pushToken);

                const data = await pb('POST', '/devices', payload);
                logger.log(`[Pushbullet] Device created: ${data.iden}`);
                return { output: { iden: data.iden, nickname: data.nickname } };
            }

            case 'getMe': {
                const data = await pb('GET', '/users/me');
                return { output: { iden: data.iden, email: data.email, name: data.name, created: data.created } };
            }

            case 'listChats': {
                const data = await pb('GET', '/chats');
                return { output: { chats: data.chats ?? [] } };
            }

            case 'createChat': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');

                const data = await pb('POST', '/chats', { email });
                logger.log(`[Pushbullet] Chat created: ${data.iden}`);
                return { output: { iden: data.iden } };
            }

            case 'listChannels': {
                const data = await pb('GET', '/subscriptions');
                return { output: { subscriptions: data.subscriptions ?? [] } };
            }

            case 'subscribeChannel': {
                const channelTag = String(inputs.channelTag ?? '').trim();
                if (!channelTag) throw new Error('channelTag is required.');

                const data = await pb('POST', '/subscriptions', { channel_tag: channelTag });
                logger.log(`[Pushbullet] Subscribed to channel: ${channelTag}`);
                return { output: { iden: data.iden } };
            }

            default:
                return { error: `Pushbullet action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Pushbullet action failed.' };
    }
}
