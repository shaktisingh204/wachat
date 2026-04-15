
'use server';

const TYPEFORM_BASE = 'https://api.typeform.com';

async function typeformFetch(
    token: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Typeform] ${method} ${path}`);
    const url = `${TYPEFORM_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!res.ok) {
        throw new Error(data?.description || data?.message || `Typeform API error: ${res.status}`);
    }
    return data;
}

export async function executeTypeformAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');

        const tf = (method: string, path: string, body?: any) =>
            typeformFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listForms': {
                const pageSize = Number(inputs.pageSize ?? 10);
                const search = String(inputs.search ?? '').trim();
                let path = `/forms?page_size=${pageSize}`;
                if (search) path += `&search=${encodeURIComponent(search)}`;
                const data = await tf('GET', path);
                const items = data.items ?? [];
                return { output: { forms: items, count: String(data.total_items ?? items.length), pageCount: String(data.page_count ?? 1) } };
            }

            case 'getForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await tf('GET', `/forms/${formId}`);
                return { output: { id: data.id ?? '', title: data.title ?? '', fields: data.fields ?? [], theme: data.theme ?? {} } };
            }

            case 'createForm': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                let fields: any[] = [];
                if (inputs.fields) {
                    try { fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields; } catch { fields = []; }
                }
                const data = await tf('POST', '/forms', { title, fields });
                return { output: { id: data.id ?? '', title: data.title ?? '', created: 'true' } };
            }

            case 'updateForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const body: any = {};
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.fields) {
                    try { body.fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields; } catch { /* ignore */ }
                }
                const data = await tf('PUT', `/forms/${formId}`, body);
                return { output: { id: data.id ?? formId, title: data.title ?? '', updated: 'true' } };
            }

            case 'deleteForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                await tf('DELETE', `/forms/${formId}`);
                return { output: { deleted: 'true', formId } };
            }

            case 'getResponses': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const pageSize = Number(inputs.pageSize ?? 25);
                let path = `/forms/${formId}/responses?page_size=${pageSize}`;
                if (inputs.since) path += `&since=${encodeURIComponent(String(inputs.since))}`;
                if (inputs.until) path += `&until=${encodeURIComponent(String(inputs.until))}`;
                if (inputs.query) path += `&query=${encodeURIComponent(String(inputs.query))}`;
                const data = await tf('GET', path);
                const items = data.items ?? [];
                return { output: { responses: items, count: String(data.total_items ?? items.length) } };
            }

            case 'getResponse': {
                const formId = String(inputs.formId ?? '').trim();
                const responseId = String(inputs.responseId ?? '').trim();
                if (!formId || !responseId) throw new Error('formId and responseId are required.');
                const data = await tf('GET', `/forms/${formId}/responses?included_response_ids=${responseId}`);
                const items = data.items ?? [];
                return { output: { response: items[0] ?? {}, found: String(items.length > 0) } };
            }

            case 'deleteResponse': {
                const formId = String(inputs.formId ?? '').trim();
                const responseId = String(inputs.responseId ?? '').trim();
                if (!formId || !responseId) throw new Error('formId and responseId are required.');
                await tf('DELETE', `/forms/${formId}/responses?included_response_ids=${responseId}`);
                return { output: { deleted: 'true', responseId } };
            }

            case 'getInsights': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await tf('GET', `/insights/${formId}/summary`);
                return {
                    output: {
                        totalResponses: String(data.responses ?? 0),
                        completionRate: String(data.completion_rate ?? 0),
                        averageTime: String(data.average_time ?? 0),
                        summary: data,
                    },
                };
            }

            case 'createWebhook': {
                const formId = String(inputs.formId ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!formId || !tag || !url) throw new Error('formId, tag, and url are required.');
                const enabled = inputs.enabled !== undefined ? Boolean(inputs.enabled) : true;
                const verifySSL = inputs.verifySSL !== undefined ? Boolean(inputs.verifySSL) : true;
                const data = await tf('PUT', `/forms/${formId}/webhooks/${tag}`, { url, enabled, verify_ssl: verifySSL });
                return { output: { tag: data.tag ?? tag, url: data.url ?? url, enabled: String(data.enabled ?? enabled) } };
            }

            case 'getWebhooks': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await tf('GET', `/forms/${formId}/webhooks`);
                const items = data.items ?? [];
                return { output: { webhooks: items, count: String(items.length) } };
            }

            case 'deleteWebhook': {
                const formId = String(inputs.formId ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                if (!formId || !tag) throw new Error('formId and tag are required.');
                await tf('DELETE', `/forms/${formId}/webhooks/${tag}`);
                return { output: { deleted: 'true', tag } };
            }

            default:
                return { error: `Typeform action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Typeform action failed.' };
    }
}
