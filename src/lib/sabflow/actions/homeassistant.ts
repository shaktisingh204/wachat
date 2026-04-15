'use server';

export async function executeHomeAssistantAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required.');
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const baseUrl = `${serverUrl}/api`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        const haFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[HomeAssistant] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.message || `HomeAssistant API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'getStates': {
                const data = await haFetch('GET', '/states');
                return { output: { states: data } };
            }

            case 'getState': {
                const entityId = String(inputs.entityId ?? '').trim();
                if (!entityId) throw new Error('entityId is required.');
                const data = await haFetch('GET', `/states/${entityId}`);
                return { output: data };
            }

            case 'setState': {
                const entityId = String(inputs.entityId ?? '').trim();
                if (!entityId) throw new Error('entityId is required.');
                const state = String(inputs.state ?? '').trim();
                if (!state) throw new Error('state is required.');
                const payload: any = { state };
                if (inputs.attributes && typeof inputs.attributes === 'object') {
                    payload.attributes = inputs.attributes;
                }
                const data = await haFetch('POST', `/states/${entityId}`, payload);
                return { output: data };
            }

            case 'callService': {
                const domain = String(inputs.domain ?? '').trim();
                if (!domain) throw new Error('domain is required.');
                const service = String(inputs.service ?? '').trim();
                if (!service) throw new Error('service is required.');
                const serviceData = inputs.serviceData ?? {};
                const data = await haFetch('POST', `/services/${domain}/${service}`, serviceData);
                return { output: { result: data } };
            }

            case 'getHistory': {
                const params = new URLSearchParams();
                if (inputs.entityId) params.set('filter_entity_id', String(inputs.entityId));
                if (inputs.startTime) params.set('start_time', String(inputs.startTime));
                if (inputs.endTime) params.set('end_time', String(inputs.endTime));
                const qs = params.toString();
                const timestamp = inputs.startTime ? `/${inputs.startTime}` : '';
                const data = await haFetch('GET', `/history/period${timestamp}${qs ? `?${qs}` : ''}`);
                return { output: { history: data } };
            }

            case 'getLogbook': {
                const params = new URLSearchParams();
                if (inputs.entityId) params.set('entity', String(inputs.entityId));
                if (inputs.startTime) params.set('start_time', String(inputs.startTime));
                if (inputs.endTime) params.set('end_time', String(inputs.endTime));
                const qs = params.toString();
                const timestamp = inputs.startTime ? `/${inputs.startTime}` : '';
                const data = await haFetch('GET', `/logbook${timestamp}${qs ? `?${qs}` : ''}`);
                return { output: { entries: data } };
            }

            case 'fireEvent': {
                const eventType = String(inputs.eventType ?? '').trim();
                if (!eventType) throw new Error('eventType is required.');
                const eventData = inputs.eventData ?? {};
                const data = await haFetch('POST', `/events/${eventType}`, eventData);
                return { output: data };
            }

            case 'getConfig': {
                const data = await haFetch('GET', '/config');
                return { output: data };
            }

            case 'getErrorLog': {
                const res = await fetch(`${baseUrl}/error_log`, { method: 'GET', headers });
                if (!res.ok) throw new Error(`HomeAssistant API error: ${res.status}`);
                const text = await res.text();
                return { output: { log: text } };
            }

            case 'checkConfig': {
                const data = await haFetch('POST', '/config/core/check_config');
                return { output: data };
            }

            case 'restartHA': {
                const data = await haFetch('POST', '/config/core/restart');
                return { output: data };
            }

            case 'stopHA': {
                const data = await haFetch('POST', '/config/core/stop');
                return { output: data };
            }

            case 'renderTemplate': {
                const template = String(inputs.template ?? '').trim();
                if (!template) throw new Error('template is required.');
                const res = await fetch(`${baseUrl}/template`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ template }),
                });
                if (!res.ok) throw new Error(`HomeAssistant API error: ${res.status}`);
                const text = await res.text();
                return { output: { result: text } };
            }

            default:
                return { error: `HomeAssistant action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'HomeAssistant action failed.' };
    }
}
