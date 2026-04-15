'use server';

export async function executeDatadogEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const appKey = String(inputs.appKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const baseUrl = 'https://api.datadoghq.com/api/v2';

        async function ddFetch(method: string, path: string, body?: any) {
            logger?.log(`[DatadogEnhanced] ${method} ${baseUrl}${path}`);
            const headers: Record<string, string> = {
                'DD-API-KEY': apiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            if (appKey) headers['DD-APPLICATION-KEY'] = appKey;

            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);

            const res = await fetch(`${baseUrl}${path}`, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.errors?.[0] || data?.message || `Datadog API error: ${res.status}`);
            return data;
        }

        // v1 helper for endpoints not yet on v2
        async function ddFetchV1(method: string, path: string, body?: any) {
            const v1Url = 'https://api.datadoghq.com/api/v1';
            logger?.log(`[DatadogEnhanced] ${method} ${v1Url}${path}`);
            const headers: Record<string, string> = {
                'DD-API-KEY': apiKey,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            if (appKey) headers['DD-APPLICATION-KEY'] = appKey;

            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);

            const res = await fetch(`${v1Url}${path}`, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.errors?.[0] || data?.message || `Datadog API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'queryMetrics': {
                const query = String(inputs.query ?? '');
                const from = Number(inputs.from ?? Math.floor(Date.now() / 1000) - 3600);
                const to = Number(inputs.to ?? Math.floor(Date.now() / 1000));
                if (!query) throw new Error('query is required.');
                const params = new URLSearchParams({ query, from: String(from), to: String(to) });
                const data = await ddFetch('GET', `/query?${params.toString()}`);
                return { output: data };
            }

            case 'listMetrics': {
                const q = inputs.q ? `?q=${encodeURIComponent(String(inputs.q))}` : '';
                const data = await ddFetch('GET', `/metrics${q}`);
                return { output: data };
            }

            case 'submitMetrics': {
                const series = inputs.series;
                if (!series) throw new Error('series is required.');
                const payload = Array.isArray(series) ? { series } : series;
                const data = await ddFetch('POST', '/series', payload);
                return { output: data };
            }

            case 'createMonitor': {
                const type = String(inputs.type ?? '');
                const query = String(inputs.query ?? '');
                const name = String(inputs.name ?? '');
                if (!type || !query || !name) throw new Error('type, query, and name are required.');
                const body: any = { type, query, name };
                if (inputs.message) body.message = String(inputs.message);
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : [inputs.tags];
                if (inputs.options) body.options = inputs.options;
                const data = await ddFetchV1('/monitor', body);
                return { output: data };
            }

            case 'getMonitor': {
                const monitorId = String(inputs.monitorId ?? '');
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await ddFetchV1(`/monitor/${monitorId}`);
                return { output: data };
            }

            case 'updateMonitor': {
                const monitorId = String(inputs.monitorId ?? '');
                if (!monitorId) throw new Error('monitorId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.query) body.query = String(inputs.query);
                if (inputs.message) body.message = String(inputs.message);
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : [inputs.tags];
                if (inputs.options) body.options = inputs.options;
                const data = await ddFetchV1(`/monitor/${monitorId}`, body);
                return { output: data };
            }

            case 'deleteMonitor': {
                const monitorId = String(inputs.monitorId ?? '');
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await ddFetchV1(`/monitor/${monitorId}`);
                return { output: { deleted: true, monitorId, ...data } };
            }

            case 'listMonitors': {
                const params = new URLSearchParams();
                if (inputs.groupStates) params.set('group_states', String(inputs.groupStates));
                if (inputs.name) params.set('name', String(inputs.name));
                if (inputs.tags) params.set('monitor_tags', String(inputs.tags));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await ddFetchV1(`/monitor${qs}`);
                return { output: data };
            }

            case 'muteMonitor': {
                const monitorId = String(inputs.monitorId ?? '');
                if (!monitorId) throw new Error('monitorId is required.');
                const body: any = {};
                if (inputs.scope) body.scope = String(inputs.scope);
                if (inputs.end) body.end = Number(inputs.end);
                const data = await ddFetchV1(`/monitor/${monitorId}/mute`, body);
                return { output: data };
            }

            case 'unmuteMonitor': {
                const monitorId = String(inputs.monitorId ?? '');
                if (!monitorId) throw new Error('monitorId is required.');
                const body: any = {};
                if (inputs.scope) body.scope = String(inputs.scope);
                const data = await ddFetchV1(`/monitor/${monitorId}/unmute`, body);
                return { output: data };
            }

            case 'listAlerts': {
                const params = new URLSearchParams();
                if (inputs.startDt) params.set('start', String(inputs.startDt));
                if (inputs.endDt) params.set('end', String(inputs.endDt));
                if (inputs.priority) params.set('priority', String(inputs.priority));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await ddFetchV1(`/events${qs}`);
                return { output: data };
            }

            case 'createDashboard': {
                const title = String(inputs.title ?? '');
                const layoutType = String(inputs.layoutType ?? 'ordered');
                if (!title) throw new Error('title is required.');
                const body: any = { title, layout_type: layoutType };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.widgets) body.widgets = inputs.widgets;
                if (inputs.templateVariables) body.template_variables = inputs.templateVariables;
                const data = await ddFetchV1('/dashboard', body);
                return { output: data };
            }

            case 'getDashboard': {
                const dashboardId = String(inputs.dashboardId ?? '');
                if (!dashboardId) throw new Error('dashboardId is required.');
                const data = await ddFetchV1(`/dashboard/${dashboardId}`);
                return { output: data };
            }

            case 'createDowntime': {
                const scope = inputs.scope;
                const start = Number(inputs.start ?? Math.floor(Date.now() / 1000));
                if (!scope) throw new Error('scope is required.');
                const body: any = {
                    scope: Array.isArray(scope) ? scope : [scope],
                    start,
                };
                if (inputs.end) body.end = Number(inputs.end);
                if (inputs.message) body.message = String(inputs.message);
                if (inputs.monitorId) body.monitor_id = Number(inputs.monitorId);
                if (inputs.timezone) body.timezone = String(inputs.timezone);
                const data = await ddFetchV1('/downtime', body);
                return { output: data };
            }

            case 'listEvents': {
                const start = Number(inputs.start ?? Math.floor(Date.now() / 1000) - 3600);
                const end = Number(inputs.end ?? Math.floor(Date.now() / 1000));
                const params = new URLSearchParams({ start: String(start), end: String(end) });
                if (inputs.priority) params.set('priority', String(inputs.priority));
                if (inputs.sources) params.set('sources', String(inputs.sources));
                if (inputs.tags) params.set('tags', String(inputs.tags));
                if (inputs.unaggregated) params.set('unaggregated', 'true');
                const data = await ddFetchV1(`/events?${params.toString()}`);
                return { output: data };
            }

            default:
                return { error: `Unknown Datadog Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? 'Unknown error in executeDatadogEnhancedAction' };
    }
}
