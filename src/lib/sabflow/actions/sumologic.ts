'use server';

function getSumoLogicBase(deployment: string): string {
    const dep = String(deployment ?? 'us1').toLowerCase().trim();
    return `https://api.${dep}.sumologic.com/api/v1`;
}

function buildSumoLogicAuthHeader(inputs: any): string {
    const accessId = String(inputs.accessId ?? '').trim();
    const accessKey = String(inputs.accessKey ?? '').trim();
    if (!accessId || !accessKey) throw new Error('accessId and accessKey are required.');
    return `Basic ${Buffer.from(`${accessId}:${accessKey}`).toString('base64')}`;
}

async function sumoFetch(
    base: string,
    authHeader: string,
    method: string,
    path: string,
    body?: any,
    logger?: any,
) {
    logger?.log(`[SumoLogic] ${method} ${path}`);
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
        const msg = data?.message || data?.errors?.[0]?.message || `SumoLogic API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeSumoLogicAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const deployment = String(inputs.deployment ?? 'us1').toLowerCase().trim();
        const base = getSumoLogicBase(deployment);
        const authHeader = buildSumoLogicAuthHeader(inputs);
        const sf = (method: string, path: string, body?: any) =>
            sumoFetch(base, authHeader, method, path, body, logger);

        switch (actionName) {
            case 'searchLogs': {
                const query = String(inputs.query ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                if (!query || !from || !to) throw new Error('query, from, and to are required.');
                const limit = Number(inputs.limit ?? 100);
                const body: any = { query, from, to, timeZone: inputs.timeZone ?? 'UTC', limit };
                const data = await sf('POST', '/search/jobs', body);
                return { output: { jobId: data.id, link: data.link } };
            }

            case 'createSearchJob': {
                const query = String(inputs.query ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                if (!query || !from || !to) throw new Error('query, from, and to are required.');
                const body: any = {
                    query,
                    from,
                    to,
                    timeZone: inputs.timeZone ?? 'UTC',
                };
                if (inputs.byReceiptTime !== undefined) body.byReceiptTime = Boolean(inputs.byReceiptTime);
                const data = await sf('POST', '/search/jobs', body);
                return { output: { jobId: data.id, link: data.link } };
            }

            case 'getSearchJobStatus': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await sf('GET', `/search/jobs/${jobId}`);
                return {
                    output: {
                        jobId,
                        state: data.state,
                        messageCount: data.messageCount,
                        recordCount: data.recordCount,
                    },
                };
            }

            case 'getSearchJobResults': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const type = String(inputs.resultType ?? 'messages');
                const path = type === 'records'
                    ? `/search/jobs/${jobId}/records?limit=${limit}&offset=${offset}`
                    : `/search/jobs/${jobId}/messages?limit=${limit}&offset=${offset}`;
                const data = await sf('GET', path);
                return {
                    output: {
                        fields: data.fields ?? [],
                        messages: data.messages ?? data.records ?? [],
                    },
                };
            }

            case 'deleteSearchJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                await sf('DELETE', `/search/jobs/${jobId}`);
                return { output: { deleted: true, jobId } };
            }

            case 'sendLogs': {
                const sourceUrl = String(inputs.sourceUrl ?? '').trim();
                if (!sourceUrl) throw new Error('sourceUrl (HTTP source URL) is required.');
                const logs = inputs.logs;
                if (!logs) throw new Error('logs is required.');
                const body = typeof logs === 'string' ? logs : JSON.stringify(logs);
                const res = await fetch(sourceUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                });
                if (!res.ok) throw new Error(`SumoLogic HTTP source error: ${res.status}`);
                return { output: { sent: true } };
            }

            case 'listCollectors': {
                const limit = Number(inputs.limit ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const data = await sf('GET', `/collectors?limit=${limit}&offset=${offset}`);
                return { output: { collectors: data.collectors ?? [] } };
            }

            case 'getCollector': {
                const collectorId = String(inputs.collectorId ?? '').trim();
                if (!collectorId) throw new Error('collectorId is required.');
                const data = await sf('GET', `/collectors/${collectorId}`);
                return { output: { collector: data.collector ?? data } };
            }

            case 'listSources': {
                const collectorId = String(inputs.collectorId ?? '').trim();
                if (!collectorId) throw new Error('collectorId is required.');
                const data = await sf('GET', `/collectors/${collectorId}/sources`);
                return { output: { sources: data.sources ?? [] } };
            }

            case 'createSource': {
                const collectorId = String(inputs.collectorId ?? '').trim();
                if (!collectorId) throw new Error('collectorId is required.');
                const source = inputs.source;
                if (!source || typeof source !== 'object') throw new Error('source object is required.');
                const data = await sf('POST', `/collectors/${collectorId}/sources`, { source });
                return { output: { source: data.source ?? data } };
            }

            case 'listDashboards': {
                const data = await sf('GET', '/dashboards');
                return { output: { dashboards: data.dashboards ?? [] } };
            }

            case 'getDashboard': {
                const dashboardId = String(inputs.dashboardId ?? '').trim();
                if (!dashboardId) throw new Error('dashboardId is required.');
                const data = await sf('GET', `/dashboards/${dashboardId}`);
                return { output: { dashboard: data } };
            }

            case 'listMonitors': {
                const data = await sf('GET', '/monitors/root');
                return { output: { monitors: data.children ?? [] } };
            }

            case 'getMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await sf('GET', `/monitors/${monitorId}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        type: data.monitorType,
                        status: data.status,
                    },
                };
            }

            case 'createMonitor': {
                const name = String(inputs.name ?? '').trim();
                const monitorType = String(inputs.monitorType ?? '').trim();
                const queries = inputs.queries;
                if (!name || !monitorType) throw new Error('name and monitorType are required.');
                if (!Array.isArray(queries) || queries.length === 0) throw new Error('queries must be a non-empty array.');
                const body: any = {
                    name,
                    monitorType,
                    queries,
                    triggers: inputs.triggers ?? [],
                    notifications: inputs.notifications ?? [],
                    isDisabled: inputs.isDisabled ?? false,
                    parentId: inputs.parentId ?? '0000000000000001',
                };
                if (inputs.description) body.description = String(inputs.description).trim();
                const data = await sf('POST', '/monitors', body);
                return { output: { id: data.id, name: data.name } };
            }

            default:
                return { error: `SumoLogic action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'SumoLogic action failed.' };
    }
}
