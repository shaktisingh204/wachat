
'use server';

const APIFY_BASE_URL = 'https://api.apify.com/v2';

async function apifyFetch(token: string, method: string, path: string, body?: any, query?: Record<string, any>, logger?: any): Promise<any> {
    const cleanQuery: Record<string, string> = {};
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null && v !== '') cleanQuery[k] = String(v);
        }
    }
    const qs = Object.keys(cleanQuery).length > 0 ? `?${new URLSearchParams(cleanQuery).toString()}` : '';
    const url = `${APIFY_BASE_URL}${path}${qs}`;
    logger?.log(`[Apify] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    let data: any;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        data = await res.json();
    } else {
        const text = await res.text();
        if (!res.ok) throw new Error(`Apify API error (${res.status}): ${text}`);
        return { value: text };
    }
    if (!res.ok) {
        throw new Error(data?.error?.message || `Apify API error: ${res.status}`);
    }
    return data;
}

export async function executeApifyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) return { error: 'token is required.' };

        const apify = (method: string, path: string, body?: any, query?: Record<string, any>) =>
            apifyFetch(token, method, path, body, query, logger);

        switch (actionName) {
            case 'runActor': {
                const actorId = String(inputs.actorId ?? '').trim();
                if (!actorId) return { error: 'actorId is required.' };
                const query: Record<string, any> = {};
                if (inputs.build) query.build = inputs.build;
                if (inputs.memory) query.memory = inputs.memory;
                if (inputs.timeout) query.timeout = inputs.timeout;
                if (inputs.webhooks?.[0]?.requestUrl) query.webhookUrl = inputs.webhooks[0].requestUrl;
                const data = await apify('POST', `/acts/${actorId}/runs`, { ...(inputs.input ?? {}) }, query);
                return { output: { data: data.data ?? data } };
            }

            case 'runActorAndWait': {
                const actorId = String(inputs.actorId ?? '').trim();
                if (!actorId) return { error: 'actorId is required.' };
                const timeout = inputs.timeout ?? 300;
                const data = await apify('POST', `/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeout}`, inputs.input ?? {});
                return { output: { items: Array.isArray(data) ? data : [] } };
            }

            case 'getRunStatus': {
                const runId = String(inputs.runId ?? '').trim();
                if (!runId) return { error: 'runId is required.' };
                const data = await apify('GET', `/actor-runs/${runId}`);
                return {
                    output: {
                        data: {
                            id: data.data?.id,
                            actId: data.data?.actId,
                            status: data.data?.status,
                            startedAt: data.data?.startedAt,
                            finishedAt: data.data?.finishedAt,
                            exitCode: data.data?.exitCode,
                        },
                    },
                };
            }

            case 'abortRun': {
                const runId = String(inputs.runId ?? '').trim();
                if (!runId) return { error: 'runId is required.' };
                const data = await apify('POST', `/actor-runs/${runId}/abort`);
                return { output: { data: { id: data.data?.id, status: data.data?.status ?? 'ABORTING' } } };
            }

            case 'getDataset': {
                const datasetId = String(inputs.datasetId ?? '').trim();
                if (!datasetId) return { error: 'datasetId is required.' };
                const limit = inputs.limit ?? 100;
                const offset = inputs.offset ?? 0;
                const data = await apify('GET', `/datasets/${datasetId}/items`, undefined, { limit, offset, format: 'json' });
                return {
                    output: {
                        items: Array.isArray(data) ? data : (data.items ?? []),
                        total: data.total,
                        count: data.count,
                        offset: data.offset,
                    },
                };
            }

            case 'listActors': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await apify('GET', '/acts', undefined, { limit, offset });
                return {
                    output: {
                        data: {
                            items: (data.data?.items ?? []).map((a: any) => ({
                                id: a.id,
                                name: a.name,
                                description: a.description,
                                isPublic: a.isPublic,
                            })),
                        },
                    },
                };
            }

            case 'getActor': {
                const actorId = String(inputs.actorId ?? '').trim();
                if (!actorId) return { error: 'actorId is required.' };
                const data = await apify('GET', `/acts/${actorId}`);
                return {
                    output: {
                        data: {
                            id: data.data?.id,
                            name: data.data?.name,
                            description: data.data?.description,
                            defaultRunOptions: data.data?.defaultRunOptions,
                        },
                    },
                };
            }

            case 'listRuns': {
                const actorId = String(inputs.actorId ?? '').trim();
                if (!actorId) return { error: 'actorId is required.' };
                const query: Record<string, any> = { limit: inputs.limit ?? 20 };
                if (inputs.status) query.status = inputs.status;
                const data = await apify('GET', `/acts/${actorId}/runs`, undefined, query);
                return {
                    output: {
                        data: {
                            items: (data.data?.items ?? []).map((r: any) => ({
                                id: r.id,
                                status: r.status,
                                startedAt: r.startedAt,
                            })),
                        },
                    },
                };
            }

            case 'getKeyValue': {
                const storeId = String(inputs.storeId ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!storeId || !key) return { error: 'storeId and key are required.' };
                const data = await apify('GET', `/key-value-stores/${storeId}/records/${key}`);
                return { output: { value: data.value ?? data } };
            }

            case 'setKeyValue': {
                const storeId = String(inputs.storeId ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const value = inputs.value;
                if (!storeId || !key || value === undefined) return { error: 'storeId, key, and value are required.' };
                const contentType = inputs.contentType ?? 'application/json';
                const url = `${APIFY_BASE_URL}/key-value-stores/${storeId}/records/${key}`;
                logger?.log(`[Apify] PUT ${url}`);
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': contentType,
                    },
                    body: typeof value === 'string' ? value : JSON.stringify(value),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Apify API error (${res.status}): ${text}`);
                }
                return { output: { stored: true } };
            }

            case 'createTask': {
                const actorId = String(inputs.actorId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!actorId || !name) return { error: 'actorId and name are required.' };
                const body = {
                    actId: actorId,
                    name,
                    input: inputs.input ?? {},
                    options: {
                        memory: inputs.memory ?? 128,
                        timeout: inputs.timeout ?? 300,
                    },
                };
                const data = await apify('POST', '/actor-tasks', body);
                return { output: { data: { id: data.data?.id, name: data.data?.name } } };
            }

            case 'runTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) return { error: 'taskId is required.' };
                const data = await apify('POST', `/actor-tasks/${taskId}/runs`, inputs.input ?? {});
                return { output: { data: { id: data.data?.id, status: data.data?.status } } };
            }

            case 'getSchedules': {
                const data = await apify('GET', '/schedules');
                return {
                    output: {
                        data: {
                            items: (data.data?.items ?? []).map((s: any) => ({
                                id: s.id,
                                name: s.name,
                                cronExpression: s.cronExpression,
                                actorId: s.actId,
                                isEnabled: s.isEnabled,
                            })),
                        },
                    },
                };
            }

            default:
                return { error: `Unknown Apify action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Apify] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Apify error.' };
    }
}
