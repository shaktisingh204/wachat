
'use server';

async function nocoFetch(
    authHeader: Record<string, string>,
    method: string,
    url: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[NocoDB] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...authHeader,
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { msg: text }; }
    if (!res.ok) {
        throw new Error(data?.msg || data?.message || `NocoDB API error: ${res.status}`);
    }
    return data;
}

export async function executeNocodbAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required.');

        const apiToken = String(inputs.apiToken ?? '').trim();
        const authToken = String(inputs.authToken ?? '').trim();
        if (!apiToken && !authToken) throw new Error('apiToken or authToken is required.');

        const authHeader: Record<string, string> = apiToken
            ? { 'xc-token': apiToken }
            : { 'xc-auth': authToken };

        const base = `${serverUrl}/api/v1`;
        const baseId = String(inputs.baseId ?? '').trim();

        const noco = (method: string, path: string, body?: any) =>
            nocoFetch(authHeader, method, `${base}${path}`, body, logger);

        switch (actionName) {
            case 'listTables': {
                if (!baseId) throw new Error('baseId is required.');
                const data = await noco('GET', `/db/meta/projects/${baseId}/tables`);
                const list = data.list ?? [];
                return { output: { list: list.map((t: any) => ({ id: t.id ?? '', title: t.title ?? '' })), count: String(list.length) } };
            }

            case 'getTable': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const data = await noco('GET', `/db/meta/tables/${tableId}`);
                return { output: { id: data.id ?? '', title: data.title ?? '', columns: data.columns ?? [] } };
            }

            case 'listRecords': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!baseId) throw new Error('baseId is required.');
                const where = String(inputs.where ?? '').trim();
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const sort = String(inputs.sort ?? '').trim();
                let path = `/db/data/noco/${baseId}/${tableId}?limit=${limit}&offset=${offset}`;
                if (where) path += `&where=${encodeURIComponent(where)}`;
                if (sort) path += `&sort=${encodeURIComponent(sort)}`;
                const data = await noco('GET', path);
                return { output: { list: data.list ?? [], pageInfo: data.pageInfo ?? {} } };
            }

            case 'getRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!rowId) throw new Error('rowId is required.');
                if (!baseId) throw new Error('baseId is required.');
                const data = await noco('GET', `/db/data/noco/${baseId}/${tableId}/${rowId}`);
                return { output: data };
            }

            case 'createRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!baseId) throw new Error('baseId is required.');
                if (!inputs.data) throw new Error('data is required.');
                const recordData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await noco('POST', `/db/data/noco/${baseId}/${tableId}`, recordData);
                return { output: data };
            }

            case 'updateRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!rowId) throw new Error('rowId is required.');
                if (!baseId) throw new Error('baseId is required.');
                if (!inputs.data) throw new Error('data is required.');
                const recordData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await noco('PATCH', `/db/data/noco/${baseId}/${tableId}/${rowId}`, recordData);
                return { output: data };
            }

            case 'deleteRecord': {
                const tableId = String(inputs.tableId ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!rowId) throw new Error('rowId is required.');
                if (!baseId) throw new Error('baseId is required.');
                const data = await noco('DELETE', `/db/data/noco/${baseId}/${tableId}/${rowId}`);
                return { output: { msg: data.msg ?? 'The record has been deleted', rowId } };
            }

            case 'bulkInsert': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!baseId) throw new Error('baseId is required.');
                if (!inputs.rows) throw new Error('rows is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : JSON.parse(String(inputs.rows));
                const data = await noco('POST', `/db/data/bulk/noco/${baseId}/${tableId}`, rows);
                const insertedRows = Array.isArray(data) ? data : (data.insertedRows ?? []);
                return { output: { insertedRows, count: String(insertedRows.length) } };
            }

            case 'searchRecords': {
                const tableId = String(inputs.tableId ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!query) throw new Error('query is required.');
                if (!baseId) throw new Error('baseId is required.');
                const searchField = String(inputs.searchField ?? 'title').trim();
                const where = `(${searchField},like,%${query}%)`;
                const path = `/db/data/noco/${baseId}/${tableId}?where=${encodeURIComponent(where)}&limit=25`;
                const data = await noco('GET', path);
                return { output: { list: data.list ?? [], pageInfo: data.pageInfo ?? {} } };
            }

            case 'listViews': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const data = await noco('GET', `/db/meta/tables/${tableId}/views`);
                const list = data.list ?? [];
                return { output: { list, count: String(list.length) } };
            }

            case 'countRecords': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!baseId) throw new Error('baseId is required.');
                const data = await noco('GET', `/db/data/noco/${baseId}/${tableId}/count`);
                return { output: { count: String(data.count ?? 0) } };
            }

            default:
                return { error: `NocoDB action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'NocoDB action failed.' };
    }
}
