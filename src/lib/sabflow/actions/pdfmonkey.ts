
'use server';

const PDFMONKEY_BASE = 'https://api.pdfmonkey.io/api/v1';

async function pdfmonkeyFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    const url = `${PDFMONKEY_BASE}${path}`;
    logger?.log(`[PDFMonkey] ${method} ${url}`);
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.errors?.[0]?.detail || data?.error || data?.message || text || `PDFMonkey API error ${res.status}`);
    return data;
}

/** Poll a document until its status is terminal (success / error) or timeout. */
async function pollDocument(apiKey: string, documentId: string, logger?: any, maxWaitMs = 60000, intervalMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        const data = await pdfmonkeyFetch(apiKey, 'GET', `/documents/${encodeURIComponent(documentId)}`, undefined, logger);
        const status = data?.document?.status ?? data?.status;
        if (status === 'success' || status === 'error' || status === 'failure') return data;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`Document ${documentId} did not reach terminal status within ${maxWaitMs / 1000}s.`);
}

export async function executePdfMonkeyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const get = (path: string) => pdfmonkeyFetch(apiKey, 'GET', path, undefined, logger);
        const post = (path: string, body: any) => pdfmonkeyFetch(apiKey, 'POST', path, body, logger);
        const del = (path: string) => pdfmonkeyFetch(apiKey, 'DELETE', path, undefined, logger);

        switch (actionName) {
            case 'generateDocument': {
                const templateId = String(inputs.templateId ?? inputs.document_template_id ?? '').trim();
                if (!templateId) throw new Error('templateId is required.');
                const payload = inputs.payload ?? inputs.data ?? {};
                const body = {
                    document: {
                        document_template_id: templateId,
                        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
                        status: 'pending',
                        ...(inputs.meta ? { meta: inputs.meta } : {}),
                        ...(inputs.filename ? { filename: inputs.filename } : {}),
                    },
                };
                const data = await post('/documents', body);
                return { output: data };
            }

            case 'getDocument': {
                const id = String(inputs.id ?? inputs.documentId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/documents/${encodeURIComponent(id)}`);
                return { output: data };
            }

            case 'listDocuments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.status) params.set('q[status_eq]', String(inputs.status));
                const qs = params.toString();
                const data = await get(`/documents${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'deleteDocument': {
                const id = String(inputs.id ?? inputs.documentId ?? '').trim();
                if (!id) throw new Error('id is required.');
                await del(`/documents/${encodeURIComponent(id)}`);
                return { output: { success: true, id } };
            }

            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const qs = params.toString();
                const data = await get(`/document_templates${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'getTemplate': {
                const id = String(inputs.id ?? inputs.templateId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/document_templates/${encodeURIComponent(id)}`);
                return { output: data };
            }

            case 'previewDocument': {
                const id = String(inputs.id ?? inputs.documentId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/documents/${encodeURIComponent(id)}/preview_url`);
                return { output: data };
            }

            case 'downloadDocument': {
                const id = String(inputs.id ?? inputs.documentId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/documents/${encodeURIComponent(id)}`);
                const downloadUrl = data?.document?.download_url ?? data?.download_url;
                return { output: { downloadUrl, ...data } };
            }

            case 'getDocumentStatus': {
                const id = String(inputs.id ?? inputs.documentId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/documents/${encodeURIComponent(id)}`);
                const status = data?.document?.status ?? data?.status;
                return { output: { status, ...data } };
            }

            case 'generateAndWait': {
                const templateId = String(inputs.templateId ?? inputs.document_template_id ?? '').trim();
                if (!templateId) throw new Error('templateId is required.');
                const payload = inputs.payload ?? inputs.data ?? {};
                const createBody = {
                    document: {
                        document_template_id: templateId,
                        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
                        status: 'pending',
                        ...(inputs.meta ? { meta: inputs.meta } : {}),
                        ...(inputs.filename ? { filename: inputs.filename } : {}),
                    },
                };
                const created = await post('/documents', createBody);
                const documentId = created?.document?.id ?? created?.id;
                if (!documentId) throw new Error('Failed to get document ID from creation response.');
                const maxWaitMs = inputs.timeoutMs ? Number(inputs.timeoutMs) : 60000;
                const finalData = await pollDocument(apiKey, documentId, logger, maxWaitMs);
                const status = finalData?.document?.status ?? finalData?.status;
                if (status === 'error' || status === 'failure') {
                    throw new Error(`Document generation failed with status: ${status}.`);
                }
                return { output: finalData };
            }

            default:
                return { error: `PDFMonkey action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'PDFMonkey action failed.' };
    }
}
