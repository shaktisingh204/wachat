'use server';

async function odooRpc(serverUrl: string, path: string, params: any, sessionCookie?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionCookie) headers['Cookie'] = sessionCookie;

    const res = await fetch(`${serverUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            id: Math.floor(Math.random() * 100000),
            params,
        }),
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
        throw new Error(data?.error?.data?.message ?? data?.error?.message ?? `Odoo HTTP error ${res.status}: ${text}`);
    }
    if (data?.error) {
        throw new Error(data.error?.data?.message ?? data.error?.message ?? JSON.stringify(data.error));
    }
    return data?.result;
}

async function getSession(inputs: any): Promise<{ serverUrl: string; sessionCookie: string; uid: number }> {
    const serverUrl = (inputs.baseUrl as string)?.replace(/\/$/, '');
    if (!serverUrl) throw new Error('Missing required input: baseUrl');
    if (!inputs.db) throw new Error('Missing required input: db');
    if (!inputs.username) throw new Error('Missing required input: username');
    if (!inputs.password) throw new Error('Missing required input: password');

    const res = await fetch(`${serverUrl}/web/session/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0', method: 'call', id: 1,
            params: { db: inputs.db, login: inputs.username, password: inputs.password },
        }),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!res.ok || data?.error) {
        throw new Error(data?.error?.data?.message ?? data?.error?.message ?? `Odoo auth error ${res.status}`);
    }
    const uid = data?.result?.uid;
    if (!uid) throw new Error('Odoo authentication failed: no uid returned');
    const setCookie = res.headers.get('set-cookie') ?? '';
    const sessionMatch = setCookie.match(/session_id=[^;]+/);
    const sessionCookie = sessionMatch ? sessionMatch[0] : '';
    return { serverUrl, sessionCookie, uid };
}

async function callKw(serverUrl: string, sessionCookie: string, model: string, method: string, args: any[], kwargs: Record<string, any> = {}): Promise<any> {
    return odooRpc(serverUrl, '/web/dataset/call_kw', { model, method, args, kwargs }, sessionCookie);
}

export async function executeOdooAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        logger.log(`Executing Odoo action: ${actionName}`);

        switch (actionName) {

            case 'authenticate': {
                const { serverUrl, sessionCookie, uid } = await getSession(inputs);
                return { output: { uid, sessionCookie, serverUrl, authenticated: true } };
            }

            case 'searchRecords': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const domain = inputs.domain ?? [];
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'search', [domain], {
                    limit: inputs.limit ?? 80,
                    offset: inputs.offset ?? 0,
                    order: inputs.order ?? 'id desc',
                });
                return { output: { ids: result ?? [], count: (result ?? []).length } };
            }

            case 'readRecords': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                if (!inputs.ids) return { error: 'Missing required input: ids' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const ids = Array.isArray(inputs.ids) ? inputs.ids : [inputs.ids];
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'read', [ids], {
                    fields: inputs.fields ?? [],
                });
                return { output: { records: result ?? [] } };
            }

            case 'createRecord': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                if (!inputs.values) return { error: 'Missing required input: values' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'create', [inputs.values]);
                return { output: { id: result, created: true } };
            }

            case 'updateRecord': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                if (!inputs.ids) return { error: 'Missing required input: ids' };
                if (!inputs.values) return { error: 'Missing required input: values' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const ids = Array.isArray(inputs.ids) ? inputs.ids : [inputs.ids];
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'write', [ids, inputs.values]);
                return { output: { success: result, updated: true } };
            }

            case 'deleteRecord': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                if (!inputs.ids) return { error: 'Missing required input: ids' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const ids = Array.isArray(inputs.ids) ? inputs.ids : [inputs.ids];
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'unlink', [ids]);
                return { output: { success: result, deleted: true } };
            }

            case 'searchRead': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'search_read', [], {
                    domain: inputs.domain ?? [],
                    fields: inputs.fields ?? [],
                    limit: inputs.limit ?? 80,
                    offset: inputs.offset ?? 0,
                    order: inputs.order ?? 'id desc',
                });
                return { output: { records: result ?? [], count: (result ?? []).length } };
            }

            case 'getFields': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'fields_get', [], {
                    attributes: inputs.attributes ?? ['string', 'type', 'required', 'readonly', 'selection'],
                });
                return { output: { fields: result ?? {} } };
            }

            case 'callMethod': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                if (!inputs.method) return { error: 'Missing required input: method' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const result = await callKw(serverUrl, sessionCookie, inputs.model, inputs.method, inputs.args ?? [], inputs.kwargs ?? {});
                return { output: { result } };
            }

            case 'listModels': {
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const result = await callKw(serverUrl, sessionCookie, 'ir.model', 'search_read', [], {
                    domain: inputs.domain ?? [],
                    fields: ['id', 'name', 'model', 'state'],
                    limit: inputs.limit ?? 200,
                    offset: inputs.offset ?? 0,
                    order: 'model asc',
                });
                return { output: { models: result ?? [], count: (result ?? []).length } };
            }

            case 'getModel': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const result = await callKw(serverUrl, sessionCookie, 'ir.model', 'search_read', [], {
                    domain: [['model', '=', inputs.model]],
                    fields: ['id', 'name', 'model', 'state', 'field_id'],
                    limit: 1,
                });
                return { output: { model: (result ?? [])[0] ?? null } };
            }

            case 'countRecords': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'search_count', [inputs.domain ?? []]);
                return { output: { count: result ?? 0 } };
            }

            case 'groupByRecords': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                if (!inputs.groupBy) return { error: 'Missing required input: groupBy (array of field names)' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const groupBy = Array.isArray(inputs.groupBy) ? inputs.groupBy : [inputs.groupBy];
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'read_group', [], {
                    domain: inputs.domain ?? [],
                    fields: inputs.fields ?? groupBy,
                    groupby: groupBy,
                    lazy: inputs.lazy ?? false,
                });
                return { output: { groups: result ?? [], count: (result ?? []).length } };
            }

            case 'readGroup': {
                if (!inputs.model) return { error: 'Missing required input: model' };
                if (!inputs.fields) return { error: 'Missing required input: fields' };
                if (!inputs.groupby) return { error: 'Missing required input: groupby' };
                const { serverUrl, sessionCookie } = await getSession(inputs);
                const groupby = Array.isArray(inputs.groupby) ? inputs.groupby : [inputs.groupby];
                const result = await callKw(serverUrl, sessionCookie, inputs.model, 'read_group', [], {
                    domain: inputs.domain ?? [],
                    fields: inputs.fields,
                    groupby,
                    offset: inputs.offset ?? 0,
                    limit: inputs.limit ?? 0,
                    orderby: inputs.orderby ?? '',
                    lazy: inputs.lazy ?? true,
                });
                return { output: { groups: result ?? [] } };
            }

            case 'listDatabases': {
                const baseUrl = (inputs.baseUrl as string)?.replace(/\/$/, '');
                if (!baseUrl) return { error: 'Missing required input: baseUrl' };
                const result = await odooRpc(baseUrl, '/web/database/list', {});
                return { output: { databases: result ?? [] } };
            }

            default:
                return { error: `Odoo action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Odoo action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Odoo error' };
    }
}
