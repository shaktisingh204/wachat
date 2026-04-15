'use server';

export async function executeThingspeakAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.thingspeak.com';

    try {
        switch (actionName) {
            case 'writeData': {
                const params = new URLSearchParams({ api_key: inputs.writeApiKey });
                for (let i = 1; i <= 8; i++) {
                    const field = `field${i}`;
                    if (inputs[field] !== undefined) params.set(field, String(inputs[field]));
                }
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.lat) params.set('lat', String(inputs.lat));
                if (inputs.long) params.set('long', String(inputs.long));
                const res = await fetch(`${BASE_URL}/update?${params}`);
                const text = await res.text();
                if (!res.ok || text === '0') return { error: 'Failed to write data to ThingSpeak' };
                return { output: { entryId: parseInt(text) } };
            }

            case 'readLatestData': {
                const params = new URLSearchParams({ api_key: inputs.readApiKey });
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}/feeds/last.json?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to read latest data' };
                return { output: data };
            }

            case 'readFieldData': {
                const params = new URLSearchParams({ api_key: inputs.readApiKey });
                if (inputs.results) params.set('results', String(inputs.results));
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.end) params.set('end', inputs.end);
                const res = await fetch(
                    `${BASE_URL}/channels/${inputs.channelId}/fields/${inputs.fieldNumber}.json?${params}`
                );
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to read field data' };
                return { output: data };
            }

            case 'readChannelFeed': {
                const params = new URLSearchParams({ api_key: inputs.readApiKey });
                if (inputs.results) params.set('results', String(inputs.results));
                if (inputs.start) params.set('start', inputs.start);
                if (inputs.end) params.set('end', inputs.end);
                if (inputs.offset !== undefined) params.set('offset', String(inputs.offset));
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}/feeds.json?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to read channel feed' };
                return { output: data };
            }

            case 'listChannels': {
                const params = new URLSearchParams({ api_key: inputs.readApiKey });
                const res = await fetch(`${BASE_URL}/channels.json?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to list channels' };
                return { output: { channels: data } };
            }

            case 'getChannelInfo': {
                const params = new URLSearchParams({ api_key: inputs.readApiKey });
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}.json?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to get channel info' };
                return { output: data };
            }

            case 'createChannel': {
                const res = await fetch(`${BASE_URL}/channels.json`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        api_key: inputs.writeApiKey,
                        name: inputs.name,
                        description: inputs.description || '',
                        public_flag: inputs.public ? 'true' : 'false',
                        field1: inputs.field1 || '',
                        field2: inputs.field2 || '',
                        field3: inputs.field3 || '',
                        field4: inputs.field4 || '',
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to create channel' };
                return { output: data };
            }

            case 'updateChannel': {
                const body: Record<string, string> = { api_key: inputs.writeApiKey };
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.public !== undefined) body.public_flag = inputs.public ? 'true' : 'false';
                for (let i = 1; i <= 8; i++) {
                    const f = `field${i}`;
                    if (inputs[f]) body[f] = inputs[f];
                }
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(body).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to update channel' };
                return { output: data };
            }

            case 'deleteChannel': {
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}.json`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ api_key: inputs.writeApiKey }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to delete channel' };
                return { output: data };
            }

            case 'clearChannelFeed': {
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}/feeds.json`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ api_key: inputs.writeApiKey }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to clear channel feed' };
                return { output: data };
            }

            case 'listAlerts': {
                const res = await fetch(`${BASE_URL}/alerts.json`, {
                    headers: { 'THINGSPEAKAPIKEY': inputs.writeApiKey },
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to list alerts' };
                return { output: { alerts: data } };
            }

            case 'createAlert': {
                const res = await fetch(`${BASE_URL}/alerts.json`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'THINGSPEAKAPIKEY': inputs.writeApiKey,
                    },
                    body: JSON.stringify({
                        name: inputs.name,
                        conditions: inputs.conditions,
                        channels: inputs.channels,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to create alert' };
                return { output: data };
            }

            case 'updateAlert': {
                const res = await fetch(`${BASE_URL}/alerts/${inputs.alertId}.json`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'THINGSPEAKAPIKEY': inputs.writeApiKey,
                    },
                    body: JSON.stringify({
                        name: inputs.name,
                        conditions: inputs.conditions,
                        channels: inputs.channels,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to update alert' };
                return { output: data };
            }

            case 'deleteAlert': {
                const res = await fetch(`${BASE_URL}/alerts/${inputs.alertId}.json`, {
                    method: 'DELETE',
                    headers: { 'THINGSPEAKAPIKEY': inputs.writeApiKey },
                });
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to delete alert' };
                return { output: data };
            }

            case 'getStatus': {
                const params = new URLSearchParams({ api_key: inputs.readApiKey });
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}/status.json?${params}`);
                const data = await res.json();
                if (!res.ok) return { error: 'Failed to get status' };
                return { output: data };
            }

            default:
                return { error: `Unknown ThingSpeak action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ThingSpeak action error: ${err.message}`);
        return { error: err.message || 'ThingSpeak action failed' };
    }
}
