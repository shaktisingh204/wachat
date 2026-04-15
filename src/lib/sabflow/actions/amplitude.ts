
'use server';

export async function executeAmplitudeAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const secretKey = String(inputs.secretKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const dashboardBase = 'https://amplitude.com';
        const basicAuth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

        async function dashboardFetch(method: string, path: string, params?: Record<string, string>) {
            const query = params ? '?' + new URLSearchParams(params).toString() : '';
            const url = `${dashboardBase}${path}${query}`;
            logger?.log(`[Amplitude] ${method} ${url}`);
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/json',
                },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error || `Amplitude API error: ${res.status}`);
            return data;
        }

        async function httpApiFetch(path: string, body: any) {
            const url = `https://api2.amplitude.com${path}`;
            logger?.log(`[Amplitude] POST ${url}`);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error || `Amplitude HTTP API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'trackEvent': {
                const userId = String(inputs.userId ?? '').trim();
                const eventType = String(inputs.eventType ?? '').trim();
                if (!userId || !eventType) throw new Error('userId and eventType are required.');
                const event: any = {
                    user_id: userId,
                    event_type: eventType,
                    time: inputs.time ?? Date.now(),
                };
                if (inputs.eventProperties) {
                    event.event_properties = typeof inputs.eventProperties === 'string'
                        ? JSON.parse(inputs.eventProperties) : inputs.eventProperties;
                }
                const data = await httpApiFetch('/2/httpapi', { api_key: apiKey, events: [event] });
                return { output: data };
            }
            case 'trackBatchEvents': {
                const events = inputs.events
                    ? (typeof inputs.events === 'string' ? JSON.parse(inputs.events) : inputs.events)
                    : [];
                if (!events.length) throw new Error('events array is required and must not be empty.');
                const data = await httpApiFetch('/2/httpapi', { api_key: apiKey, events });
                return { output: data };
            }
            case 'identifyUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const userProperties = inputs.userProperties
                    ? (typeof inputs.userProperties === 'string' ? JSON.parse(inputs.userProperties) : inputs.userProperties)
                    : {};
                const identification = [{ user_id: userId, user_properties: userProperties }];
                const url = 'https://api2.amplitude.com/identify';
                logger?.log(`[Amplitude] POST ${url}`);
                const formBody = `api_key=${encodeURIComponent(apiKey)}&identification=${encodeURIComponent(JSON.stringify(identification))}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formBody,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Amplitude identify error: ${res.status}`);
                return { output: data };
            }
            case 'getRevenueChart': {
                const params: Record<string, string> = {};
                if (inputs.start) params.start = inputs.start;
                if (inputs.end) params.end = inputs.end;
                const data = await dashboardFetch('GET', '/api/2/revenue', params);
                return { output: data };
            }
            case 'getEventCountChart': {
                const eventName = String(inputs.eventName ?? '').trim();
                if (!eventName) throw new Error('eventName is required.');
                const params: Record<string, string> = { e: JSON.stringify({ event_type: eventName }) };
                if (inputs.start) params.start = inputs.start;
                if (inputs.end) params.end = inputs.end;
                const data = await dashboardFetch('GET', '/api/2/events/segmentation', params);
                return { output: data };
            }
            case 'getUserCount': {
                const params: Record<string, string> = {};
                if (inputs.start) params.start = inputs.start;
                if (inputs.end) params.end = inputs.end;
                const data = await dashboardFetch('GET', '/api/2/users/count', params);
                return { output: data };
            }
            case 'getRetentionChart': {
                const params: Record<string, string> = {};
                if (inputs.start) params.start = inputs.start;
                if (inputs.end) params.end = inputs.end;
                if (inputs.retentionType) params.retention_type = inputs.retentionType;
                const data = await dashboardFetch('GET', '/api/2/retention', params);
                return { output: data };
            }
            case 'getCohorts': {
                const data = await dashboardFetch('GET', '/api/2/cohorts');
                return { output: data };
            }
            case 'getUserActivityTimeline': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const params: Record<string, string> = { user: userId };
                const data = await dashboardFetch('GET', '/api/2/useractivity', params);
                return { output: data };
            }
            case 'exportEvents': {
                const start = String(inputs.start ?? '').trim();
                const end = String(inputs.end ?? '').trim();
                if (!start || !end) throw new Error('start and end are required.');
                const params: Record<string, string> = { start, end };
                const data = await dashboardFetch('GET', '/api/2/export', params);
                return { output: data };
            }
            case 'getUserProperties': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await dashboardFetch('GET', '/api/2/userlookup', { user_id: userId });
                return { output: data };
            }
            default:
                throw new Error(`Unknown Amplitude action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Amplitude] Error: ${err.message}`);
        return { error: err.message || 'Amplitude action failed.' };
    }
}
