'use server';

const DEFAULT_SERVER = 'https://cloud.seatable.io';
const DTABLE_BASE = '/dtable-server/api/v1';

export async function executeSeaTableAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { apiToken } = inputs;
        if (!apiToken) return { error: 'SeaTable: apiToken is required.' };

        const serverUrl = (inputs.serverUrl ?? DEFAULT_SERVER).replace(/\/$/, '');

        // All table-operation requests go to the dtable-server base
        const dtableBase = `${serverUrl}${DTABLE_BASE}`;

        const makeHeaders = (token: string): Record<string, string> => ({
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
        });

        const apiHeaders = makeHeaders(apiToken);

        const apiGet = async (url: string) => {
            const res = await fetch(url, { method: 'GET', headers: apiHeaders });
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail ?? body.error_msg ?? JSON.stringify(body));
            return body;
        };

        const dtableGet = async (path: string) => {
            const res = await fetch(`${dtableBase}${path}`, { method: 'GET', headers: apiHeaders });
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail ?? body.error_msg ?? JSON.stringify(body));
            return body;
        };

        const dtablePost = async (path: string, payload: Record<string, any>) => {
            const res = await fetch(`${dtableBase}${path}`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(payload),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail ?? body.error_msg ?? JSON.stringify(body));
            return body;
        };

        const dtablePut = async (path: string, payload: Record<string, any>) => {
            const res = await fetch(`${dtableBase}${path}`, {
                method: 'PUT',
                headers: apiHeaders,
                body: JSON.stringify(payload),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail ?? body.error_msg ?? JSON.stringify(body));
            return body;
        };

        const dtableDelete = async (path: string, payload: Record<string, any>) => {
            const res = await fetch(`${dtableBase}${path}`, {
                method: 'DELETE',
                headers: apiHeaders,
                body: JSON.stringify(payload),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail ?? body.error_msg ?? JSON.stringify(body));
            return body;
        };

        switch (actionName) {
            case 'listBases': {
                const data = await apiGet(`${serverUrl}/api2/dtables/`);
                const dtables = (data.dtables ?? []).map((d: any) => ({
                    id: d.id,
                    workspace_id: d.workspace_id,
                    name: d.name,
                }));
                return { output: { dtables } };
            }

            case 'getBase': {
                const { dtableUuid } = inputs;
                if (!dtableUuid) return { error: 'SeaTable getBase: dtableUuid is required.' };
                const data = await apiGet(`${serverUrl}/api2/dtables/${dtableUuid}/`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        workspace_id: data.workspace_id,
                    },
                };
            }

            case 'getBaseToken': {
                const { dtableUuid } = inputs;
                if (!dtableUuid) return { error: 'SeaTable getBaseToken: dtableUuid is required.' };
                const data = await apiGet(`${serverUrl}/api2/dtables/${dtableUuid}/app-access-token/`);
                return {
                    output: {
                        accessToken: data.access_token,
                        dtableUuid: data.dtable_uuid,
                        dtableName: data.dtable_name,
                    },
                };
            }

            case 'listTables': {
                const { dtableUuid } = inputs;
                if (!dtableUuid) return { error: 'SeaTable listTables: dtableUuid is required.' };
                const data = await dtableGet(`/dtables/${dtableUuid}/tables/`);
                const tables = (data.tables ?? []).map((t: any) => ({
                    _id: t._id,
                    name: t.name,
                    columns: t.columns ?? [],
                }));
                return { output: { tables } };
            }

            case 'listRows': {
                const { dtableUuid, tableName, viewName, limit, start } = inputs;
                if (!dtableUuid) return { error: 'SeaTable listRows: dtableUuid is required.' };
                if (!tableName) return { error: 'SeaTable listRows: tableName is required.' };
                let path = `/dtables/${dtableUuid}/rows/?table_name=${encodeURIComponent(tableName)}&limit=${limit ?? 25}&start=${start ?? 0}`;
                if (viewName) path += `&view_name=${encodeURIComponent(viewName)}`;
                const data = await dtableGet(path);
                return { output: { rows: data.rows ?? [] } };
            }

            case 'appendRow': {
                const { dtableUuid, tableName, data: rowData } = inputs;
                if (!dtableUuid) return { error: 'SeaTable appendRow: dtableUuid is required.' };
                if (!tableName) return { error: 'SeaTable appendRow: tableName is required.' };
                if (!rowData) return { error: 'SeaTable appendRow: data is required.' };
                const result = await dtablePost(`/dtables/${dtableUuid}/rows/`, {
                    table_name: tableName,
                    row: rowData,
                });
                return { output: result };
            }

            case 'updateRow': {
                const { dtableUuid, tableName, rowId, data: rowData } = inputs;
                if (!dtableUuid) return { error: 'SeaTable updateRow: dtableUuid is required.' };
                if (!tableName) return { error: 'SeaTable updateRow: tableName is required.' };
                if (!rowId) return { error: 'SeaTable updateRow: rowId is required.' };
                if (!rowData) return { error: 'SeaTable updateRow: data is required.' };
                await dtablePut(`/dtables/${dtableUuid}/rows/`, {
                    table_name: tableName,
                    row_id: rowId,
                    row: rowData,
                });
                return { output: { updated: true } };
            }

            case 'deleteRow': {
                const { dtableUuid, tableName, rowId } = inputs;
                if (!dtableUuid) return { error: 'SeaTable deleteRow: dtableUuid is required.' };
                if (!tableName) return { error: 'SeaTable deleteRow: tableName is required.' };
                if (!rowId) return { error: 'SeaTable deleteRow: rowId is required.' };
                await dtableDelete(`/dtables/${dtableUuid}/rows/`, {
                    table_name: tableName,
                    row_id: rowId,
                });
                return { output: { deleted: true } };
            }

            case 'addRows': {
                const { dtableUuid, tableName, rows } = inputs;
                if (!dtableUuid) return { error: 'SeaTable addRows: dtableUuid is required.' };
                if (!tableName) return { error: 'SeaTable addRows: tableName is required.' };
                if (!rows || !Array.isArray(rows)) return { error: 'SeaTable addRows: rows (array) is required.' };
                const data = await dtablePost(`/dtables/${dtableUuid}/batch-append-rows/`, {
                    table_name: tableName,
                    rows,
                });
                return { output: { inserted_row_count: data.inserted_row_count } };
            }

            case 'searchRows': {
                const { dtableUuid, tableName, query } = inputs;
                if (!dtableUuid) return { error: 'SeaTable searchRows: dtableUuid is required.' };
                if (!tableName) return { error: 'SeaTable searchRows: tableName is required.' };
                if (!query) return { error: 'SeaTable searchRows: query is required.' };
                const filterParam = encodeURIComponent(
                    JSON.stringify([
                        {
                            column_name: 'Name',
                            filter_predicate: 'contains',
                            filter_term: query,
                        },
                    ]),
                );
                const data = await dtableGet(
                    `/dtables/${dtableUuid}/filtered-rows/?table_name=${encodeURIComponent(tableName)}&filters=${filterParam}`,
                );
                return { output: { rows: data.rows ?? [] } };
            }

            default:
                logger.log(`SeaTable: unknown action "${actionName}"`);
                return { error: `SeaTable: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`SeaTable action "${actionName}" error: ${err.message}`);
        return { error: err.message ?? 'SeaTable: unknown error' };
    }
}
