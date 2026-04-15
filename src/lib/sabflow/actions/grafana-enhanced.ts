'use server';

const DEFAULT_GRAFANA_URL = 'https://grafana.example.com';

async function grafanaFetch(
    apiKey: string,
    baseUrl: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    logger?.log(`[Grafana Enhanced] ${method} ${url}`);
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Grafana API error ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
}

export async function executeGrafanaEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey, grafanaUrl = DEFAULT_GRAFANA_URL } = inputs;
        if (!apiKey) return { error: 'apiKey is required' };

        switch (actionName) {
            case 'listDashboards': {
                const { query = '', limit = 100 } = inputs;
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', `/api/search?type=dash-db&query=${encodeURIComponent(query)}&limit=${limit}`, undefined, logger);
                return { output: { dashboards: data } };
            }

            case 'getDashboard': {
                const { uid } = inputs;
                if (!uid) return { error: 'uid is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', `/api/dashboards/uid/${uid}`, undefined, logger);
                return { output: { dashboard: data } };
            }

            case 'createDashboard': {
                const { dashboard, folderId = 0, overwrite = false, message = '' } = inputs;
                if (!dashboard) return { error: 'dashboard object is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'POST', '/api/dashboards/db', { dashboard, folderId, overwrite, message }, logger);
                return { output: { result: data } };
            }

            case 'updateDashboard': {
                const { dashboard, folderId, overwrite = true, message = '' } = inputs;
                if (!dashboard) return { error: 'dashboard object is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'POST', '/api/dashboards/db', { dashboard, folderId, overwrite, message }, logger);
                return { output: { result: data } };
            }

            case 'deleteDashboard': {
                const { uid } = inputs;
                if (!uid) return { error: 'uid is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'DELETE', `/api/dashboards/uid/${uid}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'listDataSources': {
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', '/api/datasources', undefined, logger);
                return { output: { dataSources: data } };
            }

            case 'getDataSource': {
                const { id } = inputs;
                if (!id) return { error: 'id is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', `/api/datasources/${id}`, undefined, logger);
                return { output: { dataSource: data } };
            }

            case 'createDataSource': {
                const { dataSource } = inputs;
                if (!dataSource) return { error: 'dataSource object is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'POST', '/api/datasources', dataSource, logger);
                return { output: { dataSource: data } };
            }

            case 'updateDataSource': {
                const { id, dataSource } = inputs;
                if (!id || !dataSource) return { error: 'id and dataSource are required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'PUT', `/api/datasources/${id}`, dataSource, logger);
                return { output: { dataSource: data } };
            }

            case 'listAlerts': {
                const { state, limit = 100 } = inputs;
                const query = state ? `?state=${state}` : '';
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', `/api/alerts${query}`, undefined, logger);
                return { output: { alerts: data } };
            }

            case 'getAlert': {
                const { id } = inputs;
                if (!id) return { error: 'id is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', `/api/alerts/${id}`, undefined, logger);
                return { output: { alert: data } };
            }

            case 'pauseAlert': {
                const { id, paused = true } = inputs;
                if (!id) return { error: 'id is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'POST', `/api/alerts/${id}/pause`, { paused }, logger);
                return { output: { result: data } };
            }

            case 'listAnnotations': {
                const { from, to, dashboardId, panelId, limit = 100 } = inputs;
                const params = new URLSearchParams({ limit: String(limit) });
                if (from) params.set('from', from);
                if (to) params.set('to', to);
                if (dashboardId) params.set('dashboardId', dashboardId);
                if (panelId) params.set('panelId', panelId);
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', `/api/annotations?${params.toString()}`, undefined, logger);
                return { output: { annotations: data } };
            }

            case 'createAnnotation': {
                const { annotation } = inputs;
                if (!annotation) return { error: 'annotation object is required' };
                const data = await grafanaFetch(apiKey, grafanaUrl, 'POST', '/api/annotations', annotation, logger);
                return { output: { annotation: data } };
            }

            case 'listFolders': {
                const { limit = 1000 } = inputs;
                const data = await grafanaFetch(apiKey, grafanaUrl, 'GET', `/api/folders?limit=${limit}`, undefined, logger);
                return { output: { folders: data } };
            }

            default:
                return { error: `Unknown Grafana Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Grafana Enhanced] Error: ${err.message}`);
        return { error: err.message || 'Grafana Enhanced action failed' };
    }
}
