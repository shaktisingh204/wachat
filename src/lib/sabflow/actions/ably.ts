'use server';

export async function executeAblyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;

        if (!apiKey) {
            return { error: 'Missing required credential: apiKey' };
        }

        const baseUrl = 'https://rest.ably.io';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        const apiFetch = async (path: string, method = 'GET', body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error?.message || `HTTP ${res.status}`);
            return data;
        };

        logger.log(`Executing Ably action: ${actionName}`);

        switch (actionName) {
            case 'publishMessage': {
                const channel = encodeURIComponent(inputs.channel);
                const data = await apiFetch(`/channels/${channel}/messages`, 'POST', {
                    name: inputs.event || 'message',
                    data: inputs.data,
                });
                return { output: { result: data } };
            }
            case 'publishBatch': {
                const messages = Array.isArray(inputs.messages) ? inputs.messages : [];
                const data = await apiFetch('/messages', 'POST', {
                    channel: inputs.channel,
                    messages,
                });
                return { output: { result: data } };
            }
            case 'getChannelStatus': {
                const channel = encodeURIComponent(inputs.channel);
                const data = await apiFetch(`/channels/${channel}`);
                return { output: { status: data } };
            }
            case 'getChannelHistory': {
                const channel = encodeURIComponent(inputs.channel);
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.direction) params.append('direction', inputs.direction);
                const data = await apiFetch(`/channels/${channel}/messages?${params.toString()}`);
                return { output: { messages: data } };
            }
            case 'listChannels': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.prefix) params.append('prefix', inputs.prefix);
                const data = await apiFetch(`/channels?${params.toString()}`);
                return { output: { channels: data } };
            }
            case 'getOccupancy': {
                const channel = encodeURIComponent(inputs.channel);
                const data = await apiFetch(`/channels/${channel}`);
                return { output: { occupancy: data?.occupancy || data } };
            }
            case 'listPresence': {
                const channel = encodeURIComponent(inputs.channel);
                const data = await apiFetch(`/channels/${channel}/presence`);
                return { output: { members: data } };
            }
            case 'getPresenceHistory': {
                const channel = encodeURIComponent(inputs.channel);
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                const data = await apiFetch(`/channels/${channel}/presence/history?${params.toString()}`);
                return { output: { history: data } };
            }
            case 'createToken': {
                const data = await apiFetch('/keys', 'POST', {
                    keyName: inputs.keyName,
                    capability: inputs.capability || { '*': ['*'] },
                    clientId: inputs.clientId,
                });
                return { output: { token: data } };
            }
            case 'requestToken': {
                const data = await apiFetch('/requestToken', 'POST', {
                    keyName: inputs.keyName,
                    capability: inputs.capability,
                    clientId: inputs.clientId,
                    ttl: inputs.ttl,
                });
                return { output: { tokenRequest: data } };
            }
            case 'revokeToken': {
                const data = await apiFetch(`/keys/${encodeURIComponent(inputs.keyName)}/revokeTokens`, 'POST', {
                    targets: inputs.targets,
                });
                return { output: { result: data } };
            }
            case 'listApiKeys': {
                const data = await apiFetch('/keys');
                return { output: { keys: data } };
            }
            case 'publishToQueue': {
                const data = await apiFetch(`/queues/${encodeURIComponent(inputs.queue)}/messages`, 'POST', {
                    data: inputs.data,
                    name: inputs.name,
                });
                return { output: { result: data } };
            }
            case 'listQueues': {
                const data = await apiFetch('/queues');
                return { output: { queues: data } };
            }
            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.start) params.append('start', String(inputs.start));
                if (inputs.end) params.append('end', String(inputs.end));
                if (inputs.unit) params.append('unit', inputs.unit);
                const data = await apiFetch(`/stats?${params.toString()}`);
                return { output: { stats: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Ably action error: ${err.message}`);
        return { error: err.message || 'Ably action failed' };
    }
}
