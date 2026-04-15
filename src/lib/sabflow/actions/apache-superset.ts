'use server';

export async function executeApacheSupersetAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output: any } | { error: string }> {
    try {
        logger.log(`Executing Apache Superset action: ${actionName}`);

        const baseUrl = (inputs.supersetUrl as string)?.replace(/\/$/, '');
        if (!baseUrl) return { error: 'Missing required input: supersetUrl' };

        async function getToken(): Promise<string> {
            if (inputs.accessToken) return inputs.accessToken;
            if (!inputs.username) throw new Error('Missing required input: username');
            if (!inputs.password) throw new Error('Missing required input: password');
            const res = await fetch(`${baseUrl}/api/v1/security/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    username: inputs.username,
                    password: inputs.password,
                    provider: 'db',
                    refresh: true,
                }),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(data?.message ?? `Superset login error ${res.status}: ${text}`);
            }
            return data.access_token;
        }

        const token = await getToken();

        async function supersetFetch(method: string, path: string, body?: any): Promise<any> {
            const url = `${baseUrl}/api/v1${path}`;
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(data?.message ?? data?.error ?? `Superset API error ${res.status}: ${text}`);
            }
            return data;
        }

        switch (actionName) {

            case 'listDashboards': {
                const page = inputs.page ?? 0;
                const pageSize = inputs.pageSize ?? 20;
                const params = new URLSearchParams({ q: JSON.stringify({ page, page_size: pageSize }) });
                const data = await supersetFetch('GET', `/dashboard?${params.toString()}`);
                return { output: { dashboards: data.result ?? data, count: data.count } };
            }

            case 'getDashboard': {
                if (!inputs.dashboardId) return { error: 'Missing required input: dashboardId' };
                const data = await supersetFetch('GET', `/dashboard/${inputs.dashboardId}`);
                return { output: { dashboard: data.result ?? data } };
            }

            case 'importDashboard': {
                if (!inputs.formData) return { error: 'Missing required input: formData (multipart form with dashboard file)' };
                // formData should be a pre-built FormData compatible object; pass raw body as JSON alternative
                const res = await fetch(`${baseUrl}/api/v1/dashboard/import/`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: inputs.formData,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.message ?? `Superset import error ${res.status}: ${text}`);
                return { output: { success: true, result: data } };
            }

            case 'exportDashboard': {
                if (!inputs.dashboardId) return { error: 'Missing required input: dashboardId' };
                const params = new URLSearchParams({ q: JSON.stringify([inputs.dashboardId]) });
                const res = await fetch(`${baseUrl}/api/v1/dashboard/export/?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Superset export error ${res.status}: ${text}`);
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { base64Zip: base64, contentType: res.headers.get('content-type') } };
            }

            case 'listCharts': {
                const page = inputs.page ?? 0;
                const pageSize = inputs.pageSize ?? 20;
                const params = new URLSearchParams({ q: JSON.stringify({ page, page_size: pageSize }) });
                const data = await supersetFetch('GET', `/chart?${params.toString()}`);
                return { output: { charts: data.result ?? data, count: data.count } };
            }

            case 'getChart': {
                if (!inputs.chartId) return { error: 'Missing required input: chartId' };
                const data = await supersetFetch('GET', `/chart/${inputs.chartId}`);
                return { output: { chart: data.result ?? data } };
            }

            case 'createChart': {
                if (!inputs.sliceName) return { error: 'Missing required input: sliceName' };
                if (!inputs.vizType) return { error: 'Missing required input: vizType' };
                if (!inputs.datasourceId) return { error: 'Missing required input: datasourceId' };
                if (!inputs.datasourceType) return { error: 'Missing required input: datasourceType' };
                const body: any = {
                    slice_name: inputs.sliceName,
                    viz_type: inputs.vizType,
                    datasource_id: inputs.datasourceId,
                    datasource_type: inputs.datasourceType,
                };
                if (inputs.params) body.params = inputs.params;
                if (inputs.description) body.description = inputs.description;
                const data = await supersetFetch('POST', '/chart', body);
                return { output: { chart: data.result ?? data, id: data.id } };
            }

            case 'updateChart': {
                if (!inputs.chartId) return { error: 'Missing required input: chartId' };
                const body: any = {};
                if (inputs.sliceName) body.slice_name = inputs.sliceName;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.params !== undefined) body.params = inputs.params;
                const data = await supersetFetch('PUT', `/chart/${inputs.chartId}`, body);
                return { output: { chart: data.result ?? data } };
            }

            case 'listDatasets': {
                const page = inputs.page ?? 0;
                const pageSize = inputs.pageSize ?? 20;
                const params = new URLSearchParams({ q: JSON.stringify({ page, page_size: pageSize }) });
                const data = await supersetFetch('GET', `/dataset?${params.toString()}`);
                return { output: { datasets: data.result ?? data, count: data.count } };
            }

            case 'getDataset': {
                if (!inputs.datasetId) return { error: 'Missing required input: datasetId' };
                const data = await supersetFetch('GET', `/dataset/${inputs.datasetId}`);
                return { output: { dataset: data.result ?? data } };
            }

            case 'refreshDataset': {
                if (!inputs.datasetId) return { error: 'Missing required input: datasetId' };
                const data = await supersetFetch('PUT', `/dataset/${inputs.datasetId}/refresh`);
                return { output: { success: true, result: data } };
            }

            case 'listDatabases': {
                const page = inputs.page ?? 0;
                const pageSize = inputs.pageSize ?? 20;
                const params = new URLSearchParams({ q: JSON.stringify({ page, page_size: pageSize }) });
                const data = await supersetFetch('GET', `/database?${params.toString()}`);
                return { output: { databases: data.result ?? data, count: data.count } };
            }

            case 'getDatabase': {
                if (!inputs.databaseId) return { error: 'Missing required input: databaseId' };
                const data = await supersetFetch('GET', `/database/${inputs.databaseId}`);
                return { output: { database: data.result ?? data } };
            }

            case 'runQuery': {
                if (!inputs.databaseId) return { error: 'Missing required input: databaseId' };
                if (!inputs.sql) return { error: 'Missing required input: sql' };
                const body: any = {
                    database_id: inputs.databaseId,
                    sql: inputs.sql,
                    runAsync: inputs.runAsync ?? false,
                };
                if (inputs.schema) body.schema = inputs.schema;
                if (inputs.templateParams) body.templateParams = inputs.templateParams;
                const data = await supersetFetch('POST', '/sqllab/execute/', body);
                return { output: { result: data } };
            }

            case 'getChartData': {
                if (!inputs.chartId) return { error: 'Missing required input: chartId' };
                const body: any = {};
                if (inputs.queries) body.queries = inputs.queries;
                if (inputs.resultFormat) body.result_format = inputs.resultFormat;
                if (inputs.resultType) body.result_type = inputs.resultType;
                const data = await supersetFetch('POST', `/chart/${inputs.chartId}/data`, body);
                return { output: { result: data } };
            }

            default:
                return { error: `Unknown Apache Superset action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Apache Superset action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Apache Superset action' };
    }
}
