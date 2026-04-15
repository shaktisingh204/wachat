'use server';

const STACKBY_BASE = 'https://stackby.com/api/betav1';

export async function executeStackbyAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { apiKey } = inputs;
        if (!apiKey) return { error: 'Stackby: apiKey is required.' };

        const headers: Record<string, string> = {
            'api_key': apiKey,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${STACKBY_BASE}${path}`, { method: 'GET', headers });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? body.message ?? JSON.stringify(body));
            return body;
        };

        const post = async (path: string, payload: Record<string, any>) => {
            const res = await fetch(`${STACKBY_BASE}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? body.message ?? JSON.stringify(body));
            return body;
        };

        const del = async (path: string) => {
            const res = await fetch(`${STACKBY_BASE}${path}`, { method: 'DELETE', headers });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? body.message ?? JSON.stringify(body));
            return body;
        };

        switch (actionName) {
            case 'listRecords': {
                const { stackId, tableId, rowCount, startFrom } = inputs;
                if (!stackId) return { error: 'Stackby listRecords: stackId is required.' };
                if (!tableId) return { error: 'Stackby listRecords: tableId is required.' };
                const data = await get(
                    `/rowlist/${stackId}/${tableId}?rowCount=${rowCount ?? 25}&startFrom=${startFrom ?? 0}`,
                );
                return { output: { records: data.records ?? [] } };
            }

            case 'getRecord': {
                const { stackId, tableId, recordId } = inputs;
                if (!stackId) return { error: 'Stackby getRecord: stackId is required.' };
                if (!tableId) return { error: 'Stackby getRecord: tableId is required.' };
                if (!recordId) return { error: 'Stackby getRecord: recordId is required.' };
                const data = await get(`/rowgets/${stackId}/${tableId}/${recordId}`);
                return { output: { id: data.id, createdTime: data.createdTime, fields: data.fields ?? {} } };
            }

            case 'createRecord': {
                const { stackId, tableId, fields } = inputs;
                if (!stackId) return { error: 'Stackby createRecord: stackId is required.' };
                if (!tableId) return { error: 'Stackby createRecord: tableId is required.' };
                if (!fields) return { error: 'Stackby createRecord: fields is required.' };
                const data = await post(`/rowcreate/${stackId}/${tableId}`, { fields });
                return { output: { records: data.records ?? [] } };
            }

            case 'updateRecord': {
                const { stackId, tableId, recordId, fields } = inputs;
                if (!stackId) return { error: 'Stackby updateRecord: stackId is required.' };
                if (!tableId) return { error: 'Stackby updateRecord: tableId is required.' };
                if (!recordId) return { error: 'Stackby updateRecord: recordId is required.' };
                if (!fields) return { error: 'Stackby updateRecord: fields is required.' };
                const data = await post(`/rowupdate/${stackId}/${tableId}/${recordId}`, { fields });
                return { output: { records: data.records ?? [] } };
            }

            case 'deleteRecord': {
                const { stackId, tableId, recordId } = inputs;
                if (!stackId) return { error: 'Stackby deleteRecord: stackId is required.' };
                if (!tableId) return { error: 'Stackby deleteRecord: tableId is required.' };
                if (!recordId) return { error: 'Stackby deleteRecord: recordId is required.' };
                const data = await del(`/rowdelete/${stackId}/${tableId}/${recordId}`);
                return { output: { records: data.records ?? [] } };
            }

            case 'listColumns': {
                const { stackId, tableId } = inputs;
                if (!stackId) return { error: 'Stackby listColumns: stackId is required.' };
                if (!tableId) return { error: 'Stackby listColumns: tableId is required.' };
                const data = await get(`/columnlist/${stackId}/${tableId}`);
                const columns = (data.columns ?? []).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                }));
                return { output: { columns } };
            }

            case 'createColumn': {
                const { stackId, tableId, name, type } = inputs;
                if (!stackId) return { error: 'Stackby createColumn: stackId is required.' };
                if (!tableId) return { error: 'Stackby createColumn: tableId is required.' };
                if (!name) return { error: 'Stackby createColumn: name is required.' };
                if (!type) return { error: 'Stackby createColumn: type is required.' };
                const data = await post(`/columncreate/${stackId}/${tableId}`, { name, type });
                return { output: { column: data.column ?? {} } };
            }

            case 'listStacks': {
                const data = await get('/stacklist');
                const stacks = (data.stacks ?? []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                }));
                return { output: { stacks } };
            }

            case 'getStack': {
                const { stackId } = inputs;
                if (!stackId) return { error: 'Stackby getStack: stackId is required.' };
                const data = await get(`/stackget/${stackId}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        tables: (data.tables ?? []).map((t: any) => ({ id: t.id, name: t.name })),
                    },
                };
            }

            case 'listTables': {
                const { stackId } = inputs;
                if (!stackId) return { error: 'Stackby listTables: stackId is required.' };
                const data = await get(`/tablelist/${stackId}`);
                const tables = (data.tables ?? []).map((t: any) => ({ id: t.id, name: t.name }));
                return { output: { tables } };
            }

            case 'createTable': {
                const { stackId, name } = inputs;
                if (!stackId) return { error: 'Stackby createTable: stackId is required.' };
                if (!name) return { error: 'Stackby createTable: name is required.' };
                const data = await post(`/tablecreate/${stackId}`, { name });
                return { output: { table: data.table ?? {} } };
            }

            case 'searchRecords': {
                const { stackId, tableId, query, columnId } = inputs;
                if (!stackId) return { error: 'Stackby searchRecords: stackId is required.' };
                if (!tableId) return { error: 'Stackby searchRecords: tableId is required.' };
                if (!query) return { error: 'Stackby searchRecords: query is required.' };
                if (!columnId) return { error: 'Stackby searchRecords: columnId is required.' };
                const data = await get(
                    `/rowlist/${stackId}/${tableId}?filterBy=${encodeURIComponent(columnId)}&filterValue=${encodeURIComponent(query)}`,
                );
                return { output: { records: data.records ?? [] } };
            }

            default:
                logger.log(`Stackby: unknown action "${actionName}"`);
                return { error: `Stackby: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Stackby action "${actionName}" error: ${err.message}`);
        return { error: err.message ?? 'Stackby: unknown error' };
    }
}
