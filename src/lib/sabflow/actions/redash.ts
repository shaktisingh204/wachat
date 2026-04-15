'use server';

export async function executeRedashAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output: any } | { error: string }> {
    try {
        logger.log(`Executing Redash action: ${actionName}`);

        const baseUrl = (inputs.redashUrl as string)?.replace(/\/$/, '');
        if (!baseUrl) return { error: 'Missing required input: redashUrl' };
        if (!inputs.apiKey) return { error: 'Missing required input: apiKey' };

        const headers: Record<string, string> = {
            'Authorization': `Key ${inputs.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        async function redashFetch(method: string, path: string, body?: any): Promise<any> {
            const url = `${baseUrl}/api${path}`;
            const res = await fetch(url, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(data?.message ?? data?.error ?? `Redash API error ${res.status}: ${text}`);
            }
            return data;
        }

        switch (actionName) {

            case 'listDashboards': {
                const data = await redashFetch('GET', '/dashboards');
                return { output: { dashboards: data.results ?? data } };
            }

            case 'getDashboard': {
                if (!inputs.dashboardSlug && !inputs.dashboardId) return { error: 'Missing required input: dashboardSlug or dashboardId' };
                const identifier = inputs.dashboardSlug ?? inputs.dashboardId;
                const data = await redashFetch('GET', `/dashboards/${identifier}`);
                return { output: { dashboard: data } };
            }

            case 'createDashboard': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                const body: any = { name: inputs.name };
                if (inputs.tags) body.tags = inputs.tags;
                const data = await redashFetch('POST', '/dashboards', body);
                return { output: { dashboard: data } };
            }

            case 'updateDashboard': {
                if (!inputs.dashboardId) return { error: 'Missing required input: dashboardId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.tags !== undefined) body.tags = inputs.tags;
                if (inputs.isArchived !== undefined) body.is_archived = inputs.isArchived;
                const data = await redashFetch('POST', `/dashboards/${inputs.dashboardId}`, body);
                return { output: { dashboard: data } };
            }

            case 'listQueries': {
                const page = inputs.page ?? 1;
                const pageSize = inputs.pageSize ?? 25;
                const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
                if (inputs.search) params.set('q', inputs.search);
                const data = await redashFetch('GET', `/queries?${params.toString()}`);
                return { output: { queries: data.results ?? data, count: data.count } };
            }

            case 'getQuery': {
                if (!inputs.queryId) return { error: 'Missing required input: queryId' };
                const data = await redashFetch('GET', `/queries/${inputs.queryId}`);
                return { output: { query: data } };
            }

            case 'createQuery': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                if (!inputs.dataSourceId) return { error: 'Missing required input: dataSourceId' };
                if (!inputs.query) return { error: 'Missing required input: query' };
                const body: any = {
                    name: inputs.name,
                    data_source_id: inputs.dataSourceId,
                    query: inputs.query,
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.schedule) body.schedule = inputs.schedule;
                if (inputs.options) body.options = inputs.options;
                const data = await redashFetch('POST', '/queries', body);
                return { output: { query: data } };
            }

            case 'updateQuery': {
                if (!inputs.queryId) return { error: 'Missing required input: queryId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.query) body.query = inputs.query;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.schedule !== undefined) body.schedule = inputs.schedule;
                if (inputs.options !== undefined) body.options = inputs.options;
                if (inputs.isArchived !== undefined) body.is_archived = inputs.isArchived;
                const data = await redashFetch('POST', `/queries/${inputs.queryId}`, body);
                return { output: { query: data } };
            }

            case 'deleteQuery': {
                if (!inputs.queryId) return { error: 'Missing required input: queryId' };
                await redashFetch('DELETE', `/queries/${inputs.queryId}`);
                return { output: { success: true, queryId: inputs.queryId } };
            }

            case 'executeQuery': {
                if (!inputs.queryId) return { error: 'Missing required input: queryId' };
                const body: any = {};
                if (inputs.parameters) body.parameters = inputs.parameters;
                const data = await redashFetch('POST', `/queries/${inputs.queryId}/results`, body);
                return { output: { job: data.job ?? data, queryResult: data.query_result } };
            }

            case 'getQueryResults': {
                if (!inputs.queryId) return { error: 'Missing required input: queryId' };
                const params = new URLSearchParams();
                if (inputs.maxAge !== undefined) params.set('max_age', String(inputs.maxAge));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await redashFetch('GET', `/queries/${inputs.queryId}/results${query}`);
                return { output: { queryResult: data.query_result ?? data } };
            }

            case 'listDataSources': {
                const data = await redashFetch('GET', '/data_sources');
                return { output: { dataSources: Array.isArray(data) ? data : data.results ?? data } };
            }

            case 'getDataSource': {
                if (!inputs.dataSourceId) return { error: 'Missing required input: dataSourceId' };
                const data = await redashFetch('GET', `/data_sources/${inputs.dataSourceId}`);
                return { output: { dataSource: data } };
            }

            case 'createDataSource': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                if (!inputs.type) return { error: 'Missing required input: type' };
                const body: any = {
                    name: inputs.name,
                    type: inputs.type,
                    options: inputs.options ?? {},
                };
                if (inputs.scheduledQueriesExecutorId) body.scheduled_queue_name = inputs.scheduledQueriesExecutorId;
                const data = await redashFetch('POST', '/data_sources', body);
                return { output: { dataSource: data } };
            }

            case 'listVisualizationsForQuery': {
                if (!inputs.queryId) return { error: 'Missing required input: queryId' };
                const queryData = await redashFetch('GET', `/queries/${inputs.queryId}`);
                const visualizations = queryData.visualizations ?? [];
                return { output: { visualizations, count: visualizations.length } };
            }

            default:
                return { error: `Unknown Redash action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Redash action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Redash action' };
    }
}
