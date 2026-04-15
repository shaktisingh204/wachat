'use server';

function buildLogglyAuthHeader(inputs: any): string {
    const username = String(inputs.username ?? '').trim();
    const password = String(inputs.password ?? '').trim();
    if (!username || !password) throw new Error('username and password are required for Loggly API calls.');
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function getLogglyBase(inputs: any): string {
    const subdomain = String(inputs.subdomain ?? '').trim();
    if (!subdomain) throw new Error('subdomain is required.');
    return `https://${subdomain}.loggly.com`;
}

async function logglyFetch(
    base: string,
    authHeader: string,
    method: string,
    path: string,
    body?: any,
    logger?: any,
) {
    logger?.log(`[Loggly] ${method} ${path}`);
    const url = `${base}${path}`;
    const headers: Record<string, string> = {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        const msg = data?.error || data?.message || `Loggly API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeLogglyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const base = getLogglyBase(inputs);

        switch (actionName) {
            case 'sendLog': {
                const token = String(inputs.token ?? '').trim();
                if (!token) throw new Error('token is required to send logs.');
                const tags = inputs.tags ? String(inputs.tags).trim() : 'sabflow';
                const log = inputs.log;
                if (log === undefined || log === null) throw new Error('log is required.');
                const body = typeof log === 'string' ? log : JSON.stringify(log);
                const res = await fetch(`${base}/inputs/${token}/tag/${tags}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                });
                if (!res.ok) throw new Error(`Loggly send error: ${res.status}`);
                const data = await res.json().catch(() => ({}));
                return { output: { response: data.response ?? 'ok' } };
            }

            case 'sendBulkLogs': {
                const token = String(inputs.token ?? '').trim();
                if (!token) throw new Error('token is required to send logs.');
                const tags = inputs.tags ? String(inputs.tags).trim() : 'sabflow';
                const logs = inputs.logs;
                if (!Array.isArray(logs) || logs.length === 0) throw new Error('logs must be a non-empty array.');
                const body = logs.map((l: any) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n');
                const res = await fetch(`${base}/bulk/${token}/tag/${tags}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain'},
                    body,
                });
                if (!res.ok) throw new Error(`Loggly bulk send error: ${res.status}`);
                const data = await res.json().catch(() => ({}));
                return { output: { response: data.response ?? 'ok', count: logs.length } };
            }

            case 'searchLogs': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const query = String(inputs.query ?? '*').trim();
                const from = String(inputs.from ?? '-24h').trim();
                const until = String(inputs.until ?? 'now').trim();
                const size = Number(inputs.size ?? 10);
                const params = new URLSearchParams({ q: query, from, until, size: String(size), order: inputs.order ?? 'desc' });
                const data = await logglyFetch(base, authHeader, 'GET', `/apiv2/search?${params.toString()}`, undefined, logger);
                return { output: { numFound: data.numFound, events: data.events ?? [] } };
            }

            case 'getLogEvents': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const rsid = String(inputs.rsid ?? '').trim();
                if (!rsid) throw new Error('rsid (search result ID) is required.');
                const page = Number(inputs.page ?? 0);
                const data = await logglyFetch(base, authHeader, 'GET', `/apiv2/events?rsid=${rsid}&page=${page}`, undefined, logger);
                return { output: { events: data.events ?? [], page: data.page } };
            }

            case 'listDevices': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const data = await logglyFetch(base, authHeader, 'GET', '/apiv2/devices', undefined, logger);
                return { output: { devices: data.devices ?? data } };
            }

            case 'getDevice': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const data = await logglyFetch(base, authHeader, 'GET', `/apiv2/devices/${deviceId}`, undefined, logger);
                return { output: { device: data } };
            }

            case 'listTags': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const data = await logglyFetch(base, authHeader, 'GET', '/apiv2/tags', undefined, logger);
                return { output: { tags: data.tags ?? data } };
            }

            case 'getTag': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const tagName = String(inputs.tagName ?? '').trim();
                if (!tagName) throw new Error('tagName is required.');
                const data = await logglyFetch(base, authHeader, 'GET', `/apiv2/tags/${encodeURIComponent(tagName)}`, undefined, logger);
                return { output: { tag: data } };
            }

            case 'createTag': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await logglyFetch(base, authHeader, 'POST', '/apiv2/tags', { name }, logger);
                return { output: { tag: data } };
            }

            case 'deleteTag': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const tagName = String(inputs.tagName ?? '').trim();
                if (!tagName) throw new Error('tagName is required.');
                await logglyFetch(base, authHeader, 'DELETE', `/apiv2/tags/${encodeURIComponent(tagName)}`, undefined, logger);
                return { output: { deleted: true, tagName } };
            }

            case 'listAlerts': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const data = await logglyFetch(base, authHeader, 'GET', '/apiv2/alerts', undefined, logger);
                return { output: { alerts: data.alerts ?? data } };
            }

            case 'getAlert': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const alertId = String(inputs.alertId ?? '').trim();
                if (!alertId) throw new Error('alertId is required.');
                const data = await logglyFetch(base, authHeader, 'GET', `/apiv2/alerts/${alertId}`, undefined, logger);
                return { output: { alert: data } };
            }

            case 'createAlert': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const name = String(inputs.name ?? '').trim();
                const searchQuery = String(inputs.searchQuery ?? '').trim();
                if (!name || !searchQuery) throw new Error('name and searchQuery are required.');
                const body: any = {
                    name,
                    search_query: searchQuery,
                    editorial_delay: inputs.editorialDelay ?? 0,
                    sumo_logic_trigger_condition: inputs.triggerCondition,
                };
                if (inputs.editorialDelay !== undefined) body.editorial_delay = Number(inputs.editorialDelay);
                const data = await logglyFetch(base, authHeader, 'POST', '/apiv2/alerts', body, logger);
                return { output: { alert: data } };
            }

            case 'updateAlert': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const alertId = String(inputs.alertId ?? '').trim();
                if (!alertId) throw new Error('alertId is required.');
                const updateData = inputs.data && typeof inputs.data === 'object' ? inputs.data : {};
                const data = await logglyFetch(base, authHeader, 'PUT', `/apiv2/alerts/${alertId}`, updateData, logger);
                return { output: { alert: data } };
            }

            case 'deleteAlert': {
                const authHeader = buildLogglyAuthHeader(inputs);
                const alertId = String(inputs.alertId ?? '').trim();
                if (!alertId) throw new Error('alertId is required.');
                await logglyFetch(base, authHeader, 'DELETE', `/apiv2/alerts/${alertId}`, undefined, logger);
                return { output: { deleted: true, alertId } };
            }

            default:
                return { error: `Loggly action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Loggly action failed.' };
    }
}
