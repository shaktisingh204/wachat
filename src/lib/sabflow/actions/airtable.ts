
'use server';

const AIRTABLE_BASE = 'https://api.airtable.com/v0';

async function airtableFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Airtable] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${AIRTABLE_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `Airtable API error: ${res.status}`);
    }
    return data;
}

export async function executeAirtableAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');
        const at = (method: string, path: string, body?: any) => airtableFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listRecords': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const filterFormula = String(inputs.filterFormula ?? '').trim();
                const maxRecords = Number(inputs.maxRecords ?? 100);
                const sortField = String(inputs.sortField ?? '').trim();
                const sortDirection = String(inputs.sortDirection ?? 'asc').trim();
                if (!baseId || !tableId) throw new Error('baseId and tableId are required.');
                let path = `/${baseId}/${tableId}?maxRecords=${maxRecords}`;
                if (filterFormula) path += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
                if (sortField) path += `&sort[0][field]=${encodeURIComponent(sortField)}&sort[0][direction]=${sortDirection}`;
                const data = await at('GET', path);
                return { output: { records: data.records ?? [], count: (data.records ?? []).length, offset: data.offset ?? '' } };
            }

            case 'getRecord': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!baseId || !tableId || !recordId) throw new Error('baseId, tableId, and recordId are required.');
                const data = await at('GET', `/${baseId}/${tableId}/${recordId}`);
                return { output: { id: data.id, fields: data.fields ?? {}, createdTime: data.createdTime ?? '' } };
            }

            case 'createRecord': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const fields = inputs.fields;
                if (!baseId || !tableId || !fields) throw new Error('baseId, tableId, and fields are required.');
                const fieldsObj = typeof fields === 'string' ? JSON.parse(fields) : fields;
                const data = await at('POST', `/${baseId}/${tableId}`, { records: [{ fields: fieldsObj }] });
                const record = data.records?.[0];
                return { output: { id: record?.id ?? '', fields: record?.fields ?? {} } };
            }

            case 'updateRecord': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                const fields = inputs.fields;
                if (!baseId || !tableId || !recordId || !fields) throw new Error('baseId, tableId, recordId, and fields are required.');
                const fieldsObj = typeof fields === 'string' ? JSON.parse(fields) : fields;
                const data = await at('PATCH', `/${baseId}/${tableId}/${recordId}`, { fields: fieldsObj });
                return { output: { id: data.id, fields: data.fields ?? {} } };
            }

            case 'deleteRecord': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                if (!baseId || !tableId || !recordId) throw new Error('baseId, tableId, and recordId are required.');
                const data = await at('DELETE', `/${baseId}/${tableId}/${recordId}`);
                return { output: { deleted: String(data.deleted ?? true), id: data.id ?? recordId } };
            }

            case 'createMultipleRecords': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const records = inputs.records;
                if (!baseId || !tableId || !records) throw new Error('baseId, tableId, and records are required.');
                const recordsArr = Array.isArray(records) ? records : JSON.parse(String(records));
                const data = await at('POST', `/${baseId}/${tableId}`, { records: recordsArr.map((r: any) => ({ fields: r })) });
                return { output: { records: data.records ?? [], count: String((data.records ?? []).length) } };
            }

            case 'updateMultipleRecords': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const records = inputs.records;
                if (!baseId || !tableId || !records) throw new Error('baseId, tableId, and records are required.');
                const recordsArr = Array.isArray(records) ? records : JSON.parse(String(records));
                const data = await at('PATCH', `/${baseId}/${tableId}`, { records: recordsArr });
                return { output: { records: data.records ?? [], count: String((data.records ?? []).length) } };
            }

            case 'searchRecords': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const field = String(inputs.field ?? '').trim();
                const value = String(inputs.value ?? '').trim();
                if (!baseId || !tableId || !field || !value) throw new Error('baseId, tableId, field, and value are required.');
                const formula = `{${field}}="${value}"`;
                const data = await at('GET', `/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=100`);
                return { output: { records: data.records ?? [], count: (data.records ?? []).length } };
            }

            case 'listBases': {
                const res = await fetch('https://api.airtable.com/v0/meta/bases', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                return { output: { bases: data.bases ?? [], count: (data.bases ?? []).length } };
            }

            case 'listTables': {
                const baseId = String(inputs.baseId ?? '').trim();
                if (!baseId) throw new Error('baseId is required.');
                const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                return { output: { tables: data.tables ?? [], count: (data.tables ?? []).length } };
            }

            case 'uploadAttachment': {
                const baseId = String(inputs.baseId ?? '').trim();
                const tableId = String(inputs.tableId ?? '').trim();
                const recordId = String(inputs.recordId ?? '').trim();
                const field = String(inputs.field ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const fileName = String(inputs.fileName ?? 'file').trim();
                if (!baseId || !tableId || !recordId || !field || !fileUrl) throw new Error('baseId, tableId, recordId, field, and fileUrl are required.');
                const data = await at('PATCH', `/${baseId}/${tableId}/${recordId}`, { fields: { [field]: [{ url: fileUrl, filename: fileName }] } });
                return { output: { id: data.id, field: field } };
            }

            default:
                return { error: `Airtable action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Airtable action failed.' };
    }
}
