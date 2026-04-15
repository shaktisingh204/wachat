
'use server';

export async function executeGrafanaEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required.');

        const apiKey = String(inputs.apiKey ?? '').trim();
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();

        let authHeader: string;
        if (apiKey) {
            authHeader = `Bearer ${apiKey}`;
        } else if (username && password) {
            authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        } else {
            throw new Error('Either apiKey or username/password is required.');
        }

        const base = `${serverUrl}/api`;

        async function grafanaFetch(method: string, path: string, body?: any) {
            logger?.log(`[GrafanaEnhanced] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${base}${path}`, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || `Grafana API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listDashboards': {
                const data = await grafanaFetch('GET', '/search?type=dash-db');
                return { output: { dashboards: Array.isArray(data) ? data : [] } };
            }
            case 'getDashboard': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await grafanaFetch('GET', `/dashboards/uid/${encodeURIComponent(uid)}`);
                return { output: { dashboard: data } };
            }
            case 'createDashboard': {
                const dashboard = inputs.dashboard ?? {};
                const folderId = inputs.folderId ?? 0;
                const data = await grafanaFetch('POST', '/dashboards/db', {
                    dashboard,
                    folderId,
                    overwrite: false,
                    message: inputs.message ?? '',
                });
                return { output: { result: data } };
            }
            case 'updateDashboard': {
                const dashboard = inputs.dashboard ?? {};
                const folderId = inputs.folderId ?? 0;
                const data = await grafanaFetch('POST', '/dashboards/db', {
                    dashboard,
                    folderId,
                    overwrite: true,
                    message: inputs.message ?? '',
                });
                return { output: { result: data } };
            }
            case 'deleteDashboard': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await grafanaFetch('DELETE', `/dashboards/uid/${encodeURIComponent(uid)}`);
                return { output: { result: data } };
            }
            case 'listFolders': {
                const data = await grafanaFetch('GET', '/folders');
                return { output: { folders: Array.isArray(data) ? data : [] } };
            }
            case 'createFolder': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: Record<string, any> = { title };
                if (inputs.uid) body.uid = inputs.uid;
                const data = await grafanaFetch('POST', '/folders', body);
                return { output: { folder: data } };
            }
            case 'listAlertRules': {
                const data = await grafanaFetch('GET', '/v1/provisioning/alert-rules');
                return { output: { alertRules: Array.isArray(data) ? data : [] } };
            }
            case 'getAlertRule': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await grafanaFetch('GET', `/v1/provisioning/alert-rules/${encodeURIComponent(uid)}`);
                return { output: { alertRule: data } };
            }
            case 'createAlertRule': {
                const rule = inputs.rule ?? inputs;
                const data = await grafanaFetch('POST', '/v1/provisioning/alert-rules', rule);
                return { output: { alertRule: data } };
            }
            case 'updateAlertRule': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const rule = inputs.rule ?? inputs;
                const data = await grafanaFetch('PUT', `/v1/provisioning/alert-rules/${encodeURIComponent(uid)}`, rule);
                return { output: { alertRule: data } };
            }
            case 'listAnnotations': {
                const qs = inputs.from || inputs.to ? `?${inputs.from ? `from=${inputs.from}&` : ''}${inputs.to ? `to=${inputs.to}` : ''}` : '';
                const data = await grafanaFetch('GET', `/annotations${qs}`);
                return { output: { annotations: Array.isArray(data) ? data : [] } };
            }
            case 'createAnnotation': {
                const body: Record<string, any> = {
                    text: inputs.text ?? '',
                    tags: inputs.tags ?? [],
                };
                if (inputs.time) body.time = inputs.time;
                if (inputs.timeEnd) body.timeEnd = inputs.timeEnd;
                if (inputs.dashboardUID) body.dashboardUID = inputs.dashboardUID;
                if (inputs.panelId) body.panelId = inputs.panelId;
                const data = await grafanaFetch('POST', '/annotations', body);
                return { output: { annotation: data } };
            }
            case 'queryDatasource': {
                const queries = inputs.queries ?? [];
                const from = inputs.from ?? 'now-1h';
                const to = inputs.to ?? 'now';
                const data = await grafanaFetch('POST', '/ds/query', { queries, from, to });
                return { output: { results: data } };
            }
            case 'listDatasources': {
                const data = await grafanaFetch('GET', '/datasources');
                return { output: { datasources: Array.isArray(data) ? data : [] } };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[GrafanaEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
