
'use server';

const PLAUSIBLE_BASE = 'https://plausible.io/api/v1';
const PLAUSIBLE_V2_BASE = 'https://plausible.io/api/v2';

async function plausibleFetch(apiKey: string, version: 'v1' | 'v2', method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Plausible] ${method} ${path}`);
    const base = version === 'v2' ? PLAUSIBLE_V2_BASE : PLAUSIBLE_BASE;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${base}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Plausible API error: ${res.status}`);
    }
    return data;
}

export async function executePlausibleAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const pl = (method: string, path: string, body?: any, version: 'v1' | 'v2' = 'v1') => plausibleFetch(apiKey, version, method, path, body, logger);

        switch (actionName) {
            case 'getStats': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const period = inputs.period ?? 'month';
                const metrics = inputs.metrics ?? 'visitors,pageviews,bounce_rate,visit_duration';
                const params = new URLSearchParams({ site_id: siteId, period, metrics });
                if (inputs.date) params.set('date', String(inputs.date));
                if (inputs.filters) params.set('filters', String(inputs.filters));
                const data = await pl('GET', `/stats/aggregate?${params.toString()}`);
                return { output: { results: JSON.stringify(data.results ?? data) } };
            }

            case 'getBreakdown': {
                const siteId = String(inputs.siteId ?? '').trim();
                const property = String(inputs.property ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                if (!property) throw new Error('property is required (e.g. visit:page, visit:country).');
                const period = inputs.period ?? 'month';
                const params = new URLSearchParams({ site_id: siteId, period, property });
                if (inputs.metrics) params.set('metrics', String(inputs.metrics));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.filters) params.set('filters', String(inputs.filters));
                const data = await pl('GET', `/stats/breakdown?${params.toString()}`);
                const results = data.results ?? [];
                return { output: { count: String(results.length), results: JSON.stringify(results) } };
            }

            case 'getRealtime': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const data = await pl('GET', `/stats/realtime/visitors?site_id=${encodeURIComponent(siteId)}`);
                return { output: { visitors: String(data ?? 0) } };
            }

            case 'getTimeseries': {
                const siteId = String(inputs.siteId ?? '').trim();
                if (!siteId) throw new Error('siteId is required.');
                const period = inputs.period ?? 'month';
                const params = new URLSearchParams({ site_id: siteId, period });
                if (inputs.metrics) params.set('metrics', String(inputs.metrics));
                if (inputs.interval) params.set('interval', String(inputs.interval));
                if (inputs.filters) params.set('filters', String(inputs.filters));
                const data = await pl('GET', `/stats/timeseries?${params.toString()}`);
                const results = data.results ?? [];
                return { output: { count: String(results.length), results: JSON.stringify(results) } };
            }

            case 'listSites': {
                const data = await pl('GET', '/sites');
                const sites = data.sites ?? [];
                return { output: { count: String(sites.length), sites: JSON.stringify(sites) } };
            }

            default:
                return { error: `Plausible action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Plausible action failed.' };
    }
}
