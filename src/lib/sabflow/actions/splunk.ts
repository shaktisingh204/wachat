
'use server';

function buildSplunkAuthHeader(inputs: any): string {
    if (inputs.token) {
        return `Bearer ${String(inputs.token).trim()}`;
    }
    if (inputs.username && inputs.password) {
        const creds = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
        return `Basic ${creds}`;
    }
    throw new Error('Splunk auth is required: provide token or username+password.');
}

async function splunkFetch(
    serverUrl: string,
    authHeader: string,
    method: string,
    path: string,
    body?: string,
    contentType = 'application/json',
    logger?: any,
) {
    logger?.log(`[Splunk] ${method} ${path}`);
    const url = `${serverUrl.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = {
        Authorization: authHeader,
        Accept: 'application/json',
    };
    if (body !== undefined) {
        headers['Content-Type'] = contentType;
    }
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = body;
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        const msg = data?.messages?.[0]?.text || data?.message || `Splunk API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

async function pollSplunkJob(
    serverUrl: string,
    authHeader: string,
    sid: string,
    logger?: any,
    maxWaitMs = 60000,
): Promise<void> {
    const interval = 2000;
    const maxAttempts = Math.ceil(maxWaitMs / interval);
    for (let i = 0; i < maxAttempts; i++) {
        const data = await splunkFetch(serverUrl, authHeader, 'GET', `/services/search/jobs/${sid}?output_mode=json`, undefined, 'application/json', logger);
        const state: string = data?.entry?.[0]?.content?.dispatchState ?? '';
        if (state === 'DONE') return;
        if (state === 'FAILED') throw new Error(`Splunk search job ${sid} failed.`);
        await new Promise(r => setTimeout(r, interval));
    }
    throw new Error(`Splunk search job ${sid} did not complete within ${maxWaitMs}ms.`);
}

export async function executeSplunkAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        const authHeader = buildSplunkAuthHeader(inputs);
        const sf = (method: string, path: string, body?: string, ct?: string) =>
            splunkFetch(serverUrl, authHeader, method, path, body, ct, logger);

        switch (actionName) {
            case 'createSearchJob': {
                const search = String(inputs.search ?? '').trim();
                if (!search) throw new Error('search is required.');
                const earliest = String(inputs.earliest ?? '-24h');
                const latest = String(inputs.latest ?? 'now');
                const maxCount = Number(inputs.maxCount ?? 100);
                const formBody =
                    `search=${encodeURIComponent(search)}` +
                    `&earliest_time=${encodeURIComponent(earliest)}` +
                    `&latest_time=${encodeURIComponent(latest)}` +
                    `&max_count=${maxCount}` +
                    `&output_mode=json`;
                const data = await sf('POST', '/services/search/jobs', formBody, 'application/x-www-form-urlencoded');
                return { output: { sid: data.sid } };
            }

            case 'getSearchJob': {
                const sid = String(inputs.sid ?? '').trim();
                if (!sid) throw new Error('sid is required.');
                const data = await sf('GET', `/services/search/jobs/${sid}?output_mode=json`);
                const content = data?.entry?.[0]?.content ?? {};
                return {
                    output: {
                        entry: data.entry ?? [],
                        dispatchState: content.dispatchState,
                        resultCount: content.resultCount,
                        runDuration: content.runDuration,
                    },
                };
            }

            case 'getSearchResults': {
                const sid = String(inputs.sid ?? '').trim();
                if (!sid) throw new Error('sid is required.');
                const count = Number(inputs.count ?? 100);
                const offset = Number(inputs.offset ?? 0);
                const data = await sf('GET', `/services/search/jobs/${sid}/results?output_mode=json&count=${count}&offset=${offset}`);
                return { output: { results: data.results ?? [], fields: data.fields ?? [] } };
            }

            case 'runSearchAndWait': {
                const search = String(inputs.search ?? '').trim();
                if (!search) throw new Error('search is required.');
                const earliest = String(inputs.earliest ?? '-24h');
                const latest = String(inputs.latest ?? 'now');
                const maxCount = Number(inputs.maxCount ?? 100);
                const formBody =
                    `search=${encodeURIComponent(search)}` +
                    `&earliest_time=${encodeURIComponent(earliest)}` +
                    `&latest_time=${encodeURIComponent(latest)}` +
                    `&max_count=${maxCount}` +
                    `&output_mode=json`;
                const createData = await sf('POST', '/services/search/jobs', formBody, 'application/x-www-form-urlencoded');
                const sid = createData.sid;
                if (!sid) throw new Error('Failed to create Splunk search job.');
                await pollSplunkJob(serverUrl, authHeader, sid, logger);
                const resultsData = await sf('GET', `/services/search/jobs/${sid}/results?output_mode=json&count=${maxCount}&offset=0`);
                return { output: { results: resultsData.results ?? [], sid } };
            }

            case 'listSavedSearches': {
                const data = await sf('GET', '/services/saved/searches?output_mode=json');
                const entry = (data.entry ?? []).map((e: any) => ({
                    name: e.name,
                    content: { search: e.content?.search, description: e.content?.description },
                }));
                return { output: { entry } };
            }

            case 'runSavedSearch': {
                const searchName = String(inputs.searchName ?? '').trim();
                if (!searchName) throw new Error('searchName is required.');
                const data = await sf('POST', `/services/saved/searches/${encodeURIComponent(searchName)}/dispatch?output_mode=json`);
                return { output: { sid: data.sid } };
            }

            case 'listIndexes': {
                const data = await sf('GET', '/services/data/indexes?output_mode=json');
                const entry = (data.entry ?? []).map((e: any) => ({
                    name: e.name,
                    content: { totalEventCount: e.content?.totalEventCount },
                }));
                return { output: { entry } };
            }

            case 'submitEvent': {
                const index = String(inputs.index ?? '').trim();
                const host = String(inputs.host ?? '').trim();
                const source = String(inputs.source ?? '').trim();
                const sourcetype = String(inputs.sourcetype ?? '').trim();
                const event = inputs.event !== undefined ? String(inputs.event) : '';
                if (!index || !host || !source || !sourcetype) {
                    throw new Error('index, host, source, and sourcetype are required.');
                }
                const qs = `?index=${encodeURIComponent(index)}&host=${encodeURIComponent(host)}&source=${encodeURIComponent(source)}&sourcetype=${encodeURIComponent(sourcetype)}`;
                const data = await sf('POST', `/services/receivers/simple${qs}`, event, 'text/plain');
                return { output: { bytes: data.bytes ?? null, ackId: data.ackId ?? null } };
            }

            case 'getAlerts': {
                const data = await sf('GET', '/services/alerts/fired_alerts?output_mode=json');
                return { output: { entry: data.entry ?? [] } };
            }

            case 'listApps': {
                const data = await sf('GET', '/services/apps/local?output_mode=json');
                const entry = (data.entry ?? []).map((e: any) => ({
                    name: e.name,
                    content: { version: e.content?.version, label: e.content?.label },
                }));
                return { output: { entry } };
            }

            case 'getLookupTable': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const data = await sf('GET', `/services/data/lookup-table-files/${tableName}?output_mode=json`);
                return { output: { entry: data.entry ?? [] } };
            }

            case 'listDashboards': {
                const data = await sf('GET', '/services/data/ui/views?output_mode=json&search=isDashboard%3D1');
                const entry = (data.entry ?? []).map((e: any) => ({
                    name: e.name,
                    content: { label: e.content?.label },
                }));
                return { output: { entry } };
            }

            default:
                return { error: `Splunk action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Splunk action failed.' };
    }
}
