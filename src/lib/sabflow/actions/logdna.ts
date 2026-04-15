
'use server';

/**
 * LogDNA / Mezmo Action Executor
 * API docs: https://docs.mezmo.com/log-analysis-api
 * Base URLs:
 *   Export / search : https://api.us.logdna.com/v1
 *   Ingest          : https://logs.logdna.com/logs/ingest
 */

function buildBasicAuth(inputs: any): string {
    // LogDNA uses servicekey or apikey as the Basic auth username with an empty password.
    const key = String(inputs.serviceKey ?? inputs.servicekey ?? inputs.apiKey ?? inputs.apikey ?? '').trim();
    if (!key) throw new Error('serviceKey (or apiKey) is required.');
    return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

async function logdnaFetch(
    method: string,
    url: string,
    authHeader: string,
    body?: any,
    logger?: any,
) {
    logger?.log(`[LogDNA] ${method} ${url}`);
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error || data?.message || text || `LogDNA API error ${res.status}`);
    return data;
}

export async function executeLogDnaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const authHeader = buildBasicAuth(inputs);
        const apiBase = String(inputs.apiBase ?? 'https://api.us.logdna.com/v1').replace(/\/$/, '');
        const ingestBase = String(inputs.ingestBase ?? 'https://logs.logdna.com').replace(/\/$/, '');

        const get = (path: string) => logdnaFetch('GET', `${apiBase}${path}`, authHeader, undefined, logger);
        const post = (path: string, body: any, base = apiBase) => logdnaFetch('POST', `${base}${path}`, authHeader, body, logger);
        const del = (path: string) => logdnaFetch('DELETE', `${apiBase}${path}`, authHeader, undefined, logger);

        switch (actionName) {
            case 'searchLogs': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', String(inputs.query));
                if (inputs.from) params.set('from', String(inputs.from));
                if (inputs.to) params.set('to', String(inputs.to));
                if (inputs.size) params.set('size', String(inputs.size));
                if (inputs.hosts) params.set('hosts', String(inputs.hosts));
                if (inputs.apps) params.set('apps', String(inputs.apps));
                if (inputs.levels) params.set('levels', String(inputs.levels));
                if (inputs.prefer) params.set('prefer', String(inputs.prefer));
                const qs = params.toString();
                const data = await get(`/export${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'ingestLogs': {
                const lines = inputs.lines;
                if (!Array.isArray(lines) || lines.length === 0) throw new Error('lines array is required and must not be empty.');
                const params = new URLSearchParams();
                if (inputs.hostname) params.set('hostname', String(inputs.hostname));
                if (inputs.now) params.set('now', String(inputs.now));
                if (inputs.tags) params.set('tags', String(inputs.tags));
                const qs = params.toString();
                const data = await post(`/logs/ingest${qs ? '?' + qs : ''}`, { lines }, ingestBase);
                return { output: { success: true, ...data } };
            }

            case 'getOrganizations': {
                const data = await get('/organizations');
                return { output: data };
            }

            case 'getUsage': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', String(inputs.from));
                if (inputs.to) params.set('to', String(inputs.to));
                const qs = params.toString();
                const data = await get(`/usage/hosts${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'listAlerts': {
                const data = await get('/alerts');
                return { output: data };
            }

            case 'createAlert': {
                if (!inputs.alert) throw new Error('alert object is required.');
                const data = await post('/alerts', inputs.alert);
                return { output: data };
            }

            case 'deleteAlert': {
                const alertId = String(inputs.alertId ?? inputs.id ?? '').trim();
                if (!alertId) throw new Error('alertId is required.');
                const data = await del(`/alerts/${encodeURIComponent(alertId)}`);
                return { output: { success: true, ...data } };
            }

            case 'listViews': {
                const data = await get('/views');
                return { output: data };
            }

            case 'getView': {
                const viewId = String(inputs.viewId ?? inputs.id ?? '').trim();
                if (!viewId) throw new Error('viewId is required.');
                const data = await get(`/views/${encodeURIComponent(viewId)}`);
                return { output: data };
            }

            case 'listBoards': {
                const data = await get('/boards');
                return { output: data };
            }

            default:
                return { error: `LogDNA action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'LogDNA action failed.' };
    }
}
