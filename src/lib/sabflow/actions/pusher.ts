'use server';

import { createHmac } from 'crypto';

function pusherSign(secret: string, stringToSign: string): string {
    return createHmac('sha256', secret).update(stringToSign).digest('hex');
}

function pusherAuthParams(appKey: string, appId: string, secret: string, method: string, path: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyMd5 = body ? require('crypto').createHash('md5').update(body).digest('hex') : '';
    const params: Record<string, string> = {
        auth_key: appKey,
        auth_timestamp: timestamp,
        auth_version: '1.0',
    };
    if (bodyMd5) params['body_md5'] = bodyMd5;
    const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    const stringToSign = [method.toUpperCase(), path, sortedParams].join('\n');
    const signature = pusherSign(secret, stringToSign);
    return `${sortedParams}&auth_signature=${signature}`;
}

export async function executePusherAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { appKey, appId, secret, cluster } = inputs;

        if (!appKey || !appId || !secret || !cluster) {
            return { error: 'Missing required credentials: appKey, appId, secret, cluster' };
        }

        const baseUrl = `https://api-${cluster}.pusher.com/apps/${appId}`;

        const apiFetch = async (path: string, method = 'GET', body?: any) => {
            const bodyStr = body !== undefined ? JSON.stringify(body) : '';
            const fullPath = `/apps/${appId}${path}`;
            const authQuery = pusherAuthParams(appKey, appId, secret, method, fullPath, bodyStr);
            const url = `${baseUrl}${path}?${authQuery}`;
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

        logger.log(`Executing Pusher action: ${actionName}`);

        switch (actionName) {
            case 'trigger': {
                const channels = Array.isArray(inputs.channels) ? inputs.channels : [inputs.channel];
                const data = await apiFetch('/events', 'POST', {
                    name: inputs.event,
                    channels,
                    data: typeof inputs.data === 'string' ? inputs.data : JSON.stringify(inputs.data),
                });
                return { output: { result: data } };
            }
            case 'triggerBatch': {
                const data = await apiFetch('/batch_events', 'POST', {
                    batch: inputs.batch,
                });
                return { output: { result: data } };
            }
            case 'listChannels': {
                const params = new URLSearchParams();
                if (inputs.filterByPrefix) params.append('filter_by_prefix', inputs.filterByPrefix);
                const data = await apiFetch(`/channels${params.toString() ? '?' + params.toString() : ''}`);
                return { output: { channels: data?.channels || data } };
            }
            case 'getChannelInfo': {
                const channel = encodeURIComponent(inputs.channel);
                const params = inputs.info ? `?info=${inputs.info}` : '';
                const data = await apiFetch(`/channels/${channel}${params}`);
                return { output: { channel: data } };
            }
            case 'getChannelUsers': {
                const channel = encodeURIComponent(inputs.channel);
                const data = await apiFetch(`/channels/${channel}/users`);
                return { output: { users: data?.users || data } };
            }
            case 'authenticateChannel': {
                const socketId = inputs.socketId;
                const channel = inputs.channel;
                const stringToSign = `${socketId}:${channel}`;
                const signature = pusherSign(secret, stringToSign);
                const auth = `${appKey}:${signature}`;
                return { output: { auth } };
            }
            case 'authenticatePresence': {
                const socketId = inputs.socketId;
                const channel = inputs.channel;
                const channelData = JSON.stringify({ user_id: inputs.userId, user_info: inputs.userInfo || {} });
                const stringToSign = `${socketId}:${channel}:${channelData}`;
                const signature = pusherSign(secret, stringToSign);
                const auth = `${appKey}:${signature}`;
                return { output: { auth, channel_data: channelData } };
            }
            case 'getAppStats': {
                const data = await apiFetch('/channels');
                return { output: { stats: data } };
            }
            case 'sendNotification': {
                const beamsUrl = `https://${inputs.instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${inputs.instanceId}/publishes/users`;
                const res = await fetch(beamsUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${inputs.beamsSecretKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ users: inputs.users, webhooks: inputs.webhooks, apns: inputs.apns, fcm: inputs.fcm }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.description || `HTTP ${res.status}`);
                return { output: { result: data } };
            }
            case 'listBeams': {
                const beamsUrl = `https://${inputs.instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${inputs.instanceId}/devices`;
                const res = await fetch(beamsUrl, {
                    headers: { 'Authorization': `Bearer ${inputs.beamsSecretKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.description || `HTTP ${res.status}`);
                return { output: { devices: data } };
            }
            case 'createBeam': {
                const beamsUrl = `https://${inputs.instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${inputs.instanceId}/devices/${inputs.deviceId}/interests`;
                const res = await fetch(beamsUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${inputs.beamsSecretKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ interests: inputs.interests }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.description || `HTTP ${res.status}`);
                return { output: { result: data } };
            }
            case 'sendPushNotification': {
                const beamsUrl = `https://${inputs.instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${inputs.instanceId}/publishes/interests`;
                const res = await fetch(beamsUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${inputs.beamsSecretKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ interests: inputs.interests, apns: inputs.apns, fcm: inputs.fcm, web: inputs.web }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.description || `HTTP ${res.status}`);
                return { output: { result: data } };
            }
            case 'getBeamStats': {
                const beamsUrl = `https://${inputs.instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${inputs.instanceId}`;
                const res = await fetch(beamsUrl, {
                    headers: { 'Authorization': `Bearer ${inputs.beamsSecretKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.description || `HTTP ${res.status}`);
                return { output: { stats: data } };
            }
            case 'createWebhook': {
                const data = await apiFetch('/webhooks', 'POST', {
                    target_url: inputs.targetUrl,
                    event_type: inputs.eventType,
                });
                return { output: { webhook: data } };
            }
            case 'deleteWebhook': {
                const data = await apiFetch(`/webhooks/${inputs.webhookId}`, 'DELETE');
                return { output: { result: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Pusher action error: ${err.message}`);
        return { error: err.message || 'Pusher action failed' };
    }
}
