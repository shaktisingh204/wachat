
'use server';

export async function executeDynatraceAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const tenantId = String(inputs.tenantId ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!tenantId) throw new Error('tenantId is required.');
        if (!apiToken) throw new Error('apiToken is required.');

        const baseUrl = `https://${tenantId}.live.dynatrace.com/api`;

        async function dtFetch(method: string, path: string, body?: any) {
            logger?.log(`[Dynatrace] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Api-Token ${apiToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error?.message || `Dynatrace API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'getProblems': {
                const params = new URLSearchParams();
                if (inputs.timeframe) params.set('timeFrame', inputs.timeframe);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dtFetch('GET', `/v2/problems${qs}`);
                return { output: { problems: data?.problems ?? data } };
            }
            case 'getProblem': {
                const problemId = String(inputs.problemId ?? '').trim();
                if (!problemId) throw new Error('problemId is required.');
                const data = await dtFetch('GET', `/v2/problems/${encodeURIComponent(problemId)}`);
                return { output: { problem: data } };
            }
            case 'closeProblem': {
                const problemId = String(inputs.problemId ?? '').trim();
                if (!problemId) throw new Error('problemId is required.');
                const body = { message: inputs.message ?? 'Closed via SabFlow' };
                const data = await dtFetch('POST', `/v2/problems/${encodeURIComponent(problemId)}/close`, body);
                return { output: { result: data } };
            }
            case 'getEvents': {
                const params = new URLSearchParams();
                if (inputs.eventType) params.set('eventType', inputs.eventType);
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.entityId) params.set('entityId', inputs.entityId);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dtFetch('GET', `/v2/events${qs}`);
                return { output: { events: data?.events ?? data } };
            }
            case 'pushEvent': {
                const eventType = String(inputs.eventType ?? 'CUSTOM_INFO').trim();
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: Record<string, any> = {
                    eventType,
                    title,
                    properties: inputs.properties ?? {},
                };
                if (inputs.entitySelector) body.entitySelector = inputs.entitySelector;
                if (inputs.startTime) body.startTime = inputs.startTime;
                if (inputs.endTime) body.endTime = inputs.endTime;
                const data = await dtFetch('POST', '/v2/events/ingest', body);
                return { output: { result: data } };
            }
            case 'getMetrics': {
                const params = new URLSearchParams();
                if (inputs.selector) params.set('metricSelector', inputs.selector);
                if (inputs.fields) params.set('fields', inputs.fields);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dtFetch('GET', `/v2/metrics${qs}`);
                return { output: { metrics: data?.metrics ?? data } };
            }
            case 'getMetricData': {
                const selector = String(inputs.selector ?? inputs.metricSelector ?? '').trim();
                if (!selector) throw new Error('selector is required.');
                const params = new URLSearchParams({ metricSelector: selector });
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.resolution) params.set('resolution', inputs.resolution);
                const data = await dtFetch('GET', `/v2/metrics/query?${params.toString()}`);
                return { output: { result: data } };
            }
            case 'listEntities': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('entitySelector', `type("${inputs.type}")`);
                if (inputs.entitySelector) params.set('entitySelector', inputs.entitySelector);
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.fields) params.set('fields', inputs.fields);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dtFetch('GET', `/v2/entities${qs}`);
                return { output: { entities: data?.entities ?? data } };
            }
            case 'getEntity': {
                const entityId = String(inputs.entityId ?? '').trim();
                if (!entityId) throw new Error('entityId is required.');
                const data = await dtFetch('GET', `/v2/entities/${encodeURIComponent(entityId)}`);
                return { output: { entity: data } };
            }
            case 'listMonitors': {
                const data = await dtFetch('GET', '/v1/synthetic/monitors');
                return { output: { monitors: data?.monitors ?? data } };
            }
            case 'getMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await dtFetch('GET', `/v1/synthetic/monitors/${encodeURIComponent(monitorId)}`);
                return { output: { monitor: data } };
            }
            case 'listSloEvents': {
                const params = new URLSearchParams();
                if (inputs.pageIdx) params.set('pageIdx', String(inputs.pageIdx));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dtFetch('GET', `/v2/slos${qs}`);
                return { output: { slos: data?.slo ?? data } };
            }
            case 'getSlo': {
                const sloId = String(inputs.sloId ?? '').trim();
                if (!sloId) throw new Error('sloId is required.');
                const data = await dtFetch('GET', `/v2/slos/${encodeURIComponent(sloId)}`);
                return { output: { slo: data } };
            }
            case 'getAuditLog': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.filter) params.set('filter', inputs.filter);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dtFetch('GET', `/v2/auditlogs${qs}`);
                return { output: { auditLogs: data?.auditLogs ?? data } };
            }
            case 'createTag': {
                const entitySelector = String(inputs.entitySelector ?? '').trim();
                if (!entitySelector) throw new Error('entitySelector is required.');
                const tags = inputs.tags ?? [];
                const data = await dtFetch('POST', `/v2/tags?entitySelector=${encodeURIComponent(entitySelector)}`, { tags });
                return { output: { result: data } };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Dynatrace] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
