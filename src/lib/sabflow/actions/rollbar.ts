
'use server';

export async function executeRollbarAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const base = 'https://api.rollbar.com/api/1';

        async function rollbarFetch(method: string, url: string, body?: any) {
            logger?.log(`[Rollbar] ${method} ${url}`);
            const headers: Record<string, string> = {
                'X-Rollbar-Access-Token': accessToken,
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
                const msg = data?.message || data?.error || `Rollbar API error: ${res.status}`;
                throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
            return data;
        }

        switch (actionName) {
            case 'listItems': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.level) params.set('level', String(inputs.level));
                if (inputs.environment) params.set('environment', String(inputs.environment));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await rollbarFetch('GET', `${base}/items/${qs}`);
                return { output: { items: data?.result?.items ?? [], page: data?.result?.page } };
            }

            case 'getItem': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await rollbarFetch('GET', `${base}/items/${id}`);
                return { output: { item: data?.result ?? {} } };
            }

            case 'updateItem': {
                const id = String(inputs.id ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!status) throw new Error('status is required.');
                const data = await rollbarFetch('PATCH', `${base}/items/${id}`, { status });
                return { output: { item: data?.result ?? {} } };
            }

            case 'resolveItem': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await rollbarFetch('PATCH', `${base}/items/${id}`, { status: 'resolved' });
                return { output: { item: data?.result ?? {} } };
            }

            case 'mergeItems': {
                const id = String(inputs.id ?? '').trim();
                const itemIds = inputs.itemIds;
                if (!id) throw new Error('id is required.');
                if (!itemIds) throw new Error('itemIds is required.');
                const data = await rollbarFetch('POST', `${base}/items/${id}/merge`, { item_ids: Array.isArray(itemIds) ? itemIds : [itemIds] });
                return { output: { result: data?.result ?? {} } };
            }

            case 'listOccurrences': {
                const params = new URLSearchParams();
                if (inputs.itemId) params.set('item_id', String(inputs.itemId));
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await rollbarFetch('GET', `${base}/instances/${qs}`);
                return { output: { occurrences: data?.result?.instances ?? [] } };
            }

            case 'getOccurrence': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await rollbarFetch('GET', `${base}/instances/${id}`);
                return { output: { occurrence: data?.result ?? {} } };
            }

            case 'deleteOccurrence': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await rollbarFetch('DELETE', `${base}/instances/${id}`);
                return { output: { message: data?.message ?? 'Deleted successfully' } };
            }

            case 'getRQL': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const body: any = { query_string: query };
                if (inputs.format) body.format = String(inputs.format);
                const data = await rollbarFetch('POST', `${base}/rql/jobs/`, body);
                return { output: { job: data?.result ?? {} } };
            }

            case 'getRQLResult': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await rollbarFetch('GET', `${base}/rql/jobs/${jobId}/result/`);
                return { output: { result: data?.result ?? {} } };
            }

            case 'sendLog': {
                const environment = String(inputs.environment ?? 'production').trim();
                const level = String(inputs.level ?? 'info').trim();
                const message = String(inputs.message ?? '').trim();
                if (!message) throw new Error('message is required.');
                const data = await rollbarFetch('POST', 'https://api.rollbar.com/api/1/item/', {
                    access_token: accessToken,
                    data: {
                        environment,
                        level,
                        body: { message: { body: message } },
                    },
                });
                return { output: { uuid: data?.result?.uuid, id: data?.result?.id } };
            }

            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.buckets) params.set('buckets', String(inputs.buckets));
                if (inputs.environment) params.set('environments', String(inputs.environment));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await rollbarFetch('GET', `${base}/reports/occurrence_counts${qs}`);
                return { output: { counts: data?.result ?? {} } };
            }

            case 'listProjects': {
                const data = await rollbarFetch('GET', `${base}/projects`);
                return { output: { projects: data?.result ?? [] } };
            }

            case 'getProject': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await rollbarFetch('GET', `${base}/project/${id}`);
                return { output: { project: data?.result ?? {} } };
            }

            case 'listDeploys': {
                const params = new URLSearchParams();
                if (inputs.environment) params.set('environment', String(inputs.environment));
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await rollbarFetch('GET', `${base}/deploys/${qs}`);
                return { output: { deploys: data?.result?.deploys ?? [] } };
            }

            default:
                return { error: `Rollbar action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Rollbar action failed.' };
    }
}
