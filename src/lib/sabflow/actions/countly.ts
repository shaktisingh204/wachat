
'use server';

export async function executeCountlyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '');
        const apiKey = String(inputs.apiKey ?? inputs.appKey ?? '').trim();
        const appId = String(inputs.appId ?? '').trim();

        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!apiKey) throw new Error('apiKey (appKey) is required.');

        const countlyGet = async (path: string, extraParams?: Record<string, string>) => {
            const params = new URLSearchParams({ api_key: apiKey, ...extraParams });
            const url = `${serverUrl}${path}?${params.toString()}`;
            logger?.log(`[Countly] GET ${url}`);
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || `Countly error ${res.status}`);
            if (data?.result === 'false' || data?.error) throw new Error(data?.error || 'Countly request failed');
            return data;
        };

        const countlyPost = async (path: string, queryParams: Record<string, string>, bodyParams?: Record<string, string>) => {
            const qp = new URLSearchParams({ api_key: apiKey, ...queryParams });
            const url = `${serverUrl}${path}?${qp.toString()}`;
            logger?.log(`[Countly] POST ${url}`);
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: bodyParams ? JSON.stringify(bodyParams) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || `Countly error ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'recordEvent': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                const eventKey = String(inputs.eventKey ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                if (!eventKey) throw new Error('eventKey is required.');
                const count = Number(inputs.count ?? 1);
                const sum = inputs.sum !== undefined ? Number(inputs.sum) : undefined;
                const segmentation = inputs.segmentation
                    ? (typeof inputs.segmentation === 'string' ? JSON.parse(inputs.segmentation) : inputs.segmentation)
                    : {};

                const event: any = { key: eventKey, count, segmentation };
                if (sum !== undefined) event.sum = sum;

                const params = new URLSearchParams({
                    api_key: apiKey,
                    app_key: apiKey,
                    device_id: deviceId,
                    events: JSON.stringify([event]),
                });
                const url = `${serverUrl}/i?${params.toString()}`;
                logger?.log(`[Countly] POST ${url}`);
                const res = await fetch(url, { method: 'POST' });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Countly error ${res.status}`);
                return { output: { success: true, result: data?.result } };
            }

            case 'beginSession': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const params = new URLSearchParams({
                    api_key: apiKey,
                    app_key: apiKey,
                    device_id: deviceId,
                    begin_session: '1',
                    sdk_version: '1.0',
                });
                const url = `${serverUrl}/i?${params.toString()}`;
                logger?.log(`[Countly] POST ${url}`);
                const res = await fetch(url, { method: 'POST' });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                return { output: { success: res.ok, result: data?.result } };
            }

            case 'endSession': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const params = new URLSearchParams({
                    api_key: apiKey,
                    app_key: apiKey,
                    device_id: deviceId,
                    end_session: '1',
                });
                const url = `${serverUrl}/i?${params.toString()}`;
                logger?.log(`[Countly] POST ${url}`);
                const res = await fetch(url, { method: 'POST' });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                return { output: { success: res.ok, result: data?.result } };
            }

            case 'getUserDetails': {
                const uid = String(inputs.uid ?? '').trim();
                const params: Record<string, string> = {};
                if (appId) params.app_id = appId;
                if (uid) params.uid = uid;
                const data = await countlyGet('/o/users', params);
                return { output: data };
            }

            case 'getEvents': {
                const params: Record<string, string> = { method: 'events' };
                if (appId) params.app_id = appId;
                if (inputs.period) params.period = String(inputs.period);
                const data = await countlyGet('/o', params);
                return { output: data };
            }

            case 'getEventData': {
                const event = String(inputs.event ?? '').trim();
                if (!event) throw new Error('event is required.');
                const params: Record<string, string> = { method: 'event', event };
                if (appId) params.app_id = appId;
                if (inputs.period) params.period = String(inputs.period);
                const data = await countlyGet('/o', params);
                return { output: data };
            }

            case 'getSessionData': {
                const params: Record<string, string> = { method: 'sessions' };
                if (appId) params.app_id = appId;
                if (inputs.period) params.period = String(inputs.period);
                const data = await countlyGet('/o', params);
                return { output: data };
            }

            case 'getRetentionData': {
                const params: Record<string, string> = { method: 'retention' };
                if (appId) params.app_id = appId;
                if (inputs.period) params.period = String(inputs.period);
                const data = await countlyGet('/o', params);
                return { output: data };
            }

            case 'getTechnology': {
                const params: Record<string, string> = { method: 'technology' };
                if (appId) params.app_id = appId;
                if (inputs.period) params.period = String(inputs.period);
                const data = await countlyGet('/o', params);
                return { output: data };
            }

            case 'getLocations': {
                const params: Record<string, string> = { method: 'locations' };
                if (appId) params.app_id = appId;
                if (inputs.period) params.period = String(inputs.period);
                const data = await countlyGet('/o', params);
                return { output: data };
            }

            case 'getVersions': {
                const params: Record<string, string> = { method: 'versions' };
                if (appId) params.app_id = appId;
                if (inputs.period) params.period = String(inputs.period);
                const data = await countlyGet('/o', params);
                return { output: data };
            }

            case 'listApps': {
                const data = await countlyGet('/o/apps/listApps');
                return { output: { apps: Array.isArray(data) ? data : data?.apps ?? data } };
            }

            default:
                throw new Error(`Unknown Countly action: "${actionName}"`);
        }
    } catch (err: any) {
        logger?.log(`[Countly] Error: ${err.message}`);
        return { error: err.message };
    }
}
