
'use server';

function getDatadogBase(site?: string): string {
    return site === 'EU'
        ? 'https://api.datadoghq.eu/api/v1'
        : 'https://api.datadoghq.com/api/v1';
}

async function datadogFetch(
    apiKey: string,
    appKey: string,
    method: string,
    url: string,
    body?: any,
    logger?: any,
) {
    logger?.log(`[Datadog] ${method} ${url}`);
    const headers: Record<string, string> = {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey,
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
        const msg = data?.errors?.[0] || data?.error || `Datadog API error: ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
}

export async function executeDatadogAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const appKey = String(inputs.appKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!appKey) throw new Error('appKey is required.');

        const base = getDatadogBase(inputs.site);
        const dd = (method: string, path: string, body?: any) =>
            datadogFetch(apiKey, appKey, method, `${base}${path}`, body, logger);

        switch (actionName) {
            case 'submitMetrics': {
                const series = inputs.series;
                if (!Array.isArray(series) || series.length === 0) throw new Error('series must be a non-empty array.');
                const data = await dd('POST', '/series', { series });
                return { output: { status: data.status ?? 'ok' } };
            }

            case 'queryMetrics': {
                const query = String(inputs.query ?? '').trim();
                const from = Number(inputs.from);
                const to = Number(inputs.to);
                if (!query) throw new Error('query is required.');
                if (!from || !to) throw new Error('from and to are required.');
                const data = await dd('GET', `/query?query=${encodeURIComponent(query)}&from=${from}&to=${to}`);
                return { output: { series: data.series ?? [] } };
            }

            case 'listDashboards': {
                const data = await dd('GET', '/dashboard');
                return { output: { dashboards: data.dashboards ?? [] } };
            }

            case 'getDashboard': {
                const dashboardId = String(inputs.dashboardId ?? '').trim();
                if (!dashboardId) throw new Error('dashboardId is required.');
                const data = await dd('GET', `/dashboard/${dashboardId}`);
                return { output: { id: data.id, title: data.title, description: data.description, widgets: data.widgets ?? [] } };
            }

            case 'createDashboard': {
                const title = String(inputs.title ?? '').trim();
                const layoutType = String(inputs.layoutType ?? '').trim();
                const widgets = inputs.widgets;
                if (!title) throw new Error('title is required.');
                if (!layoutType) throw new Error('layoutType is required.');
                if (!Array.isArray(widgets)) throw new Error('widgets must be an array.');
                const body: any = { title, layout_type: layoutType, widgets };
                if (inputs.description) body.description = String(inputs.description).trim();
                const data = await dd('POST', '/dashboard', body);
                return { output: { id: data.id, url: data.url } };
            }

            case 'deleteDashboard': {
                const dashboardId = String(inputs.dashboardId ?? '').trim();
                if (!dashboardId) throw new Error('dashboardId is required.');
                const data = await dd('DELETE', `/dashboard/${dashboardId}`);
                return { output: { deletedDashboardId: data.deleted_dashboard_id ?? dashboardId } };
            }

            case 'listMonitors': {
                const tags = inputs.tags ? String(inputs.tags).trim() : '';
                const name = inputs.name ? String(inputs.name).trim() : '';
                const params = new URLSearchParams();
                if (tags) params.set('tags', tags);
                if (name) params.set('name', name);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await dd('GET', `/monitor${qs}`);
                const monitors = Array.isArray(data) ? data.map((m: any) => ({
                    id: m.id, name: m.name, type: m.type, status: m.overall_state,
                })) : [];
                return { output: { monitors } };
            }

            case 'getMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await dd('GET', `/monitor/${monitorId}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        type: data.type,
                        query: data.query,
                        message: data.message,
                        status: data.overall_state,
                    },
                };
            }

            case 'createMonitor': {
                const type = String(inputs.type ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!type || !query || !name || !message) throw new Error('type, query, name, and message are required.');
                const body: any = { type, query, name, message };
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : String(inputs.tags).split(',').map((t: string) => t.trim());
                if (inputs.thresholds) body.options = { thresholds: inputs.thresholds };
                const data = await dd('POST', '/monitor', body);
                return { output: { id: data.id, name: data.name } };
            }

            case 'updateMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const updateData = inputs.data && typeof inputs.data === 'object' ? inputs.data : {};
                const data = await dd('PUT', `/monitor/${monitorId}`, updateData);
                return { output: { id: data.id } };
            }

            case 'deleteMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const data = await dd('DELETE', `/monitor/${monitorId}`);
                return { output: { deletedMonitorId: data.deleted_monitor_id ?? Number(monitorId) } };
            }

            case 'muteMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');
                const body: any = {};
                if (inputs.end !== undefined) body.end = inputs.end;
                const data = await dd('POST', `/monitor/${monitorId}/mute`, body);
                return { output: { id: data.id } };
            }

            case 'listEvents': {
                const start = Number(inputs.start);
                const end = Number(inputs.end);
                if (!start || !end) throw new Error('start and end are required.');
                const params = new URLSearchParams({ start: String(start), end: String(end) });
                if (inputs.tags) params.set('tags', String(inputs.tags));
                if (inputs.priority) params.set('priority', String(inputs.priority));
                const data = await dd('GET', `/events?${params.toString()}`);
                const events = (data.events ?? []).map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    text: e.text,
                    dateHappened: e.date_happened,
                }));
                return { output: { events } };
            }

            case 'createEvent': {
                const title = String(inputs.title ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!title || !text) throw new Error('title and text are required.');
                const body: any = { title, text, alert_type: inputs.alertType ?? 'info' };
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : String(inputs.tags).split(',').map((t: string) => t.trim());
                if (inputs.host) body.host = String(inputs.host).trim();
                const data = await dd('POST', '/events', body);
                return { output: { event: { id: data.event?.id } } };
            }

            case 'getServiceChecks': {
                // Use v2 API for service checks
                const v2Url = (inputs.site === 'EU')
                    ? 'https://api.datadoghq.eu/api/v2/service_checks'
                    : 'https://api.datadoghq.com/api/v2/service_checks';
                const data = await datadogFetch(apiKey, appKey, 'GET', v2Url, undefined, logger);
                return { output: { data: data.data ?? [] } };
            }

            default:
                return { error: `Datadog action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Datadog action failed.' };
    }
}
