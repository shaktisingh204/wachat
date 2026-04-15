
'use server';

const BASEROW_DEFAULT = 'https://api.baserow.io/api';

async function baserowFetch(
    token: string,
    method: string,
    url: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Baserow] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return { deleted: true };
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { detail: text }; }
    if (!res.ok) {
        throw new Error(data?.detail || data?.error || data?.message || `Baserow API error: ${res.status}`);
    }
    return data;
}

export async function executeBaserowAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');

        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '') || BASEROW_DEFAULT;
        const base = serverUrl.endsWith('/api') ? serverUrl : `${serverUrl}/api`;

        const br = (method: string, path: string, body?: any) =>
            baserowFetch(apiToken, method, `${base}${path}`, body, logger);

        switch (actionName) {
            case 'listTables': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                if (!databaseId) throw new Error('databaseId is required.');
                const data = await br('GET', `/database/tables/database/${databaseId}/`);
                const tables = Array.isArray(data) ? data : (data.tables ?? []);
                return { output: { tables, count: String(tables.length) } };
            }

            case 'getTable': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const data = await br('GET', `/database/tables/${tableId}/`);
                return { output: { id: String(data.id ?? ''), name: data.name ?? '', order: String(data.order ?? 0) } };
            }

            case 'listFields': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const data = await br('GET', `/database/fields/table/${tableId}/`);
                const fields = Array.isArray(data) ? data : (data.fields ?? []);
                return { output: { fields, count: String(fields.length) } };
            }

            case 'listRows': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                const page = Number(inputs.page ?? 1);
                const size = Number(inputs.size ?? 20);
                const orderBy = String(inputs.orderBy ?? '').trim();
                let path = `/database/rows/table/${tableId}/?user_field_names=true&page=${page}&size=${size}`;
                if (orderBy) path += `&order_by=${encodeURIComponent(orderBy)}`;
                if (inputs.filters) {
                    const filters = typeof inputs.filters === 'string'
                        ? JSON.parse(inputs.filters)
                        : inputs.filters;
                    Object.entries(filters).forEach(([k, v]) => {
                        path += `&filter__${encodeURIComponent(k)}__contains=${encodeURIComponent(String(v))}`;
                    });
                }
                const data = await br('GET', path);
                return { output: { count: String(data.count ?? 0), results: data.results ?? [] } };
            }

            case 'getRow': {
                const tableId = String(inputs.tableId ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!rowId) throw new Error('rowId is required.');
                const data = await br('GET', `/database/rows/table/${tableId}/${rowId}/?user_field_names=true`);
                return { output: data };
            }

            case 'createRow': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!inputs.fields) throw new Error('fields is required.');
                const fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const data = await br('POST', `/database/rows/table/${tableId}/?user_field_names=true`, fields);
                return { output: data };
            }

            case 'updateRow': {
                const tableId = String(inputs.tableId ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!rowId) throw new Error('rowId is required.');
                if (!inputs.fields) throw new Error('fields is required.');
                const fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const data = await br('PATCH', `/database/rows/table/${tableId}/${rowId}/?user_field_names=true`, fields);
                return { output: data };
            }

            case 'deleteRow': {
                const tableId = String(inputs.tableId ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!rowId) throw new Error('rowId is required.');
                await br('DELETE', `/database/rows/table/${tableId}/${rowId}/`);
                return { output: { deleted: 'true', rowId } };
            }

            case 'bulkCreate': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!inputs.rows) throw new Error('rows is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : JSON.parse(String(inputs.rows));
                const data = await br('POST', `/database/rows/table/${tableId}/batch/?user_field_names=true`, { items: rows });
                return { output: { items: data.items ?? [], count: String((data.items ?? []).length) } };
            }

            case 'bulkUpdate': {
                const tableId = String(inputs.tableId ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!inputs.rows) throw new Error('rows is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : JSON.parse(String(inputs.rows));
                const data = await br('PATCH', `/database/rows/table/${tableId}/batch/?user_field_names=true`, { items: rows });
                return { output: { items: data.items ?? [], count: String((data.items ?? []).length) } };
            }

            case 'filterRows': {
                const tableId = String(inputs.tableId ?? '').trim();
                const field = String(inputs.field ?? '').trim();
                const value = String(inputs.value ?? '').trim();
                if (!tableId) throw new Error('tableId is required.');
                if (!field) throw new Error('field is required.');
                if (!value) throw new Error('value is required.');
                const filterType = String(inputs.filterType ?? 'contains').trim();
                const path = `/database/rows/table/${tableId}/?user_field_names=true&filter__${encodeURIComponent(field)}__${filterType}=${encodeURIComponent(value)}`;
                const data = await br('GET', path);
                return { output: { results: data.results ?? [], count: String(data.count ?? 0) } };
            }

            default:
                return { error: `Baserow action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Baserow action failed.' };
    }
}
