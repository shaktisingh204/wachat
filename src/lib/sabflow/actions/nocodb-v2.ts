
'use server';

async function nocodbFetch(baseUrl: string, apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[NocoDB v2] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'xc-token': apiToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const cleanBase = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanBase}/api/v2${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `NocoDB API error: ${res.status}`);
    }
    return data;
}

export async function executeNocodbV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!baseUrl) throw new Error('baseUrl is required.');
        if (!apiToken) throw new Error('apiToken is required.');
        const nc = (method: string, path: string, body?: any) => nocodbFetch(baseUrl, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'listRecords': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const params = new URLSearchParams();
                if (inputs.where) params.set('where', String(inputs.where));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.sort) params.set('sort', String(inputs.sort));
                if (inputs.fields) params.set('fields', String(inputs.fields));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await nc('GET', `/tables/${tableId}/records${qs}`);
                return { output: { count: String(data.pageInfo?.totalRows ?? data.list?.length ?? 0), records: JSON.stringify(data.list ?? data) } };
            }

            case 'getRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!recordId) throw new Error('recordId is required.');
                const data = await nc('GET', `/tables/${tableId}/records/${recordId}`);
                return { output: { record: JSON.stringify(data) } };
            }

            case 'createRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const fields = inputs.fields
                    ? (typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields)
                    : {};
                const data = await nc('POST', `/tables/${tableId}/records`, fields);
                return { output: { id: String(data.Id ?? data.id ?? ''), record: JSON.stringify(data) } };
            }

            case 'updateRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!recordId) throw new Error('recordId is required.');
                const fields = inputs.fields
                    ? (typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields)
                    : {};
                const payload = { Id: recordId, ...fields };
                const data = await nc('PATCH', `/tables/${tableId}/records`, payload);
                return { output: { success: 'true', record: JSON.stringify(data) } };
            }

            case 'deleteRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!recordId) throw new Error('recordId is required.');
                await nc('DELETE', `/tables/${tableId}/records`, { Id: recordId });
                return { output: { success: 'true', recordId } };
            }

            case 'searchRecords': {
                const tableId = String(inputs.tableId ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const params = new URLSearchParams();
                if (query) params.set('where', query);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await nc('GET', `/tables/${tableId}/records${qs}`);
                return { output: { count: String(data.pageInfo?.totalRows ?? data.list?.length ?? 0), records: JSON.stringify(data.list ?? data) } };
            }

            default:
                return { error: `NocoDB v2 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'NocoDB v2 action failed.' };
    }
}
