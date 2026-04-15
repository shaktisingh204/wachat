'use server';

function basicAuth(username: string, password: string): string {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

export async function executeOracleAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { username, password } = inputs;

        // ── HCM / ERP helpers ────────────────────────────────────────────────────
        const hcmActions = new Set([
            'listWorkers', 'getWorker', 'listAbsences',
            'listPositions', 'listDepartments', 'listJobs',
        ]);

        // ── ORDS helpers ─────────────────────────────────────────────────────────
        const ordsActions = new Set([
            'runQuery', 'getTable', 'insertRow', 'updateRow',
            'deleteRow', 'batchInsert', 'runStoredProc',
        ]);

        if (hcmActions.has(actionName)) {
            const { cloudUrl } = inputs;
            if (!cloudUrl) return { error: 'Oracle HCM: cloudUrl is required.' };
            if (!username) return { error: 'Oracle HCM: username is required.' };
            if (!password) return { error: 'Oracle HCM: password is required.' };

            const base = cloudUrl.replace(/\/$/, '');
            const authHeader = basicAuth(username, password);
            const headers: Record<string, string> = {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            };

            const hcmGet = async (path: string) => {
                const res = await fetch(`${base}${path}`, { method: 'GET', headers });
                const body = await res.json();
                if (!res.ok) throw new Error(body.title ?? body.detail ?? JSON.stringify(body));
                return body;
            };

            switch (actionName) {
                case 'listWorkers': {
                    const { limit, offset, fields } = inputs;
                    const data = await hcmGet(
                        `/hcmRestApi/resources/11.13.18.05/workers?limit=${limit ?? 100}&offset=${offset ?? 0}&fields=${fields ?? 'PersonId,DisplayName,BusinessTitle'}`,
                    );
                    return { output: { items: data.items ?? [], count: data.count, hasMore: data.hasMore } };
                }

                case 'getWorker': {
                    const { personId } = inputs;
                    if (!personId) return { error: 'Oracle getWorker: personId is required.' };
                    const data = await hcmGet(`/hcmRestApi/resources/11.13.18.05/workers/${personId}`);
                    return {
                        output: {
                            PersonId: data.PersonId,
                            DisplayName: data.DisplayName,
                            BusinessTitle: data.BusinessTitle,
                            EmailAddress: data.EmailAddress,
                        },
                    };
                }

                case 'listAbsences': {
                    const { personId, startDate, endDate } = inputs;
                    if (!personId) return { error: 'Oracle listAbsences: personId is required.' };
                    let url = `/absenceRest/publicView/v1/absences?personId=${personId}`;
                    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
                    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
                    const data = await hcmGet(url);
                    return { output: { items: data.items ?? [] } };
                }

                case 'listPositions': {
                    const { limit, offset } = inputs;
                    const data = await hcmGet(
                        `/hcmRestApi/resources/11.13.18.05/positions?limit=${limit ?? 100}&offset=${offset ?? 0}`,
                    );
                    return { output: { items: data.items ?? [] } };
                }

                case 'listDepartments': {
                    const data = await hcmGet('/hcmRestApi/resources/11.13.18.05/departments?limit=100');
                    const items = (data.items ?? []).map((d: any) => ({
                        DepartmentId: d.DepartmentId,
                        DepartmentName: d.DepartmentName,
                    }));
                    return { output: { items } };
                }

                case 'listJobs': {
                    const data = await hcmGet('/hcmRestApi/resources/11.13.18.05/jobs?limit=100');
                    const items = (data.items ?? []).map((j: any) => ({
                        JobId: j.JobId,
                        Name: j.Name,
                        JobCode: j.JobCode,
                    }));
                    return { output: { items } };
                }

                default:
                    return { error: `Oracle: unknown action "${actionName}"` };
            }
        }

        if (ordsActions.has(actionName)) {
            const { ordsUrl } = inputs;
            if (!ordsUrl) return { error: 'Oracle ORDS: ordsUrl is required.' };
            if (!username) return { error: 'Oracle ORDS: username is required.' };
            if (!password) return { error: 'Oracle ORDS: password is required.' };

            const base = ordsUrl.replace(/\/$/, '');
            const authHeader = basicAuth(username, password);
            const baseHeaders: Record<string, string> = {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            };

            const ordsGet = async (path: string) => {
                const res = await fetch(`${base}${path}`, { method: 'GET', headers: baseHeaders });
                const body = await res.json();
                if (!res.ok) throw new Error(body.title ?? body.message ?? JSON.stringify(body));
                return body;
            };

            const ordsPost = async (path: string, payload: any) => {
                const res = await fetch(`${base}${path}`, {
                    method: 'POST',
                    headers: baseHeaders,
                    body: JSON.stringify(payload),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.title ?? body.message ?? JSON.stringify(body));
                return body;
            };

            const ordsPut = async (path: string, payload: any) => {
                const res = await fetch(`${base}${path}`, {
                    method: 'PUT',
                    headers: baseHeaders,
                    body: JSON.stringify(payload),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.title ?? body.message ?? JSON.stringify(body));
                return body;
            };

            const ordsDelete = async (path: string) => {
                const res = await fetch(`${base}${path}`, { method: 'DELETE', headers: baseHeaders });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.title ?? body.message ?? `HTTP ${res.status}`);
                }
                return true;
            };

            switch (actionName) {
                case 'runQuery': {
                    const { schema, sqlQuery, bindVars } = inputs;
                    if (!schema) return { error: 'Oracle ORDS runQuery: schema is required.' };
                    if (!sqlQuery) return { error: 'Oracle ORDS runQuery: sqlQuery is required.' };
                    const data = await ordsPost(`/ords/${schema}/_/sql`, {
                        statementText: sqlQuery,
                        binds: bindVars ?? [],
                    });
                    return {
                        output: {
                            items: data.items ?? [],
                            offset: data.offset,
                            count: data.count,
                            hasMore: data.hasMore,
                        },
                    };
                }

                case 'getTable': {
                    const { schema, table, q, limit, offset } = inputs;
                    if (!schema) return { error: 'Oracle ORDS getTable: schema is required.' };
                    if (!table) return { error: 'Oracle ORDS getTable: table is required.' };
                    const data = await ordsGet(
                        `/ords/${schema}/${table}/?q=${q ?? ''}&limit=${limit ?? 25}&offset=${offset ?? 0}`,
                    );
                    return {
                        output: {
                            items: data.items ?? [],
                            count: data.count,
                            hasMore: data.hasMore,
                            next: data.next,
                        },
                    };
                }

                case 'insertRow': {
                    const { schema, table, data: rowData } = inputs;
                    if (!schema) return { error: 'Oracle ORDS insertRow: schema is required.' };
                    if (!table) return { error: 'Oracle ORDS insertRow: table is required.' };
                    if (!rowData) return { error: 'Oracle ORDS insertRow: data is required.' };
                    const row = await ordsPost(`/ords/${schema}/${table}/`, rowData);
                    return { output: row };
                }

                case 'updateRow': {
                    const { schema, table, key, data: rowData } = inputs;
                    if (!schema) return { error: 'Oracle ORDS updateRow: schema is required.' };
                    if (!table) return { error: 'Oracle ORDS updateRow: table is required.' };
                    if (!key) return { error: 'Oracle ORDS updateRow: key is required.' };
                    if (!rowData) return { error: 'Oracle ORDS updateRow: data is required.' };
                    const row = await ordsPut(`/ords/${schema}/${table}/${key}`, rowData);
                    return { output: row };
                }

                case 'deleteRow': {
                    const { schema, table, key } = inputs;
                    if (!schema) return { error: 'Oracle ORDS deleteRow: schema is required.' };
                    if (!table) return { error: 'Oracle ORDS deleteRow: table is required.' };
                    if (!key) return { error: 'Oracle ORDS deleteRow: key is required.' };
                    await ordsDelete(`/ords/${schema}/${table}/${key}`);
                    return { output: { deleted: true } };
                }

                case 'batchInsert': {
                    const { schema, table, rows } = inputs;
                    if (!schema) return { error: 'Oracle ORDS batchInsert: schema is required.' };
                    if (!table) return { error: 'Oracle ORDS batchInsert: table is required.' };
                    if (!rows || !Array.isArray(rows)) return { error: 'Oracle ORDS batchInsert: rows (array) is required.' };
                    const data = await ordsPost(`/ords/${schema}/${table}/_batch`, { items: rows });
                    return { output: { items: data.items ?? [] } };
                }

                case 'runStoredProc': {
                    const { schema, proc, params } = inputs;
                    if (!schema) return { error: 'Oracle ORDS runStoredProc: schema is required.' };
                    if (!proc) return { error: 'Oracle ORDS runStoredProc: proc is required.' };
                    const result = await ordsPost(`/ords/${schema}/${proc}`, params ?? {});
                    return { output: result };
                }

                default:
                    return { error: `Oracle: unknown action "${actionName}"` };
            }
        }

        logger.log(`Oracle: unknown action "${actionName}"`);
        return { error: `Oracle: unknown action "${actionName}"` };
    } catch (err: any) {
        logger.log(`Oracle action "${actionName}" error: ${err.message}`);
        return { error: err.message ?? 'Oracle: unknown error' };
    }
}
