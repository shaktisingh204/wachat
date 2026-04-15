
'use server';

export async function executeOneSignalAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const restApiKey = String(inputs.restApiKey ?? '').trim();
        const appId = String(inputs.appId ?? '').trim();
        if (!restApiKey) throw new Error('restApiKey is required.');

        const baseUrl = 'https://onesignal.com/api/v1';
        const headers = {
            'Authorization': `Basic ${restApiKey}`,
            'Content-Type': 'application/json',
        };

        async function osFetch(method: string, path: string, body?: any) {
            const url = `${baseUrl}${path}`;
            logger?.log(`[OneSignal] ${method} ${url}`);
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.errors?.[0] || data?.error || `OneSignal API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'sendNotification': {
                const message = String(inputs.message ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!message) throw new Error('message is required.');
                const payload: any = {
                    app_id: appId,
                    contents: { en: message },
                };
                if (title) payload.headings = { en: title };
                if (inputs.includedSegments) {
                    payload.included_segments = typeof inputs.includedSegments === 'string'
                        ? JSON.parse(inputs.includedSegments) : inputs.includedSegments;
                } else if (inputs.includePlayerIds) {
                    payload.include_player_ids = typeof inputs.includePlayerIds === 'string'
                        ? JSON.parse(inputs.includePlayerIds) : inputs.includePlayerIds;
                } else {
                    payload.included_segments = ['All'];
                }
                if (inputs.data) payload.data = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await osFetch('POST', '/notifications', payload);
                return { output: data };
            }
            case 'createSegment': {
                const name = String(inputs.name ?? '').trim();
                if (!name || !appId) throw new Error('name and appId are required.');
                const filters = inputs.filters
                    ? (typeof inputs.filters === 'string' ? JSON.parse(inputs.filters) : inputs.filters)
                    : [];
                const data = await osFetch('POST', `/apps/${appId}/segments`, { name, filters });
                return { output: data };
            }
            case 'deleteSegment': {
                const segmentId = String(inputs.segmentId ?? '').trim();
                if (!segmentId || !appId) throw new Error('segmentId and appId are required.');
                const data = await osFetch('DELETE', `/apps/${appId}/segments/${segmentId}`);
                return { output: { success: true, ...data } };
            }
            case 'listNotifications': {
                const limit = inputs.limit ? `&limit=${inputs.limit}` : '';
                const offset = inputs.offset ? `&offset=${inputs.offset}` : '';
                const data = await osFetch('GET', `/notifications?app_id=${appId}${limit}${offset}`);
                return { output: data };
            }
            case 'getNotification': {
                const id = String(inputs.notificationId ?? '').trim();
                if (!id) throw new Error('notificationId is required.');
                const data = await osFetch('GET', `/notifications/${id}?app_id=${appId}`);
                return { output: data };
            }
            case 'cancelNotification': {
                const id = String(inputs.notificationId ?? '').trim();
                if (!id) throw new Error('notificationId is required.');
                const data = await osFetch('DELETE', `/notifications/${id}?app_id=${appId}`);
                return { output: { success: true, ...data } };
            }
            case 'listDevices': {
                const limit = inputs.limit ? inputs.limit : 300;
                const data = await osFetch('GET', `/players?app_id=${appId}&limit=${limit}`);
                return { output: data };
            }
            case 'getDevice': {
                const id = String(inputs.playerId ?? '').trim();
                if (!id) throw new Error('playerId is required.');
                const data = await osFetch('GET', `/players/${id}?app_id=${appId}`);
                return { output: data };
            }
            case 'addDevice': {
                const deviceType = inputs.deviceType ?? 0;
                const payload: any = { app_id: appId, device_type: deviceType };
                if (inputs.identifier) payload.identifier = inputs.identifier;
                if (inputs.tags) payload.tags = typeof inputs.tags === 'string' ? JSON.parse(inputs.tags) : inputs.tags;
                const data = await osFetch('POST', '/players', payload);
                return { output: data };
            }
            case 'editDevice': {
                const id = String(inputs.playerId ?? '').trim();
                if (!id) throw new Error('playerId is required.');
                const payload: any = { app_id: appId };
                if (inputs.tags) payload.tags = typeof inputs.tags === 'string' ? JSON.parse(inputs.tags) : inputs.tags;
                if (inputs.identifier) payload.identifier = inputs.identifier;
                const data = await osFetch('PUT', `/players/${id}`, payload);
                return { output: data };
            }
            case 'deleteDevice': {
                const id = String(inputs.playerId ?? '').trim();
                if (!id) throw new Error('playerId is required.');
                const data = await osFetch('DELETE', `/players/${id}?app_id=${appId}`);
                return { output: { success: true, ...data } };
            }
            case 'viewOutcomes': {
                const outcomeNames = inputs.outcomeNames ? `&outcome_names[]=${inputs.outcomeNames}` : '';
                const data = await osFetch('GET', `/notifications/outcomes?app_id=${appId}${outcomeNames}`);
                return { output: data };
            }
            case 'updateApp': {
                if (!appId) throw new Error('appId is required.');
                const payload = inputs.appData
                    ? (typeof inputs.appData === 'string' ? JSON.parse(inputs.appData) : inputs.appData)
                    : {};
                const data = await osFetch('PUT', `/apps/${appId}`, payload);
                return { output: data };
            }
            default:
                throw new Error(`Unknown OneSignal action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[OneSignal] Error: ${err.message}`);
        return { error: err.message || 'OneSignal action failed.' };
    }
}
