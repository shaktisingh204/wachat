
'use server';

const PUSHOVER_BASE = 'https://api.pushover.net/1';

async function poGet(url: string, logger?: any): Promise<any> {
    logger?.log(`[Pushover] GET ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data.status === 0) {
        throw new Error(
            (Array.isArray(data.errors) ? data.errors.join(', ') : undefined) ||
            data.error ||
            `Pushover API error: ${res.status}`
        );
    }
    return data;
}

async function poPost(path: string, params: URLSearchParams, logger?: any): Promise<any> {
    const url = `${PUSHOVER_BASE}${path}`;
    logger?.log(`[Pushover] POST ${path}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok || data.status === 0) {
        throw new Error(
            (Array.isArray(data.errors) ? data.errors.join(', ') : undefined) ||
            data.error ||
            `Pushover API error: ${res.status}`
        );
    }
    return data;
}

export async function executePushoverAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const userKey = String(inputs.userKey ?? '').trim();
        if (!token) throw new Error('token is required.');
        if (!userKey) throw new Error('userKey is required.');

        switch (actionName) {
            case 'sendNotification': {
                const message = String(inputs.message ?? '').trim();
                if (!message) throw new Error('message is required.');

                const params = new URLSearchParams({ token, user: userKey, message });
                if (inputs.title) params.set('title', String(inputs.title));
                if (inputs.url) params.set('url', String(inputs.url));
                if (inputs.urlTitle) params.set('url_title', String(inputs.urlTitle));
                params.set('priority', String(inputs.priority ?? 0));
                if (inputs.sound) params.set('sound', String(inputs.sound));
                if (inputs.device) params.set('device', String(inputs.device));
                if (inputs.timestamp) params.set('timestamp', String(inputs.timestamp));
                params.set('html', inputs.html ? '1' : '0');

                const data = await poPost('/messages.json', params, logger);
                logger.log(`[Pushover] Notification sent: request=${data.request}`);
                return { output: { status: data.status, request: data.request } };
            }

            case 'sendEmergency': {
                const message = String(inputs.message ?? '').trim();
                if (!message) throw new Error('message is required.');

                const params = new URLSearchParams({
                    token,
                    user: userKey,
                    message,
                    priority: '2',
                    retry: String(inputs.retry ?? 60),
                    expire: String(inputs.expire ?? 3600),
                });
                if (inputs.title) params.set('title', String(inputs.title));
                if (inputs.callbackUrl) params.set('callback', String(inputs.callbackUrl));

                const data = await poPost('/messages.json', params, logger);
                logger.log(`[Pushover] Emergency sent: receipt=${data.receipt}`);
                return { output: { status: data.status, request: data.request, receipt: data.receipt } };
            }

            case 'cancelEmergency': {
                const receipt = String(inputs.receipt ?? '').trim();
                if (!receipt) throw new Error('receipt is required.');

                const params = new URLSearchParams({ token });
                const data = await poPost(`/receipts/${receipt}/cancel.json`, params, logger);
                logger.log(`[Pushover] Emergency cancelled: receipt=${receipt}`);
                return { output: { status: data.status } };
            }

            case 'checkReceipt': {
                const receipt = String(inputs.receipt ?? '').trim();
                if (!receipt) throw new Error('receipt is required.');

                const url = `${PUSHOVER_BASE}/receipts/${receipt}.json?token=${encodeURIComponent(token)}`;
                const data = await poGet(url, logger);
                return {
                    output: {
                        status: data.status,
                        acknowledged: data.acknowledged,
                        lastDeliveredAt: data.last_delivered_at,
                        expired: data.expired,
                        calledBack: data.called_back,
                    },
                };
            }

            case 'getGroups': {
                const groupKey = String(inputs.groupKey ?? '').trim();
                if (!groupKey) throw new Error('groupKey is required.');

                const url = `${PUSHOVER_BASE}/groups/${encodeURIComponent(groupKey)}.json?token=${encodeURIComponent(token)}`;
                const data = await poGet(url, logger);
                return { output: { status: data.status, name: data.name, users: data.users ?? [] } };
            }

            case 'addUserToGroup': {
                const groupKey = String(inputs.groupKey ?? '').trim();
                const groupUser = String(inputs.user ?? '').trim();
                if (!groupKey) throw new Error('groupKey is required.');
                if (!groupUser) throw new Error('user is required.');

                const params = new URLSearchParams({ token, user: groupUser });
                if (inputs.device) params.set('device', String(inputs.device));
                if (inputs.memo) params.set('memo', String(inputs.memo));

                const data = await poPost(`/groups/${encodeURIComponent(groupKey)}/add_user.json`, params, logger);
                return { output: { status: data.status } };
            }

            case 'removeUserFromGroup': {
                const groupKey = String(inputs.groupKey ?? '').trim();
                const groupUser = String(inputs.user ?? '').trim();
                if (!groupKey) throw new Error('groupKey is required.');
                if (!groupUser) throw new Error('user is required.');

                const params = new URLSearchParams({ token, user: groupUser });
                const data = await poPost(`/groups/${encodeURIComponent(groupKey)}/delete_user.json`, params, logger);
                return { output: { status: data.status } };
            }

            case 'disableUserInGroup': {
                const groupKey = String(inputs.groupKey ?? '').trim();
                const groupUser = String(inputs.user ?? '').trim();
                if (!groupKey) throw new Error('groupKey is required.');
                if (!groupUser) throw new Error('user is required.');

                const params = new URLSearchParams({ token, user: groupUser });
                const data = await poPost(`/groups/${encodeURIComponent(groupKey)}/disable_user.json`, params, logger);
                return { output: { status: data.status } };
            }

            case 'verifyUser': {
                const verifyUser = String(inputs.user ?? '').trim();
                if (!verifyUser) throw new Error('user is required.');

                const params = new URLSearchParams({ token, user: verifyUser });
                if (inputs.device) params.set('device', String(inputs.device));

                const data = await poPost('/users/validate.json', params, logger);
                return { output: { status: data.status, devices: data.devices ?? [] } };
            }

            case 'getSounds': {
                const url = `${PUSHOVER_BASE}/sounds.json?token=${encodeURIComponent(token)}`;
                const data = await poGet(url, logger);
                return { output: { status: data.status, sounds: data.sounds ?? {} } };
            }

            case 'getLimits': {
                const url = `${PUSHOVER_BASE}/apps/limits.json?token=${encodeURIComponent(token)}`;
                const data = await poGet(url, logger);
                return { output: { status: data.status, limit: data.limit, remaining: data.remaining, reset: data.reset } };
            }

            default:
                return { error: `Pushover action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Pushover action failed.' };
    }
}
