'use server';

async function apmFetch(kibanaUrl: string, authHeader: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[ElasticAPM] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const base = kibanaUrl.replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || data?.error?.message || `Elastic APM API error: ${res.status}`);
    return data;
}

export async function executeElasticAPMAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const kibanaUrl = String(inputs.kibanaUrl ?? '').trim();
        if (!kibanaUrl) throw new Error('kibanaUrl is required.');

        let authHeader: string;
        if (inputs.apiKey) {
            authHeader = `ApiKey ${String(inputs.apiKey).trim()}`;
        } else if (inputs.username && inputs.password) {
            const encoded = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
            authHeader = `Basic ${encoded}`;
        } else {
            throw new Error('Either apiKey or username+password is required.');
        }

        const apm = (method: string, path: string, body?: any) =>
            apmFetch(kibanaUrl, authHeader, method, path, body, logger);

        const start = inputs.start ? String(inputs.start).trim() : 'now-1h';
        const end = inputs.end ? String(inputs.end).trim() : 'now';
        const environment = inputs.environment ? String(inputs.environment).trim() : 'ENVIRONMENT_ALL';

        switch (actionName) {
            case 'getServices': {
                const params = new URLSearchParams({ start, end, environment });
                const data = await apm('GET', `/api/apm/services?${params.toString()}`);
                return { output: { services: data?.items ?? data } };
            }

            case 'getService': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const params = new URLSearchParams({ start, end, environment });
                const data = await apm('GET', `/api/apm/services/${encodeURIComponent(serviceName)}?${params.toString()}`);
                return { output: { service: data } };
            }

            case 'getTransactions': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const params = new URLSearchParams({ start, end, environment });
                if (inputs.transactionType) params.set('transactionType', String(inputs.transactionType).trim());
                const data = await apm('GET', `/api/apm/services/${encodeURIComponent(serviceName)}/transactions/groups?${params.toString()}`);
                return { output: { transactions: data?.items ?? data } };
            }

            case 'getErrors': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const params = new URLSearchParams({ start, end, environment });
                const data = await apm('GET', `/api/apm/services/${encodeURIComponent(serviceName)}/errors?${params.toString()}`);
                return { output: { errors: data?.items ?? data } };
            }

            case 'getMetrics': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const params = new URLSearchParams({ start, end, environment });
                const data = await apm('GET', `/api/apm/services/${encodeURIComponent(serviceName)}/metrics/charts?${params.toString()}`);
                return { output: { metrics: data } };
            }

            case 'getTraces': {
                const params = new URLSearchParams({ start, end, environment });
                if (inputs.query) params.set('query', String(inputs.query).trim());
                const data = await apm('GET', `/api/apm/traces?${params.toString()}`);
                return { output: { traces: data?.items ?? data } };
            }

            case 'getAnomalies': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const params = new URLSearchParams({ start, end, environment });
                const data = await apm('GET', `/api/apm/services/${encodeURIComponent(serviceName)}/anomaly_charts?${params.toString()}`);
                return { output: { anomalies: data } };
            }

            case 'listAlerts': {
                const params = new URLSearchParams({ start, end });
                if (inputs.status) params.set('status', String(inputs.status).trim());
                const data = await apm('GET', `/api/alerting/rules/_find?${params.toString()}`);
                return { output: { alerts: data?.data ?? data } };
            }

            case 'createAlert': {
                const name = String(inputs.name ?? '').trim();
                const ruleTypeId = String(inputs.ruleTypeId ?? 'apm.error_rate').trim();
                if (!name) throw new Error('name is required.');
                const body: any = {
                    name,
                    rule_type_id: ruleTypeId,
                    consumer: 'apm',
                    schedule: { interval: inputs.interval ? String(inputs.interval).trim() : '5m' },
                    params: inputs.params
                        ? (typeof inputs.params === 'string' ? JSON.parse(inputs.params) : inputs.params)
                        : {},
                    actions: inputs.actions
                        ? (typeof inputs.actions === 'string' ? JSON.parse(inputs.actions) : inputs.actions)
                        : [],
                };
                const data = await apm('POST', `/api/alerting/rule`, body);
                return { output: { alert: data } };
            }

            case 'listRules': {
                const params = new URLSearchParams();
                if (inputs.ruleTypeId) params.set('rule_type_ids', String(inputs.ruleTypeId).trim());
                const data = await apm('GET', `/api/alerting/rules/_find?${params.toString()}`);
                return { output: { rules: data?.data ?? data } };
            }

            case 'createRule': {
                const name = String(inputs.name ?? '').trim();
                const ruleTypeId = String(inputs.ruleTypeId ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!ruleTypeId) throw new Error('ruleTypeId is required.');
                const body: any = {
                    name,
                    rule_type_id: ruleTypeId,
                    consumer: inputs.consumer ? String(inputs.consumer).trim() : 'apm',
                    schedule: { interval: inputs.interval ? String(inputs.interval).trim() : '5m' },
                    params: inputs.params
                        ? (typeof inputs.params === 'string' ? JSON.parse(inputs.params) : inputs.params)
                        : {},
                    actions: inputs.actions
                        ? (typeof inputs.actions === 'string' ? JSON.parse(inputs.actions) : inputs.actions)
                        : [],
                };
                const data = await apm('POST', `/api/alerting/rule`, body);
                return { output: { rule: data } };
            }

            case 'getServiceMap': {
                const params = new URLSearchParams({ start, end, environment });
                if (inputs.serviceName) params.set('serviceName', String(inputs.serviceName).trim());
                const data = await apm('GET', `/api/apm/service-map?${params.toString()}`);
                return { output: { serviceMap: data } };
            }

            case 'getCorrelations': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const transactionType = String(inputs.transactionType ?? 'request').trim();
                const transactionName = String(inputs.transactionName ?? '').trim();
                const params = new URLSearchParams({ start, end, environment });
                params.set('transactionType', transactionType);
                if (transactionName) params.set('transactionName', transactionName);
                const data = await apm('GET', `/api/apm/correlations/field_candidates?${params.toString()}`);
                return { output: { correlations: data } };
            }

            case 'getLatencyDistribution': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const params = new URLSearchParams({ start, end, environment });
                if (inputs.transactionType) params.set('transactionType', String(inputs.transactionType).trim());
                if (inputs.transactionName) params.set('transactionName', String(inputs.transactionName).trim());
                const data = await apm('GET', `/api/apm/services/${encodeURIComponent(serviceName)}/transactions/charts/latency?${params.toString()}`);
                return { output: { latency: data } };
            }

            case 'getErrorGroups': {
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const params = new URLSearchParams({ start, end, environment });
                if (inputs.groupId) params.set('groupId', String(inputs.groupId).trim());
                const data = await apm('GET', `/api/apm/services/${encodeURIComponent(serviceName)}/errors/groups?${params.toString()}`);
                return { output: { errorGroups: data?.items ?? data } };
            }

            default:
                throw new Error(`Unknown Elastic APM action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
