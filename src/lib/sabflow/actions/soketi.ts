'use server';

import { createHmac } from 'crypto';

function soketiSign(secret: string, stringToSign: string): string {
    return createHmac('sha256', secret).update(stringToSign).digest('hex');
}

function soketiAuthQuery(appKey: string, secret: string, method: string, path: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyMd5 = body
        ? require('crypto').createHash('md5').update(body).digest('hex')
        : '';
    const params: Record<string, string> = {
        auth_key: appKey,
        auth_timestamp: timestamp,
        auth_version: '1.0',
    };
    if (bodyMd5) params['body_md5'] = bodyMd5;
    const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    const stringToSign = [method.toUpperCase(), path, sortedParams].join('\n');
    const signature = soketiSign(secret, stringToSign);
    return `${sortedParams}&auth_signature=${signature}`;
}

export async function executeSoketiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const appKey = inputs.appKey;
        const appSecret = inputs.appSecret;
        const host = (inputs.host || 'http://localhost:6001').replace(/\/$/, '');
        const appId = inputs.appId;

        if (!appKey || !appSecret) {
            return { error: 'Missing required credentials: appKey and appSecret' };
        }

        const apiFetch = async (path: string, method = 'GET', body?: any) => {
            const bodyStr = body !== undefined ? JSON.stringify(body) : '';
            const authQuery = soketiAuthQuery(appKey, appSecret, method, path, bodyStr);
            const url = `${host}${path}?${authQuery}`;
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: bodyStr || undefined,
            });
            if (res.status === 200 && res.headers.get('content-length') === '0') return { success: true };
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
            return data;
        };

        const adminFetch = async (path: string, method = 'GET', body?: any) => {
            const bodyStr = body !== undefined ? JSON.stringify(body) : '';
            const res = await fetch(`${host}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-soketi-secret': appSecret,
                },
                body: bodyStr || undefined,
            });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
            return data;
        };

        if (!appId && !['createApp', 'listApps', 'getApp'].includes(actionName)) {
            logger.log(`Soketi: appId not set for action ${actionName}, continuing anyway`);
        }

        logger.log(`Executing Soketi action: ${actionName}`);

        switch (actionName) {
            case 'trigger': {
                const channels = Array.isArray(inputs.channels) ? inputs.channels : [inputs.channel];
                const path = `/apps/${appId}/events`;
                const data = await apiFetch(path, 'POST', {
                    name: inputs.event,
                    channels,
                    data: typeof inputs.data === 'string' ? inputs.data : JSON.stringify(inputs.data),
                });
                return { output: { result: data } };
            }
            case 'triggerBatch': {
                const path = `/apps/${appId}/batch_events`;
                const data = await apiFetch(path, 'POST', { batch: inputs.batch });
                return { output: { result: data } };
            }
            case 'listChannels': {
                const params = new URLSearchParams();
                if (inputs.filterByPrefix) params.append('filter_by_prefix', inputs.filterByPrefix);
                const query = params.toString() ? `&${params.toString()}` : '';
                const path = `/apps/${appId}/channels`;
                const data = await apiFetch(`${path}${query ? '?' + query : ''}`);
                return { output: { channels: data?.channels || data } };
            }
            case 'getChannelInfo': {
                const channel = encodeURIComponent(inputs.channel);
                const path = `/apps/${appId}/channels/${channel}`;
                const data = await apiFetch(path);
                return { output: { channel: data } };
            }
            case 'getChannelUsers': {
                const channel = encodeURIComponent(inputs.channel);
                const path = `/apps/${appId}/channels/${channel}/users`;
                const data = await apiFetch(path);
                return { output: { users: data?.users || data } };
            }
            case 'getAppStats': {
                const path = `/apps/${appId}/channels`;
                const data = await apiFetch(path);
                return { output: { stats: data } };
            }
            case 'createApp': {
                const data = await adminFetch('/api/v1/apps', 'POST', {
                    id: inputs.newAppId,
                    key: inputs.newAppKey,
                    secret: inputs.newAppSecret,
                    maxConnections: inputs.maxConnections,
                    enableUserAuthentication: inputs.enableUserAuthentication,
                    enableClientMessages: inputs.enableClientMessages,
                    maxBackendEventsPerSecond: inputs.maxBackendEventsPerSecond,
                    maxClientEventsPerSecond: inputs.maxClientEventsPerSecond,
                });
                return { output: { app: data } };
            }
            case 'updateApp': {
                const data = await adminFetch(`/api/v1/apps/${inputs.targetAppId}`, 'PUT', {
                    maxConnections: inputs.maxConnections,
                    enableUserAuthentication: inputs.enableUserAuthentication,
                    enableClientMessages: inputs.enableClientMessages,
                    maxBackendEventsPerSecond: inputs.maxBackendEventsPerSecond,
                    maxClientEventsPerSecond: inputs.maxClientEventsPerSecond,
                });
                return { output: { app: data } };
            }
            case 'deleteApp': {
                const data = await adminFetch(`/api/v1/apps/${inputs.targetAppId}`, 'DELETE');
                return { output: { result: data } };
            }
            case 'listApps': {
                const data = await adminFetch('/api/v1/apps');
                return { output: { apps: data } };
            }
            case 'getApp': {
                const data = await adminFetch(`/api/v1/apps/${inputs.targetAppId}`);
                return { output: { app: data } };
            }
            case 'authenticateChannel': {
                const socketId = inputs.socketId;
                const channel = inputs.channel;
                const stringToSign = `${socketId}:${channel}`;
                const signature = soketiSign(appSecret, stringToSign);
                const auth = `${appKey}:${signature}`;
                return { output: { auth } };
            }
            case 'listWebhooks': {
                const data = await adminFetch(`/api/v1/apps/${appId || inputs.targetAppId}/webhooks`);
                return { output: { webhooks: data } };
            }
            case 'createWebhook': {
                const data = await adminFetch(`/api/v1/apps/${appId || inputs.targetAppId}/webhooks`, 'POST', {
                    url: inputs.url,
                    event_types: inputs.eventTypes,
                    headers: inputs.webhookHeaders,
                });
                return { output: { webhook: data } };
            }
            case 'getWebhookStats': {
                const data = await adminFetch(`/api/v1/apps/${appId || inputs.targetAppId}/webhooks/stats`);
                return { output: { stats: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Soketi action error: ${err.message}`);
        return { error: err.message || 'Soketi action failed' };
    }
}
