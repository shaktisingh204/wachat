'use server';

export async function executeParticleIotAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.particle.io/v1';

    try {
        switch (actionName) {
            case 'getToken': {
                const res = await fetch('https://api.particle.io/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials',
                        client_id: inputs.clientId,
                        client_secret: inputs.clientSecret,
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_description || data.error || 'Failed to get token' };
                return { output: data };
            }

            case 'listDevices': {
                const res = await fetch(`${BASE_URL}/devices`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list devices' };
                return { output: { devices: data } };
            }

            case 'getDevice': {
                const res = await fetch(`${BASE_URL}/devices/${inputs.deviceId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get device' };
                return { output: data };
            }

            case 'callFunction': {
                const res = await fetch(`${BASE_URL}/devices/${inputs.deviceId}/${inputs.functionName}`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({ arg: inputs.argument || '' }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to call function' };
                return { output: data };
            }

            case 'getVariable': {
                const res = await fetch(`${BASE_URL}/devices/${inputs.deviceId}/${inputs.variableName}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get variable' };
                return { output: data };
            }

            case 'publishEvent': {
                const res = await fetch(`${BASE_URL}/devices/events`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        name: inputs.eventName,
                        data: inputs.eventData || '',
                        private: inputs.isPrivate ? 'true' : 'false',
                        ttl: String(inputs.ttl || 60),
                    }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to publish event' };
                return { output: data };
            }

            case 'listEvents': {
                const url = inputs.deviceId
                    ? `${BASE_URL}/devices/${inputs.deviceId}/events/${inputs.eventName || ''}`
                    : `${BASE_URL}/devices/events/${inputs.eventName || ''}`;
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list events' };
                return { output: data };
            }

            case 'subscribeToEvent': {
                const url = `${BASE_URL}/devices/events/${inputs.eventName || ''}`;
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to subscribe to event' };
                return { output: data };
            }

            case 'flashFirmware': {
                const body = new FormData();
                if (inputs.fileUrl) body.append('file_url', inputs.fileUrl);
                if (inputs.buildTargetVersion) body.append('build_target_version', inputs.buildTargetVersion);
                const res = await fetch(`${BASE_URL}/devices/${inputs.deviceId}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                    body,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to flash firmware' };
                return { output: data };
            }

            case 'getDeviceLogs': {
                const params = new URLSearchParams();
                if (inputs.startTime) params.set('start', inputs.startTime);
                if (inputs.endTime) params.set('end', inputs.endTime);
                const res = await fetch(`${BASE_URL}/devices/${inputs.deviceId}/logs?${params}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get device logs' };
                return { output: data };
            }

            case 'listProducts': {
                const res = await fetch(`${BASE_URL}/products`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list products' };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(`${BASE_URL}/products/${inputs.productId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get product' };
                return { output: data };
            }

            case 'createWebhook': {
                const res = await fetch(`${BASE_URL}/webhooks`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        event: inputs.event,
                        url: inputs.url,
                        requestType: inputs.requestType || 'POST',
                        deviceid: inputs.deviceId || undefined,
                        json: inputs.json || undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create webhook' };
                return { output: data };
            }

            case 'listWebhooks': {
                const res = await fetch(`${BASE_URL}/webhooks`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list webhooks' };
                return { output: data };
            }

            case 'deleteWebhook': {
                const res = await fetch(`${BASE_URL}/webhooks/${inputs.webhookId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to delete webhook' };
                return { output: data };
            }

            default:
                return { error: `Unknown Particle IoT action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Particle IoT action error: ${err.message}`);
        return { error: err.message || 'Particle IoT action failed' };
    }
}
