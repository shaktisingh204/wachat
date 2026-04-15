'use server';

function erpAuth(inputs: any): { baseUrl: string; headers: Record<string, string> } {
    const baseUrl = (inputs.baseUrl as string)?.replace(/\/$/, '');
    if (!baseUrl) throw new Error('Missing required input: baseUrl');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    if (inputs.accessToken) {
        headers['Authorization'] = `Bearer ${inputs.accessToken}`;
    } else if (inputs.apiKey && inputs.apiSecret) {
        headers['Authorization'] = `token ${inputs.apiKey}:${inputs.apiSecret}`;
    } else {
        throw new Error('ERPNext auth: provide apiKey + apiSecret, or accessToken');
    }

    return { baseUrl: `${baseUrl}/api`, headers };
}

async function erpRequest(method: string, url: string, headers: Record<string, string>, body?: any): Promise<any> {
    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        throw new Error(data?.exception ?? data?.message ?? data?._error_message ?? `ERPNext error ${res.status}: ${text}`);
    }
    return data;
}

export async function executeErpNextAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        logger.log(`Executing ERPNext action: ${actionName}`);
        const { baseUrl, headers } = erpAuth(inputs);

        switch (actionName) {

            case 'listDocuments': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                const params = new URLSearchParams({
                    filters: JSON.stringify(inputs.filters ?? []),
                    fields: JSON.stringify(inputs.fields ?? ['name', 'creation', 'modified']),
                    limit_page_length: String(inputs.limit ?? 20),
                    limit_start: String(inputs.offset ?? 0),
                    order_by: inputs.orderBy ?? 'modified desc',
                });
                const data = await erpRequest('GET', `${baseUrl}/resource/${encodeURIComponent(inputs.doctype)}?${params}`, headers);
                return { output: { documents: data?.data ?? [], count: (data?.data ?? []).length } };
            }

            case 'getDocument': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.name) return { error: 'Missing required input: name' };
                const data = await erpRequest('GET', `${baseUrl}/resource/${encodeURIComponent(inputs.doctype)}/${encodeURIComponent(inputs.name)}`, headers);
                return { output: { document: data?.data ?? data } };
            }

            case 'createDocument': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.data) return { error: 'Missing required input: data (document fields)' };
                const payload = { doctype: inputs.doctype, ...inputs.data };
                const data = await erpRequest('POST', `${baseUrl}/resource/${encodeURIComponent(inputs.doctype)}`, headers, payload);
                return { output: { document: data?.data ?? data, created: true } };
            }

            case 'updateDocument': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.name) return { error: 'Missing required input: name' };
                if (!inputs.data) return { error: 'Missing required input: data (fields to update)' };
                const data = await erpRequest('PUT', `${baseUrl}/resource/${encodeURIComponent(inputs.doctype)}/${encodeURIComponent(inputs.name)}`, headers, inputs.data);
                return { output: { document: data?.data ?? data, updated: true } };
            }

            case 'deleteDocument': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.name) return { error: 'Missing required input: name' };
                const data = await erpRequest('DELETE', `${baseUrl}/resource/${encodeURIComponent(inputs.doctype)}/${encodeURIComponent(inputs.name)}`, headers);
                return { output: { deleted: true, message: data?.message ?? 'ok' } };
            }

            case 'runReport': {
                if (!inputs.reportName) return { error: 'Missing required input: reportName' };
                const params = new URLSearchParams({
                    report_name: inputs.reportName,
                });
                if (inputs.filters) params.set('filters', JSON.stringify(inputs.filters));
                const data = await erpRequest('GET', `${baseUrl}/method/frappe.desk.query_report.run?${params}`, headers);
                return { output: { report: data?.message ?? data, columns: data?.message?.columns, result: data?.message?.result } };
            }

            case 'callMethod': {
                if (!inputs.method) return { error: 'Missing required input: method' };
                const data = await erpRequest('POST', `${baseUrl}/method/${inputs.method}`, headers, inputs.params ?? {});
                return { output: { result: data?.message ?? data } };
            }

            case 'listDoctypes': {
                const params = new URLSearchParams({
                    fields: JSON.stringify(['name', 'module', 'issingle', 'istable']),
                    limit_page_length: String(inputs.limit ?? 100),
                });
                if (inputs.module) params.set('filters', JSON.stringify([['DocType', 'module', '=', inputs.module]]));
                const data = await erpRequest('GET', `${baseUrl}/resource/DocType?${params}`, headers);
                return { output: { doctypes: data?.data ?? [], count: (data?.data ?? []).length } };
            }

            case 'getDoctype': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                const data = await erpRequest('GET', `${baseUrl}/resource/DocType/${encodeURIComponent(inputs.doctype)}`, headers);
                return { output: { doctype: data?.data ?? data } };
            }

            case 'searchDocuments': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.searchTerm) return { error: 'Missing required input: searchTerm' };
                const params = new URLSearchParams({
                    txt: inputs.searchTerm,
                    doctype: inputs.doctype,
                    ignore_user_permissions: '0',
                    reference_doctype: inputs.referenceDoctype ?? '',
                    page_length: String(inputs.limit ?? 20),
                });
                const data = await erpRequest('GET', `${baseUrl}/method/frappe.desk.search.search_link?${params}`, headers);
                return { output: { results: data?.results ?? data?.message ?? [] } };
            }

            case 'bulkCreate': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.documents || !Array.isArray(inputs.documents)) return { error: 'Missing required input: documents (array)' };
                const results: any[] = [];
                for (const doc of inputs.documents) {
                    const payload = { doctype: inputs.doctype, ...doc };
                    const data = await erpRequest('POST', `${baseUrl}/resource/${encodeURIComponent(inputs.doctype)}`, headers, payload);
                    results.push(data?.data ?? data);
                }
                return { output: { created: results, count: results.length } };
            }

            case 'bulkUpdate': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.documents || !Array.isArray(inputs.documents)) return { error: 'Missing required input: documents (array of {name, ...fields})' };
                const results: any[] = [];
                for (const doc of inputs.documents) {
                    const { name, ...fields } = doc;
                    if (!name) continue;
                    const data = await erpRequest('PUT', `${baseUrl}/resource/${encodeURIComponent(inputs.doctype)}/${encodeURIComponent(name)}`, headers, fields);
                    results.push(data?.data ?? data);
                }
                return { output: { updated: results, count: results.length } };
            }

            case 'submitDocument': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.name) return { error: 'Missing required input: name' };
                const data = await erpRequest('POST', `${baseUrl}/method/frappe.client.submit`, headers, {
                    doc: { doctype: inputs.doctype, name: inputs.name },
                });
                return { output: { submitted: true, result: data?.message ?? data } };
            }

            case 'cancelDocument': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                if (!inputs.name) return { error: 'Missing required input: name' };
                const data = await erpRequest('POST', `${baseUrl}/method/frappe.client.cancel`, headers, {
                    doctype: inputs.doctype,
                    name: inputs.name,
                });
                return { output: { cancelled: true, result: data?.message ?? data } };
            }

            case 'getFields': {
                if (!inputs.doctype) return { error: 'Missing required input: doctype' };
                const params = new URLSearchParams({
                    fields: JSON.stringify(['name', 'fieldname', 'fieldtype', 'label', 'reqd', 'in_list_view']),
                    filters: JSON.stringify([['DocField', 'parent', '=', inputs.doctype]]),
                    limit_page_length: String(inputs.limit ?? 200),
                });
                const data = await erpRequest('GET', `${baseUrl}/resource/DocField?${params}`, headers);
                return { output: { fields: data?.data ?? [] } };
            }

            default:
                return { error: `ERPNext action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`ERPNext action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown ERPNext error' };
    }
}

// Backward-compatible alias for existing references
export const executeErpnextAction = executeErpNextAction;
