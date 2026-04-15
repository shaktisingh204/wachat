
'use server';

async function grafanaFetch(grafanaUrl: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Grafana] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const url = `${grafanaUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || `Grafana API error: ${res.status}`);
    return data;
}

export async function executeGrafanaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const grafanaUrl = String(inputs.grafanaUrl ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!grafanaUrl) throw new Error('grafanaUrl is required.');
        if (!apiKey) throw new Error('apiKey is required.');

        const gf = (method: string, path: string, body?: any) =>
            grafanaFetch(grafanaUrl, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listDashboards': {
                const folderIds = inputs.folderIds !== undefined ? String(inputs.folderIds) : '';
                const qs = folderIds ? `?type=dash-db&folderIds=${encodeURIComponent(folderIds)}` : '?type=dash-db';
                const data = await gf('GET', `/api/search${qs}`);
                return { output: { dashboards: Array.isArray(data) ? data : [] } };
            }

            case 'getDashboard': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await gf('GET', `/api/dashboards/uid/${uid}`);
                return { output: { dashboard: data.dashboard ?? {}, meta: data.meta ?? {} } };
            }

            case 'createDashboard': {
                const dashboard = inputs.dashboard;
                if (!dashboard || typeof dashboard !== 'object') throw new Error('dashboard must be an object.');
                const folderId = inputs.folderId !== undefined ? Number(inputs.folderId) : undefined;
                const message = inputs.message ? String(inputs.message).trim() : undefined;
                const body: any = {
                    dashboard: { ...dashboard, id: null, uid: null },
                    overwrite: false,
                };
                if (folderId !== undefined) body.folderId = folderId;
                if (message) body.message = message;
                const data = await gf('POST', '/api/dashboards/db', body);
                return { output: { id: data.id, uid: data.uid, url: data.url } };
            }

            case 'updateDashboard': {
                const dashboard = inputs.dashboard;
                if (!dashboard || typeof dashboard !== 'object') throw new Error('dashboard must be an object.');
                const message = inputs.message ? String(inputs.message).trim() : undefined;
                const body: any = { dashboard, overwrite: true };
                if (message) body.message = message;
                const data = await gf('POST', '/api/dashboards/db', body);
                return { output: { id: data.id, uid: data.uid } };
            }

            case 'deleteDashboard': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await gf('DELETE', `/api/dashboards/uid/${uid}`);
                return { output: { title: data.title ?? '', message: data.message ?? '' } };
            }

            case 'listAnnotations': {
                const params = new URLSearchParams();
                if (inputs.from !== undefined) params.set('from', String(inputs.from));
                if (inputs.to !== undefined) params.set('to', String(inputs.to));
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await gf('GET', `/api/annotations${qs}`);
                return { output: { annotations: Array.isArray(data) ? data : [] } };
            }

            case 'createAnnotation': {
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');
                const time = inputs.time !== undefined ? Number(inputs.time) : Date.now();
                const tags = Array.isArray(inputs.tags) ? inputs.tags : [];
                const data = await gf('POST', '/api/annotations', { time, text, tags });
                return { output: { id: data.id } };
            }

            case 'listAlertRules': {
                const data = await gf('GET', '/api/v1/provisioning/alert-rules');
                return { output: { rules: Array.isArray(data) ? data : [] } };
            }

            case 'getAlertRule': {
                const uid = String(inputs.uid ?? '').trim();
                if (!uid) throw new Error('uid is required.');
                const data = await gf('GET', `/api/v1/provisioning/alert-rules/${uid}`);
                return { output: { uid: data.uid, title: data.title, condition: data.condition } };
            }

            case 'listDataSources': {
                const data = await gf('GET', '/api/datasources');
                return { output: { datasources: Array.isArray(data) ? data : [] } };
            }

            case 'getDataSource': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await gf('GET', `/api/datasources/${id}`);
                return { output: { id: data.id, name: data.name, type: data.type, url: data.url } };
            }

            case 'listFolders': {
                const data = await gf('GET', '/api/folders');
                return { output: { folders: Array.isArray(data) ? data : [] } };
            }

            case 'createFolder': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const data = await gf('POST', '/api/folders', { title });
                return { output: { id: data.id, uid: data.uid, title: data.title } };
            }

            case 'listTeams': {
                const data = await gf('GET', '/api/teams/search');
                return { output: { teams: data.teams ?? (Array.isArray(data) ? data : []) } };
            }

            case 'createTeam': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const email = inputs.email ? String(inputs.email).trim() : undefined;
                const body: any = { name };
                if (email) body.email = email;
                const data = await gf('POST', '/api/teams', body);
                return { output: { teamId: data.teamId } };
            }

            default:
                return { error: `Grafana action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Grafana action failed.' };
    }
}
