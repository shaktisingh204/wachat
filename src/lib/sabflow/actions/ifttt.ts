'use server';

export async function executeIftttAction(actionName: string, inputs: any, user: any, logger: any) {
    const WEBHOOKS_BASE = 'https://maker.ifttt.com';
    const API_BASE = 'https://connect.ifttt.com/v2';

    try {
        switch (actionName) {
            case 'triggerWebhook': {
                const res = await fetch(
                    `${WEBHOOKS_BASE}/trigger/${inputs.eventName}/with/key/${inputs.webhookKey}`,
                    { method: 'POST' }
                );
                if (!res.ok) return { error: `Failed to trigger webhook: HTTP ${res.status}` };
                const text = await res.text();
                return { output: { result: text } };
            }

            case 'triggerWebhookWithData': {
                const res = await fetch(
                    `${WEBHOOKS_BASE}/trigger/${inputs.eventName}/with/key/${inputs.webhookKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            value1: inputs.value1 || '',
                            value2: inputs.value2 || '',
                            value3: inputs.value3 || '',
                        }),
                    }
                );
                if (!res.ok) return { error: `Failed to trigger webhook with data: HTTP ${res.status}` };
                const text = await res.text();
                return { output: { result: text } };
            }

            case 'triggerWebhookBatch': {
                const events: any[] = Array.isArray(inputs.events) ? inputs.events : [];
                const results = await Promise.all(
                    events.map(async (event: any) => {
                        const r = await fetch(
                            `${WEBHOOKS_BASE}/trigger/${event.eventName}/with/key/${inputs.webhookKey}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    value1: event.value1 || '',
                                    value2: event.value2 || '',
                                    value3: event.value3 || '',
                                }),
                            }
                        );
                        return { event: event.eventName, status: r.status, ok: r.ok };
                    })
                );
                return { output: { results } };
            }

            case 'listApplets': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${API_BASE}/applets?${params}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list applets' };
                return { output: data };
            }

            case 'getApplet': {
                const res = await fetch(`${API_BASE}/applets/${inputs.appletId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get applet' };
                return { output: data };
            }

            case 'enableApplet': {
                const res = await fetch(`${API_BASE}/applets/${inputs.appletId}/enable`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to enable applet' };
                return { output: data };
            }

            case 'disableApplet': {
                const res = await fetch(`${API_BASE}/applets/${inputs.appletId}/disable`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to disable applet' };
                return { output: data };
            }

            case 'runApplet': {
                const res = await fetch(`${API_BASE}/applets/${inputs.appletId}/run`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to run applet' };
                return { output: data };
            }

            case 'listConnections': {
                const res = await fetch(`${API_BASE}/connections`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list connections' };
                return { output: data };
            }

            case 'getConnection': {
                const res = await fetch(`${API_BASE}/connections/${inputs.connectionId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get connection' };
                return { output: data };
            }

            case 'enableService': {
                const res = await fetch(`${API_BASE}/services/${inputs.serviceId}/enable`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to enable service' };
                return { output: data };
            }

            case 'disableService': {
                const res = await fetch(`${API_BASE}/services/${inputs.serviceId}/disable`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to disable service' };
                return { output: data };
            }

            case 'checkStatus': {
                const res = await fetch(`${API_BASE}/me`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to check status' };
                return { output: { status: 'ok', user: data } };
            }

            case 'getUser': {
                const res = await fetch(`${API_BASE}/me`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get user' };
                return { output: data };
            }

            case 'getQuota': {
                const res = await fetch(`${API_BASE}/me/quota`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get quota' };
                return { output: data };
            }

            default:
                return { error: `Unknown IFTTT action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`IFTTT action error: ${err.message}`);
        return { error: err.message || 'IFTTT action failed' };
    }
}
