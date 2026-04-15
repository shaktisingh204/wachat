
'use server';

export async function executeAppsFlyerAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const devKey = String(inputs.devKey ?? '').trim();
        const appId = String(inputs.appId ?? '').trim();
        const apiToken = String(inputs.apiToken ?? devKey).trim();
        if (!devKey) throw new Error('devKey is required.');

        const eventBase = 'https://api2.appsflyer.com';
        const pullBase = 'https://hq.appsflyer.com';

        const eventHeaders = {
            'Authentication': devKey,
            'Content-Type': 'application/json',
        };

        async function eventFetch(method: string, path: string, body?: any) {
            const url = `${eventBase}${path}`;
            logger?.log(`[AppsFlyer] ${method} ${url}`);
            const options: RequestInit = { method, headers: eventHeaders };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || `AppsFlyer API error: ${res.status}`);
            return data;
        }

        async function pullFetch(path: string, params?: Record<string, string>) {
            const query = params ? '&' + new URLSearchParams(params).toString() : '';
            const url = `${pullBase}${path}?api_token=${apiToken}${query}`;
            logger?.log(`[AppsFlyer] GET ${url}`);
            const res = await fetch(url, {
                headers: { 'Accept': 'application/json' },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || `AppsFlyer Pull API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'sendInAppEvent': {
                const appsflyerId = String(inputs.appsflyerId ?? '').trim();
                const eventName = String(inputs.eventName ?? '').trim();
                if (!appsflyerId || !eventName || !appId) throw new Error('appsflyerId, eventName, and appId are required.');
                const eventValue = inputs.eventValue
                    ? (typeof inputs.eventValue === 'string' ? JSON.parse(inputs.eventValue) : inputs.eventValue)
                    : {};
                const data = await eventFetch('POST', `/inappevent/${appId}`, {
                    appsflyer_id: appsflyerId,
                    eventName,
                    eventValue,
                });
                return { output: data };
            }
            case 'sendServerEvent': {
                const appsflyerId = String(inputs.appsflyerId ?? '').trim();
                const eventName = String(inputs.eventName ?? '').trim();
                if (!appsflyerId || !eventName || !appId) throw new Error('appsflyerId, eventName, and appId are required.');
                const eventValue = inputs.eventValue
                    ? (typeof inputs.eventValue === 'string' ? JSON.parse(inputs.eventValue) : inputs.eventValue)
                    : {};
                const payload: any = { appsflyer_id: appsflyerId, eventName, eventValue };
                if (inputs.customerId) payload.customer_user_id = inputs.customerId;
                if (inputs.ip) payload.ip = inputs.ip;
                const data = await eventFetch('POST', `/inappevent/${appId}`, payload);
                return { output: data };
            }
            case 'getPullReport': {
                const category = String(inputs.category ?? 'installs_report').trim();
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                if (inputs.timezone) params.timezone = inputs.timezone;
                const data = await pullFetch(`/api/pull/v5/${appId}/${category}`, params);
                return { output: data };
            }
            case 'getInstallsReport': {
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                const data = await pullFetch(`/api/pull/v5/${appId}/installs_report`, params);
                return { output: data };
            }
            case 'getInAppEventsReport': {
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                if (inputs.eventName) params.event_name = inputs.eventName;
                const data = await pullFetch(`/api/pull/v5/${appId}/in_app_events_report`, params);
                return { output: data };
            }
            case 'getRetargetingReport': {
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                const data = await pullFetch(`/api/pull/v5/${appId}/retargeting`, params);
                return { output: data };
            }
            case 'getRetentionReport': {
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                const data = await pullFetch(`/api/pull/v5/${appId}/retention_report`, params);
                return { output: data };
            }
            case 'getUninstallsReport': {
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                const data = await pullFetch(`/api/pull/v5/${appId}/uninstalls_report`, params);
                return { output: data };
            }
            case 'getGeoReport': {
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                const data = await pullFetch(`/api/pull/v5/${appId}/geo_by_date_report`, params);
                return { output: data };
            }
            case 'getActivityReport': {
                if (!appId) throw new Error('appId is required.');
                const params: Record<string, string> = {};
                if (inputs.from) params.from = inputs.from;
                if (inputs.to) params.to = inputs.to;
                const data = await pullFetch(`/api/pull/v5/${appId}/daily_active_users_report`, params);
                return { output: data };
            }
            case 'deleteUser': {
                const identityType = String(inputs.identityType ?? 'appsflyer_id').trim();
                const identityValue = String(inputs.identityValue ?? '').trim();
                if (!identityValue) throw new Error('identityValue is required.');
                const url = `${pullBase}/api/gdpr/v2/delete`;
                logger?.log(`[AppsFlyer] POST ${url}`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authentication': devKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        subject_request_type: 'erasure',
                        subject_identities: [{ identity_type: identityType, identity_value: identityValue }],
                    }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.message || `AppsFlyer GDPR error: ${res.status}`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown AppsFlyer action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[AppsFlyer] Error: ${err.message}`);
        return { error: err.message || 'AppsFlyer action failed.' };
    }
}
