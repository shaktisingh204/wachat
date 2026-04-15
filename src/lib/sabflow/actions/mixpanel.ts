
'use server';

export async function executeMixpanelAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const projectToken = String(inputs.projectToken ?? '').trim();
        const serviceAccountUsername = String(inputs.serviceAccountUsername ?? '').trim();
        const serviceAccountPassword = String(inputs.serviceAccountPassword ?? '').trim();

        const trackingAuth = Buffer.from(`${projectToken}:`).toString('base64');
        const exportAuth = Buffer.from(`${serviceAccountUsername}:${serviceAccountPassword}`).toString('base64');

        async function trackFetch(path: string, body: any) {
            const url = `https://api.mixpanel.com${path}`;
            logger?.log(`[Mixpanel] POST ${url}`);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${trackingAuth}`,
                    'Content-Type': 'application/json',
                    'Accept': 'text/plain',
                },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error || `Mixpanel API error: ${res.status}`);
            return data;
        }

        async function queryFetch(method: string, path: string, params?: Record<string, string>) {
            const query = params ? '?' + new URLSearchParams(params).toString() : '';
            const url = `https://mixpanel.com${path}${query}`;
            logger?.log(`[Mixpanel] ${method} ${url}`);
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Basic ${exportAuth}`,
                    'Content-Type': 'application/json',
                },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error || `Mixpanel Query API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'trackEvent': {
                const event = String(inputs.event ?? '').trim();
                const distinctId = String(inputs.distinctId ?? '').trim();
                if (!event || !distinctId) throw new Error('event and distinctId are required.');
                const properties: any = { distinct_id: distinctId, token: projectToken };
                if (inputs.properties) {
                    const extra = typeof inputs.properties === 'string' ? JSON.parse(inputs.properties) : inputs.properties;
                    Object.assign(properties, extra);
                }
                const encoded = Buffer.from(JSON.stringify([{ event, properties }])).toString('base64');
                const url = 'https://api.mixpanel.com/track';
                logger?.log(`[Mixpanel] POST ${url}`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `data=${encodeURIComponent(encoded)}`,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Mixpanel track error: ${res.status}`);
                return { output: { success: true, result: data } };
            }
            case 'trackBatch': {
                const events = inputs.events
                    ? (typeof inputs.events === 'string' ? JSON.parse(inputs.events) : inputs.events)
                    : [];
                if (!events.length) throw new Error('events array is required.');
                const url = 'https://api.mixpanel.com/import';
                logger?.log(`[Mixpanel] POST ${url}`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${trackingAuth}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(events),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Mixpanel import error: ${res.status}`);
                return { output: data };
            }
            case 'identifyUser': {
                const distinctId = String(inputs.distinctId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!distinctId) throw new Error('distinctId is required.');
                const payload = [{ $token: projectToken, $distinct_id: distinctId, $set: { $user_id: userId } }];
                const url = 'https://api.mixpanel.com/engage#identify';
                logger?.log(`[Mixpanel] POST ${url}`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${trackingAuth}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Mixpanel engage error: ${res.status}`);
                return { output: { success: true, result: data } };
            }
            case 'setUserProperties': {
                const distinctId = String(inputs.distinctId ?? '').trim();
                if (!distinctId) throw new Error('distinctId is required.');
                const properties = inputs.properties
                    ? (typeof inputs.properties === 'string' ? JSON.parse(inputs.properties) : inputs.properties)
                    : {};
                const payload = [{ $token: projectToken, $distinct_id: distinctId, $set: properties }];
                const url = 'https://api.mixpanel.com/engage#set';
                logger?.log(`[Mixpanel] POST ${url}`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${trackingAuth}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Mixpanel engage error: ${res.status}`);
                return { output: { success: true, result: data } };
            }
            case 'getEventReport': {
                const event = String(inputs.event ?? '').trim();
                const fromDate = String(inputs.fromDate ?? '').trim();
                const toDate = String(inputs.toDate ?? '').trim();
                if (!event || !fromDate || !toDate) throw new Error('event, fromDate, and toDate are required.');
                const data = await queryFetch('GET', '/api/query/segmentation', {
                    event,
                    from_date: fromDate,
                    to_date: toDate,
                });
                return { output: data };
            }
            case 'getUserReport': {
                const params: Record<string, string> = {};
                if (inputs.where) params.where = inputs.where;
                if (inputs.outputProperties) params.output_properties = inputs.outputProperties;
                const data = await queryFetch('GET', '/api/query/engage', params);
                return { output: data };
            }
            case 'getFunnelReport': {
                const funnelId = String(inputs.funnelId ?? '').trim();
                const fromDate = String(inputs.fromDate ?? '').trim();
                const toDate = String(inputs.toDate ?? '').trim();
                if (!funnelId) throw new Error('funnelId is required.');
                const params: Record<string, string> = { funnel_id: funnelId };
                if (fromDate) params.from_date = fromDate;
                if (toDate) params.to_date = toDate;
                const data = await queryFetch('GET', '/api/query/funnels', params);
                return { output: data };
            }
            case 'getRetentionReport': {
                const fromDate = String(inputs.fromDate ?? '').trim();
                const toDate = String(inputs.toDate ?? '').trim();
                if (!fromDate || !toDate) throw new Error('fromDate and toDate are required.');
                const data = await queryFetch('GET', '/api/query/retention', {
                    from_date: fromDate,
                    to_date: toDate,
                });
                return { output: data };
            }
            case 'exportEvents': {
                const fromDate = String(inputs.fromDate ?? '').trim();
                const toDate = String(inputs.toDate ?? '').trim();
                if (!fromDate || !toDate) throw new Error('fromDate and toDate are required.');
                const params: Record<string, string> = { from_date: fromDate, to_date: toDate };
                if (inputs.event) params.event = JSON.stringify([inputs.event]);
                const url = `https://data.mixpanel.com/api/2.0/export?${new URLSearchParams(params).toString()}`;
                logger?.log(`[Mixpanel] GET ${url}`);
                const res = await fetch(url, {
                    headers: { 'Authorization': `Basic ${exportAuth}` },
                });
                if (!res.ok) throw new Error(`Mixpanel export error: ${res.status}`);
                const text = await res.text();
                const lines = text.trim().split('\n').filter(Boolean).map(l => {
                    try { return JSON.parse(l); } catch { return l; }
                });
                return { output: { events: lines, count: lines.length } };
            }
            case 'createCohort': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const payload: any = { name };
                if (inputs.description) payload.description = inputs.description;
                if (inputs.filter) payload.filter_by_cohort = typeof inputs.filter === 'string'
                    ? JSON.parse(inputs.filter) : inputs.filter;
                const data = await queryFetch('POST', '/api/query/cohorts/create');
                return { output: data };
            }
            default:
                throw new Error(`Unknown Mixpanel action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Mixpanel] Error: ${err.message}`);
        return { error: err.message || 'Mixpanel action failed.' };
    }
}
