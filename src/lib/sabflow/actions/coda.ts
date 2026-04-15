'use server';

const CODA_BASE = 'https://coda.io/apis/v1';

export async function executeCodaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'Coda: apiKey is required.' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            logger.log(`[Coda] GET ${path}`);
            const res = await fetch(`${CODA_BASE}${path}`, { method: 'GET', headers });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message ?? body.statusMessage ?? JSON.stringify(body));
            return body;
        };

        const post = async (path: string, payload: Record<string, any>) => {
            logger.log(`[Coda] POST ${path}`);
            const res = await fetch(`${CODA_BASE}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message ?? body.statusMessage ?? JSON.stringify(body));
            return body;
        };

        const put = async (path: string, payload: Record<string, any>) => {
            logger.log(`[Coda] PUT ${path}`);
            const res = await fetch(`${CODA_BASE}${path}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message ?? body.statusMessage ?? JSON.stringify(body));
            return body;
        };

        const patch = async (path: string, payload: Record<string, any>) => {
            logger.log(`[Coda] PATCH ${path}`);
            const res = await fetch(`${CODA_BASE}${path}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message ?? body.statusMessage ?? JSON.stringify(body));
            return body;
        };

        const del = async (path: string, payload?: Record<string, any>) => {
            logger.log(`[Coda] DELETE ${path}`);
            const opts: RequestInit = { method: 'DELETE', headers };
            if (payload) opts.body = JSON.stringify(payload);
            const res = await fetch(`${CODA_BASE}${path}`, opts);
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message ?? body.statusMessage ?? JSON.stringify(body));
            return body;
        };

        switch (actionName) {
            case 'listDocs': {
                const { isOwner, query, pageToken, limit } = inputs;
                const params = new URLSearchParams();
                if (isOwner !== undefined) params.set('isOwner', String(isOwner));
                if (query) params.set('query', query);
                if (pageToken) params.set('pageToken', pageToken);
                if (limit) params.set('limit', String(limit));
                const data = await get(`/docs?${params.toString()}`);
                const items = (data.items ?? []).map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    href: d.href,
                    owner: d.owner,
                    createdAt: d.createdAt,
                    updatedAt: d.updatedAt,
                }));
                return { output: { items, nextPageToken: data.nextPageToken ?? null } };
            }

            case 'getDoc': {
                const { docId } = inputs;
                if (!docId) return { error: 'Coda getDoc: docId is required.' };
                const data = await get(`/docs/${docId}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        owner: data.owner,
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                        href: data.href,
                    },
                };
            }

            case 'createDoc': {
                const { title, sourceDoc, timezone } = inputs;
                if (!title) return { error: 'Coda createDoc: title is required.' };
                const payload: Record<string, any> = { title };
                if (sourceDoc) payload.sourceDoc = sourceDoc;
                if (timezone) payload.timezone = timezone;
                const data = await post('/docs', payload);
                return { output: { id: data.id, href: data.href, name: data.name } };
            }

            case 'listPages': {
                const { docId, limit, pageToken } = inputs;
                if (!docId) return { error: 'Coda listPages: docId is required.' };
                const params = new URLSearchParams();
                if (limit) params.set('limit', String(limit));
                if (pageToken) params.set('pageToken', pageToken);
                const data = await get(`/docs/${docId}/pages?${params.toString()}`);
                const items = (data.items ?? []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    subtitle: p.subtitle,
                    href: p.href,
                }));
                return { output: { items, nextPageToken: data.nextPageToken ?? null } };
            }

            case 'getPage': {
                const { docId, pageIdOrName } = inputs;
                if (!docId) return { error: 'Coda getPage: docId is required.' };
                if (!pageIdOrName) return { error: 'Coda getPage: pageIdOrName is required.' };
                const data = await get(`/docs/${docId}/pages/${encodeURIComponent(pageIdOrName)}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        subtitle: data.subtitle ?? '',
                        href: data.href,
                        contentType: data.contentType ?? null,
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                    },
                };
            }

            case 'createPage': {
                const { docId, name, subtitle, parentPageId, pageContent } = inputs;
                if (!docId) return { error: 'Coda createPage: docId is required.' };
                if (!name) return { error: 'Coda createPage: name is required.' };
                const payload: Record<string, any> = { name };
                if (subtitle) payload.subtitle = subtitle;
                if (parentPageId) payload.parentPageId = parentPageId;
                if (pageContent) payload.pageContent = typeof pageContent === 'string' ? JSON.parse(pageContent) : pageContent;
                const data = await post(`/docs/${docId}/pages`, payload);
                return { output: { id: data.id, href: data.href, name: data.name } };
            }

            case 'updatePage': {
                const { docId, pageIdOrName, name, subtitle } = inputs;
                if (!docId) return { error: 'Coda updatePage: docId is required.' };
                if (!pageIdOrName) return { error: 'Coda updatePage: pageIdOrName is required.' };
                const payload: Record<string, any> = {};
                if (name) payload.name = name;
                if (subtitle !== undefined) payload.subtitle = subtitle;
                const data = await put(`/docs/${docId}/pages/${encodeURIComponent(pageIdOrName)}`, payload);
                return { output: { id: data.id, href: data.href, name: data.name } };
            }

            case 'listTables': {
                const { docId, limit, pageToken, tableTypes } = inputs;
                if (!docId) return { error: 'Coda listTables: docId is required.' };
                const params = new URLSearchParams();
                if (limit) params.set('limit', String(limit));
                if (pageToken) params.set('pageToken', pageToken);
                if (tableTypes) params.set('tableTypes', tableTypes);
                const data = await get(`/docs/${docId}/tables?${params.toString()}`);
                const items = (data.items ?? []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    tableType: t.tableType,
                    rowCount: t.rowCount,
                }));
                return { output: { items, nextPageToken: data.nextPageToken ?? null } };
            }

            case 'getTable': {
                const { docId, tableIdOrName } = inputs;
                if (!docId) return { error: 'Coda getTable: docId is required.' };
                if (!tableIdOrName) return { error: 'Coda getTable: tableIdOrName is required.' };
                const data = await get(`/docs/${docId}/tables/${encodeURIComponent(tableIdOrName)}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        tableType: data.tableType,
                        rowCount: data.rowCount,
                        columnCount: data.columnCount,
                    },
                };
            }

            case 'listRows': {
                const { docId, tableId, query, useColumnNames, limit, pageToken } = inputs;
                if (!docId) return { error: 'Coda listRows: docId is required.' };
                if (!tableId) return { error: 'Coda listRows: tableId is required.' };
                const params = new URLSearchParams();
                params.set('useColumnNames', String(useColumnNames ?? true));
                if (limit) params.set('limit', String(limit));
                if (query) params.set('query', query);
                if (pageToken) params.set('pageToken', pageToken);
                const data = await get(`/docs/${docId}/tables/${tableId}/rows?${params.toString()}`);
                return { output: { items: data.items ?? [], nextPageToken: data.nextPageToken ?? null, count: (data.items ?? []).length } };
            }

            case 'getRow': {
                const { docId, tableId, rowIdOrName } = inputs;
                if (!docId) return { error: 'Coda getRow: docId is required.' };
                if (!tableId) return { error: 'Coda getRow: tableId is required.' };
                if (!rowIdOrName) return { error: 'Coda getRow: rowIdOrName is required.' };
                const data = await get(`/docs/${docId}/tables/${tableId}/rows/${encodeURIComponent(rowIdOrName)}?useColumnNames=true`);
                return { output: { id: data.id, name: data.name, values: data.values ?? {}, href: data.href } };
            }

            case 'insertRows': {
                const { docId, tableId, rows, keyColumns } = inputs;
                if (!docId) return { error: 'Coda insertRows: docId is required.' };
                if (!tableId) return { error: 'Coda insertRows: tableId is required.' };
                if (!rows || !Array.isArray(rows)) return { error: 'Coda insertRows: rows (array) is required.' };
                const payload: Record<string, any> = {
                    rows: rows.map((r: any) => ({
                        cells: Array.isArray(r.cells)
                            ? r.cells
                            : Object.entries(r).map(([column, value]) => ({ column, value })),
                    })),
                };
                if (keyColumns) payload.keyColumns = keyColumns;
                const data = await post(`/docs/${docId}/tables/${tableId}/rows`, payload);
                return { output: { addedRowIds: data.addedRowIds ?? [] } };
            }

            case 'updateRow': {
                const { docId, tableId, rowId, cells } = inputs;
                if (!docId) return { error: 'Coda updateRow: docId is required.' };
                if (!tableId) return { error: 'Coda updateRow: tableId is required.' };
                if (!rowId) return { error: 'Coda updateRow: rowId is required.' };
                if (!cells) return { error: 'Coda updateRow: cells is required.' };
                const cellArray = Array.isArray(cells)
                    ? cells
                    : Object.entries(cells).map(([column, value]) => ({ column, value }));
                const data = await put(`/docs/${docId}/tables/${tableId}/rows/${rowId}`, {
                    row: { cells: cellArray },
                });
                return { output: { id: data.id, href: data.href } };
            }

            case 'deleteRow': {
                const { docId, tableId, rowId } = inputs;
                if (!docId) return { error: 'Coda deleteRow: docId is required.' };
                if (!tableId) return { error: 'Coda deleteRow: tableId is required.' };
                if (!rowId) return { error: 'Coda deleteRow: rowId is required.' };
                const data = await del(`/docs/${docId}/tables/${tableId}/rows/${rowId}`);
                return { output: { id: data.id ?? rowId } };
            }

            case 'listColumns': {
                const { docId, tableId, limit, pageToken } = inputs;
                if (!docId) return { error: 'Coda listColumns: docId is required.' };
                if (!tableId) return { error: 'Coda listColumns: tableId is required.' };
                const params = new URLSearchParams();
                if (limit) params.set('limit', String(limit));
                if (pageToken) params.set('pageToken', pageToken);
                const data = await get(`/docs/${docId}/tables/${tableId}/columns?${params.toString()}`);
                const items = (data.items ?? []).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    type: { name: c.format?.type ?? c.type?.name ?? 'unknown' },
                    calculated: c.calculated ?? false,
                }));
                return { output: { items, nextPageToken: data.nextPageToken ?? null } };
            }

            default:
                logger.log(`Coda: unknown action "${actionName}"`);
                return { error: `Coda: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Coda action "${actionName}" error: ${err.message}`);
        return { error: err.message ?? 'Coda: unknown error' };
    }
}
