'use server';

export async function executePostgresAPIAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');
        if (!baseUrl) return { error: 'baseUrl is required.' };
        if (!inputs.apiKey) return { error: 'apiKey is required.' };

        const headers: Record<string, string> = {
            'apikey': inputs.apiKey,
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        const request = async (method: string, path: string, body?: any, extraHeaders?: Record<string, string>) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: { ...headers, ...(extraHeaders || {}) },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) return { error: (data && data.message) || (data && data.hint) || text || 'Request failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'selectRows': {
                const { table, select, filters, limit, offset, order } = inputs;
                if (!table) return { error: 'table is required.' };
                const params = new URLSearchParams();
                if (select) params.set('select', select);
                if (limit) params.set('limit', String(limit));
                if (offset) params.set('offset', String(offset));
                if (order) params.set('order', order);
                if (filters && typeof filters === 'object') {
                    for (const [k, v] of Object.entries(filters)) {
                        params.set(k, String(v));
                    }
                }
                const qs = params.toString() ? `?${params.toString()}` : '';
                return request('GET', `/${table}${qs}`);
            }

            case 'insertRow': {
                const { table, record, returning } = inputs;
                if (!table || !record) return { error: 'table and record are required.' };
                const prefer = returning ? `return=${returning}` : 'return=representation';
                return request('POST', `/${table}`, record, { Prefer: prefer });
            }

            case 'updateRows': {
                const { table, record, filters, returning } = inputs;
                if (!table || !record) return { error: 'table and record are required.' };
                const params = new URLSearchParams();
                if (filters && typeof filters === 'object') {
                    for (const [k, v] of Object.entries(filters)) {
                        params.set(k, String(v));
                    }
                }
                const qs = params.toString() ? `?${params.toString()}` : '';
                const prefer = returning ? `return=${returning}` : 'return=representation';
                return request('PATCH', `/${table}${qs}`, record, { Prefer: prefer });
            }

            case 'deleteRows': {
                const { table, filters, returning } = inputs;
                if (!table) return { error: 'table is required.' };
                const params = new URLSearchParams();
                if (filters && typeof filters === 'object') {
                    for (const [k, v] of Object.entries(filters)) {
                        params.set(k, String(v));
                    }
                }
                const qs = params.toString() ? `?${params.toString()}` : '';
                const prefer = returning ? `return=${returning}` : 'return=representation';
                return request('DELETE', `/${table}${qs}`, undefined, { Prefer: prefer });
            }

            case 'upsertRows': {
                const { table, records, onConflict, returning } = inputs;
                if (!table || !records) return { error: 'table and records are required.' };
                const prefer = `resolution=${onConflict || 'merge-duplicates'},return=${returning || 'representation'}`;
                return request('POST', `/${table}`, records, { Prefer: prefer });
            }

            case 'countRows': {
                const { table, filters } = inputs;
                if (!table) return { error: 'table is required.' };
                const params = new URLSearchParams({ select: 'count' });
                if (filters && typeof filters === 'object') {
                    for (const [k, v] of Object.entries(filters)) {
                        params.set(k, String(v));
                    }
                }
                const qs = `?${params.toString()}`;
                const res = await fetch(`${baseUrl}/${table}${qs}`, {
                    method: 'HEAD',
                    headers: { ...headers, Prefer: 'count=exact' },
                });
                const count = res.headers.get('Content-Range');
                if (!res.ok) return { error: 'Count request failed.' };
                return { output: { contentRange: count } };
            }

            case 'callRpc': {
                const { functionName, params: rpcParams } = inputs;
                if (!functionName) return { error: 'functionName is required.' };
                return request('POST', `/rpc/${functionName}`, rpcParams || {});
            }

            case 'getSchemaInfo': {
                const res = await fetch(baseUrl, {
                    method: 'GET',
                    headers: { ...headers, Accept: 'application/openapi+json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to fetch schema.' };
                return { output: data };
            }

            case 'listTables': {
                const res = await fetch(baseUrl, {
                    method: 'GET',
                    headers: { ...headers, Accept: 'application/openapi+json' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list tables.' };
                const tables = Object.keys(data?.definitions || data?.paths || {});
                return { output: { tables } };
            }

            case 'filterRows': {
                const { table, column, operator, value, select } = inputs;
                if (!table || !column || !operator || value === undefined) {
                    return { error: 'table, column, operator, and value are required.' };
                }
                const params = new URLSearchParams();
                if (select) params.set('select', select);
                params.set(column, `${operator}.${value}`);
                return request('GET', `/${table}?${params.toString()}`);
            }

            case 'selectColumns': {
                const { table, columns, filters } = inputs;
                if (!table || !columns) return { error: 'table and columns are required.' };
                const params = new URLSearchParams({ select: Array.isArray(columns) ? columns.join(',') : columns });
                if (filters && typeof filters === 'object') {
                    for (const [k, v] of Object.entries(filters)) {
                        params.set(k, String(v));
                    }
                }
                return request('GET', `/${table}?${params.toString()}`);
            }

            case 'joinTables': {
                const { table, select, filters } = inputs;
                if (!table || !select) return { error: 'table and select (with embedded resource) are required.' };
                const params = new URLSearchParams({ select });
                if (filters && typeof filters === 'object') {
                    for (const [k, v] of Object.entries(filters)) {
                        params.set(k, String(v));
                    }
                }
                return request('GET', `/${table}?${params.toString()}`);
            }

            case 'groupBy': {
                const { table, groupColumn, aggregates } = inputs;
                if (!table || !groupColumn) return { error: 'table and groupColumn are required.' };
                const selectCols = [groupColumn, ...(aggregates ? (Array.isArray(aggregates) ? aggregates : [aggregates]) : [])].join(',');
                const params = new URLSearchParams({ select: selectCols });
                return request('GET', `/${table}?${params.toString()}`);
            }

            case 'orderBy': {
                const { table, column, direction, select, limit } = inputs;
                if (!table || !column) return { error: 'table and column are required.' };
                const params = new URLSearchParams({
                    order: `${column}.${direction || 'asc'}`,
                });
                if (select) params.set('select', select);
                if (limit) params.set('limit', String(limit));
                return request('GET', `/${table}?${params.toString()}`);
            }

            case 'paginateRows': {
                const { table, page, pageSize, select, order } = inputs;
                if (!table) return { error: 'table is required.' };
                const size = Number(pageSize) || 20;
                const pageNum = Number(page) || 1;
                const offset = (pageNum - 1) * size;
                const params = new URLSearchParams({ limit: String(size), offset: String(offset) });
                if (select) params.set('select', select);
                if (order) params.set('order', order);
                return request('GET', `/${table}?${params.toString()}`);
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
