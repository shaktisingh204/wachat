'use server';

export async function executeTableauAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output: any } | { error: string }> {
    try {
        logger.log(`Executing Tableau action: ${actionName}`);

        if (!inputs.serverUrl) return { error: 'Missing required input: serverUrl' };
        const apiVersion = inputs.apiVersion ?? '3.21';
        const serverUrl = (inputs.serverUrl as string).replace(/\/$/, '');
        const baseUrl = `https://${serverUrl}/api/${apiVersion}`;

        async function signIn(): Promise<{ token: string; siteId: string; userId: string }> {
            if (inputs.authToken && inputs.siteId) {
                return { token: inputs.authToken, siteId: inputs.siteId, userId: inputs.userId ?? '' };
            }
            if (!inputs.username && !inputs.patName) return Promise.reject(new Error('Missing required input: username or patName'));
            const credentials: any = inputs.patName
                ? { personalAccessTokenName: inputs.patName, personalAccessTokenSecret: inputs.patSecret, site: { contentUrl: inputs.siteContentUrl ?? '' } }
                : { name: inputs.username, password: inputs.password, site: { contentUrl: inputs.siteContentUrl ?? '' } };

            const res = await fetch(`${baseUrl}/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ credentials }),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.summary ?? `Tableau sign-in error ${res.status}: ${text}`);
            return {
                token: data.credentials.token,
                siteId: data.credentials.site.id,
                userId: data.credentials.user.id,
            };
        }

        const { token, siteId } = await signIn();

        async function tableauFetch(method: string, path: string, body?: any): Promise<any> {
            const url = `${baseUrl}${path}`;
            const res = await fetch(url, {
                method,
                headers: {
                    'X-Tableau-Auth': token,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(data?.error?.summary ?? data?.message ?? `Tableau API error ${res.status}: ${text}`);
            }
            return data;
        }

        switch (actionName) {

            case 'listSites': {
                const params = new URLSearchParams();
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await tableauFetch('GET', `/sites${query}`);
                return { output: { sites: data.sites?.site ?? [], pagination: data.pagination } };
            }

            case 'getSite': {
                const id = inputs.siteId ?? siteId;
                const data = await tableauFetch('GET', `/sites/${id}`);
                return { output: { site: data.site ?? data } };
            }

            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.filter) params.set('filter', inputs.filter);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await tableauFetch('GET', `/sites/${siteId}/projects${query}`);
                return { output: { projects: data.projects?.project ?? [], pagination: data.pagination } };
            }

            case 'getProject': {
                if (!inputs.projectId) return { error: 'Missing required input: projectId' };
                const data = await tableauFetch('GET', `/sites/${siteId}/projects/${inputs.projectId}`);
                return { output: { project: data.project ?? data } };
            }

            case 'createProject': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                const body: any = {
                    project: {
                        name: inputs.name,
                        description: inputs.description ?? '',
                        contentPermissions: inputs.contentPermissions ?? 'ManagedByOwner',
                    },
                };
                if (inputs.parentProjectId) body.project.parentProjectId = inputs.parentProjectId;
                const data = await tableauFetch('POST', `/sites/${siteId}/projects`, body);
                return { output: { project: data.project ?? data } };
            }

            case 'listViews': {
                const params = new URLSearchParams();
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.includeUsageStatistics) params.set('includeUsageStatistics', String(inputs.includeUsageStatistics));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await tableauFetch('GET', `/sites/${siteId}/views${query}`);
                return { output: { views: data.views?.view ?? [], pagination: data.pagination } };
            }

            case 'getView': {
                if (!inputs.viewId) return { error: 'Missing required input: viewId' };
                const data = await tableauFetch('GET', `/sites/${siteId}/views/${inputs.viewId}`);
                return { output: { view: data.view ?? data } };
            }

            case 'listDashboards': {
                // Dashboards in Tableau are views of type 'dashboard'
                const params = new URLSearchParams({ filter: 'type:eq:dashboard' });
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const data = await tableauFetch('GET', `/sites/${siteId}/views?${params.toString()}`);
                return { output: { dashboards: data.views?.view ?? [], pagination: data.pagination } };
            }

            case 'getDashboard': {
                if (!inputs.viewId) return { error: 'Missing required input: viewId' };
                const data = await tableauFetch('GET', `/sites/${siteId}/views/${inputs.viewId}`);
                return { output: { dashboard: data.view ?? data } };
            }

            case 'listWorkbooks': {
                const params = new URLSearchParams();
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.filter) params.set('filter', inputs.filter);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await tableauFetch('GET', `/sites/${siteId}/workbooks${query}`);
                return { output: { workbooks: data.workbooks?.workbook ?? [], pagination: data.pagination } };
            }

            case 'getWorkbook': {
                if (!inputs.workbookId) return { error: 'Missing required input: workbookId' };
                const data = await tableauFetch('GET', `/sites/${siteId}/workbooks/${inputs.workbookId}`);
                return { output: { workbook: data.workbook ?? data } };
            }

            case 'listDatasources': {
                const params = new URLSearchParams();
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.filter) params.set('filter', inputs.filter);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await tableauFetch('GET', `/sites/${siteId}/datasources${query}`);
                return { output: { datasources: data.datasources?.datasource ?? [], pagination: data.pagination } };
            }

            case 'getDatasource': {
                if (!inputs.datasourceId) return { error: 'Missing required input: datasourceId' };
                const data = await tableauFetch('GET', `/sites/${siteId}/datasources/${inputs.datasourceId}`);
                return { output: { datasource: data.datasource ?? data } };
            }

            case 'queryView': {
                if (!inputs.viewId) return { error: 'Missing required input: viewId' };
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await tableauFetch('GET', `/sites/${siteId}/views/${inputs.viewId}${query}`);
                return { output: { view: data.view ?? data } };
            }

            case 'getViewData': {
                if (!inputs.viewId) return { error: 'Missing required input: viewId' };
                const params = new URLSearchParams();
                if (inputs.maxAge !== undefined) params.set('maxAge', String(inputs.maxAge));
                if (inputs.vf) params.set('vf', inputs.vf);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/sites/${siteId}/views/${inputs.viewId}/data${query}`, {
                    method: 'GET',
                    headers: { 'X-Tableau-Auth': token, 'Accept': 'text/csv,application/json' },
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Tableau getViewData error ${res.status}: ${text}`);
                }
                const contentType = res.headers.get('content-type') ?? '';
                if (contentType.includes('csv')) {
                    const text = await res.text();
                    const base64 = Buffer.from(text).toString('base64');
                    return { output: { csvBase64: base64, contentType } };
                }
                const data = await res.json();
                return { output: { data, contentType } };
            }

            default:
                return { error: `Unknown Tableau action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Tableau action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Tableau action' };
    }
}
