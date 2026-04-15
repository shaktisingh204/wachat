'use server';

const AIRTABLE_BASE = 'https://api.airtable.com/v0';
const AIRTABLE_META = 'https://api.airtable.com/v0/meta';

export async function executeAirtableEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'AirtableEnhanced: apiKey is required.' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        const request = async (method: string, url: string, body?: any) => {
            logger.log(`[AirtableEnhanced] ${method} ${url}`);
            const opts: RequestInit = { method, headers };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(url, opts);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    data?.error?.message ?? data?.message ?? `Airtable API error: ${res.status}`,
                );
            }
            return data;
        };

        const meta = (path: string) => request('GET', `${AIRTABLE_META}${path}`);
        const v0get = (path: string) => request('GET', `${AIRTABLE_BASE}${path}`);
        const v0post = (path: string, body: any) => request('POST', `${AIRTABLE_BASE}${path}`, body);
        const v0patch = (path: string, body: any) => request('PATCH', `${AIRTABLE_BASE}${path}`, body);
        const v0del = (path: string) => request('DELETE', `${AIRTABLE_BASE}${path}`);

        switch (actionName) {
            case 'listBases': {
                const data = await meta('/bases');
                return { output: { bases: data.bases ?? [], offset: data.offset ?? null } };
            }

            case 'getBase': {
                const { baseId } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced getBase: baseId is required.' };
                const data = await meta(`/bases/${baseId}`);
                return { output: { id: data.id, name: data.name, permissionLevel: data.permissionLevel } };
            }

            case 'listTables': {
                const { baseId } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced listTables: baseId is required.' };
                const data = await meta(`/bases/${baseId}/tables`);
                const tables = (data.tables ?? []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    primaryFieldId: t.primaryFieldId,
                    fields: (t.fields ?? []).map((f: any) => ({ id: f.id, name: f.name, type: f.type })),
                    views: (t.views ?? []).map((v: any) => ({ id: v.id, name: v.name, type: v.type })),
                }));
                return { output: { tables } };
            }

            case 'getTable': {
                const { baseId, tableId } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced getTable: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced getTable: tableId is required.' };
                const data = await meta(`/bases/${baseId}/tables/${tableId}`);
                return { output: { id: data.id, name: data.name, primaryFieldId: data.primaryFieldId, fields: data.fields ?? [], views: data.views ?? [] } };
            }

            case 'createTable': {
                const { baseId, name, description, fields } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced createTable: baseId is required.' };
                if (!name) return { error: 'AirtableEnhanced createTable: name is required.' };
                const payload: any = { name };
                if (description) payload.description = description;
                if (fields) payload.fields = typeof fields === 'string' ? JSON.parse(fields) : fields;
                const data = await request('POST', `${AIRTABLE_META}/bases/${baseId}/tables`, payload);
                return { output: { id: data.id, name: data.name } };
            }

            case 'updateTable': {
                const { baseId, tableId, name, description } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced updateTable: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced updateTable: tableId is required.' };
                const payload: any = {};
                if (name) payload.name = name;
                if (description !== undefined) payload.description = description;
                const data = await request('PATCH', `${AIRTABLE_META}/bases/${baseId}/tables/${tableId}`, payload);
                return { output: { id: data.id, name: data.name } };
            }

            case 'deleteTable': {
                const { baseId, tableId } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced deleteTable: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced deleteTable: tableId is required.' };
                const data = await request('DELETE', `${AIRTABLE_META}/bases/${baseId}/tables/${tableId}`);
                return { output: { deleted: data.deleted ?? true, id: tableId } };
            }

            case 'listRecords': {
                const { baseId, tableId, filterByFormula, maxRecords, sort, view, pageSize, offset } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced listRecords: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced listRecords: tableId is required.' };
                const params = new URLSearchParams();
                if (filterByFormula) params.set('filterByFormula', filterByFormula);
                if (maxRecords) params.set('maxRecords', String(maxRecords));
                if (view) params.set('view', view);
                if (pageSize) params.set('pageSize', String(pageSize));
                if (offset) params.set('offset', offset);
                if (sort) {
                    const sortArr = typeof sort === 'string' ? JSON.parse(sort) : sort;
                    if (Array.isArray(sortArr)) {
                        sortArr.forEach((s: any, i: number) => {
                            if (s.field) params.set(`sort[${i}][field]`, s.field);
                            if (s.direction) params.set(`sort[${i}][direction]`, s.direction);
                        });
                    }
                }
                const qs = params.toString();
                const data = await v0get(`/${baseId}/${tableId}${qs ? '?' + qs : ''}`);
                return { output: { records: data.records ?? [], offset: data.offset ?? null, count: (data.records ?? []).length } };
            }

            case 'getRecord': {
                const { baseId, tableId, recordId } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced getRecord: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced getRecord: tableId is required.' };
                if (!recordId) return { error: 'AirtableEnhanced getRecord: recordId is required.' };
                const data = await v0get(`/${baseId}/${tableId}/${recordId}`);
                return { output: { id: data.id, fields: data.fields ?? {}, createdTime: data.createdTime ?? '' } };
            }

            case 'createRecord': {
                const { baseId, tableId, fields, typecast } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced createRecord: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced createRecord: tableId is required.' };
                if (!fields) return { error: 'AirtableEnhanced createRecord: fields is required.' };
                const fieldsObj = typeof fields === 'string' ? JSON.parse(fields) : fields;
                const payload: any = { fields: fieldsObj };
                if (typecast !== undefined) payload.typecast = typecast;
                const data = await v0post(`/${baseId}/${tableId}`, payload);
                return { output: { id: data.id, fields: data.fields ?? {}, createdTime: data.createdTime ?? '' } };
            }

            case 'createRecords': {
                const { baseId, tableId, records, typecast } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced createRecords: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced createRecords: tableId is required.' };
                if (!records) return { error: 'AirtableEnhanced createRecords: records is required.' };
                const recordsArr = typeof records === 'string' ? JSON.parse(records) : records;
                const payload: any = {
                    records: recordsArr.map((r: any) => ({ fields: r.fields ?? r })),
                };
                if (typecast !== undefined) payload.typecast = typecast;
                const data = await v0post(`/${baseId}/${tableId}`, payload);
                return { output: { records: data.records ?? [], count: (data.records ?? []).length } };
            }

            case 'updateRecord': {
                const { baseId, tableId, recordId, fields, typecast } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced updateRecord: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced updateRecord: tableId is required.' };
                if (!recordId) return { error: 'AirtableEnhanced updateRecord: recordId is required.' };
                if (!fields) return { error: 'AirtableEnhanced updateRecord: fields is required.' };
                const fieldsObj = typeof fields === 'string' ? JSON.parse(fields) : fields;
                const payload: any = { fields: fieldsObj };
                if (typecast !== undefined) payload.typecast = typecast;
                const data = await v0patch(`/${baseId}/${tableId}/${recordId}`, payload);
                return { output: { id: data.id, fields: data.fields ?? {}, createdTime: data.createdTime ?? '' } };
            }

            case 'updateRecords': {
                const { baseId, tableId, records, typecast } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced updateRecords: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced updateRecords: tableId is required.' };
                if (!records) return { error: 'AirtableEnhanced updateRecords: records is required.' };
                const recordsArr = typeof records === 'string' ? JSON.parse(records) : records;
                const payload: any = {
                    records: recordsArr.map((r: any) => ({ id: r.id, fields: r.fields ?? {} })),
                };
                if (typecast !== undefined) payload.typecast = typecast;
                const data = await v0patch(`/${baseId}/${tableId}`, payload);
                return { output: { records: data.records ?? [], count: (data.records ?? []).length } };
            }

            case 'deleteRecord': {
                const { baseId, tableId, recordId } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced deleteRecord: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced deleteRecord: tableId is required.' };
                if (!recordId) return { error: 'AirtableEnhanced deleteRecord: recordId is required.' };
                const data = await v0del(`/${baseId}/${tableId}/${recordId}`);
                return { output: { deleted: data.deleted ?? true, id: data.id ?? recordId } };
            }

            case 'searchRecords': {
                const { baseId, tableId, filterByFormula, searchField, searchValue, maxRecords } = inputs;
                if (!baseId) return { error: 'AirtableEnhanced searchRecords: baseId is required.' };
                if (!tableId) return { error: 'AirtableEnhanced searchRecords: tableId is required.' };
                const params = new URLSearchParams();
                let formula = filterByFormula ?? '';
                if (!formula && searchField && searchValue !== undefined) {
                    formula = `SEARCH("${String(searchValue).replace(/"/g, '\\"')}", {${searchField}})`;
                }
                if (formula) params.set('filterByFormula', formula);
                params.set('maxRecords', String(maxRecords ?? 100));
                const data = await v0get(`/${baseId}/${tableId}?${params.toString()}`);
                return { output: { records: data.records ?? [], count: (data.records ?? []).length } };
            }

            default:
                logger.log(`AirtableEnhanced: unknown action "${actionName}"`);
                return { error: `AirtableEnhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`AirtableEnhanced action "${actionName}" error: ${err.message}`);
        return { error: err.message ?? 'AirtableEnhanced: unknown error' };
    }
}
