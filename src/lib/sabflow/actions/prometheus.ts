
'use server';

function buildPrometheusAuthHeader(inputs: any): string | null {
    if (inputs.token) {
        return `Bearer ${String(inputs.token).trim()}`;
    }
    if (inputs.username && inputs.password) {
        const creds = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
        return `Basic ${creds}`;
    }
    return null;
}

async function promFetch(
    serverUrl: string,
    authHeader: string | null,
    method: string,
    path: string,
    body?: string,
    contentType = 'application/x-www-form-urlencoded',
    logger?: any,
) {
    logger?.log(`[Prometheus] ${method} ${path}`);
    const url = `${serverUrl.replace(/\/$/, '')}${path}`;
    const headers: Record<string, string> = {};
    if (authHeader) headers['Authorization'] = authHeader;
    if (body !== undefined) headers['Content-Type'] = contentType;
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = body;
    const res = await fetch(url, options);
    // Health check returns plain text
    if (path === '/-/healthy') {
        return { healthy: res.ok };
    }
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        const msg = data?.error || data?.message || `Prometheus API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executePrometheusAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        const authHeader = buildPrometheusAuthHeader(inputs);
        const prom = (method: string, path: string, body?: string, ct?: string) =>
            promFetch(serverUrl, authHeader, method, path, body, ct, logger);

        switch (actionName) {
            case 'queryInstant': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const params = new URLSearchParams({ query });
                if (inputs.time) params.set('time', String(inputs.time));
                const data = await prom('GET', `/api/v1/query?${params.toString()}`);
                return {
                    output: {
                        status: data.status,
                        data: data.data ?? {},
                    },
                };
            }

            case 'queryRange': {
                const query = String(inputs.query ?? '').trim();
                const start = String(inputs.start ?? '').trim();
                const end = String(inputs.end ?? '').trim();
                const step = String(inputs.step ?? '').trim();
                if (!query || !start || !end || !step) throw new Error('query, start, end, and step are required.');
                const qs = `query=${encodeURIComponent(query)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&step=${encodeURIComponent(step)}`;
                const data = await prom('GET', `/api/v1/query_range?${qs}`);
                return { output: { data: data.data ?? {} } };
            }

            case 'listLabels': {
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.end) params.set('end', String(inputs.end));
                if (inputs.match) params.set('match[]', String(inputs.match));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await prom('GET', `/api/v1/labels${qs}`);
                return { output: { data: data.data ?? [] } };
            }

            case 'getLabelValues': {
                const labelName = String(inputs.labelName ?? '').trim();
                if (!labelName) throw new Error('labelName is required.');
                const params = new URLSearchParams();
                if (inputs.start) params.set('start', String(inputs.start));
                if (inputs.end) params.set('end', String(inputs.end));
                if (inputs.match) params.set('match[]', String(inputs.match));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await prom('GET', `/api/v1/label/${encodeURIComponent(labelName)}/values${qs}`);
                return { output: { data: data.data ?? [] } };
            }

            case 'listMetrics': {
                const data = await prom('GET', '/api/v1/label/__name__/values');
                return { output: { data: data.data ?? [] } };
            }

            case 'getTargets': {
                const state = String(inputs.state ?? 'active');
                const data = await prom('GET', `/api/v1/targets?state=${encodeURIComponent(state)}`);
                const targetsData = data.data ?? {};
                return {
                    output: {
                        data: {
                            activeTargets: (targetsData.activeTargets ?? []).map((t: any) => ({
                                labels: t.labels,
                                scrapeUrl: t.scrapeUrl,
                                health: t.health,
                                lastScrape: t.lastScrape,
                            })),
                            droppedTargets: targetsData.droppedTargets ?? [],
                        },
                    },
                };
            }

            case 'getAlerts': {
                const data = await prom('GET', '/api/v1/alerts');
                const alerts = (data.data?.alerts ?? []).map((a: any) => ({
                    labels: a.labels,
                    state: a.state,
                    activeAt: a.activeAt,
                    value: a.value,
                }));
                return { output: { data: { alerts } } };
            }

            case 'getAlertingRules': {
                const data = await prom('GET', '/api/v1/rules?type=alert');
                return { output: { data: data.data ?? {} } };
            }

            case 'getRecordingRules': {
                const data = await prom('GET', '/api/v1/rules?type=record');
                return { output: { data: data.data ?? {} } };
            }

            case 'getMetadata': {
                const params = new URLSearchParams();
                if (inputs.metric) params.set('metric', String(inputs.metric));
                params.set('limit', String(Number(inputs.limit ?? 10)));
                const data = await prom('GET', `/api/v1/metadata?${params.toString()}`);
                return { output: { data: data.data ?? {} } };
            }

            case 'checkHealth': {
                const data = await prom('GET', '/-/healthy');
                return { output: { healthy: (data as any).healthy ?? false } };
            }

            case 'pushMetrics': {
                const pushgatewayUrl = String(inputs.pushgatewayUrl ?? '').trim();
                const jobName = String(inputs.jobName ?? '').trim();
                const metrics = String(inputs.metrics ?? '').trim();
                if (!pushgatewayUrl) throw new Error('pushgatewayUrl is required.');
                if (!jobName) throw new Error('jobName is required.');
                if (!metrics) throw new Error('metrics (exposition format text) is required.');
                let labelPath = '';
                if (inputs.labels && typeof inputs.labels === 'object') {
                    labelPath = Object.entries(inputs.labels)
                        .map(([k, v]) => `/${encodeURIComponent(k)}/${encodeURIComponent(String(v))}`)
                        .join('');
                }
                const pushUrl = `${pushgatewayUrl.replace(/\/$/, '')}/metrics/job/${encodeURIComponent(jobName)}${labelPath}`;
                logger?.log(`[Prometheus/Pushgateway] POST ${pushUrl}`);
                const headers: Record<string, string> = {
                    'Content-Type': 'text/plain; version=0.0.4',
                };
                if (authHeader) headers['Authorization'] = authHeader;
                const res = await fetch(pushUrl, { method: 'POST', headers, body: metrics });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Pushgateway error ${res.status}: ${errText}`);
                }
                return { output: { pushed: true } };
            }

            default:
                return { error: `Prometheus action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Prometheus action failed.' };
    }
}
