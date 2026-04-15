
'use server';

async function outlineFetch(baseUrl: string, apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Outline] ${method} ${path}`);
    const cleanBase = baseUrl.replace(/\/$/, '');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${cleanBase}/api${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Outline API error: ${res.status}`);
    }
    return data;
}

export async function executeOutlineAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!baseUrl) throw new Error('baseUrl is required (e.g. https://app.getoutline.com).');
        if (!apiToken) throw new Error('apiToken is required.');
        const ol = (method: string, path: string, body?: any) => outlineFetch(baseUrl, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'searchDocuments': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const payload: any = { query };
                if (inputs.collectionId) payload.collectionId = String(inputs.collectionId);
                if (inputs.limit) payload.limit = Number(inputs.limit);
                const data = await ol('POST', '/documents.search', payload);
                return { output: { count: String(data.data?.length ?? 0), results: JSON.stringify(data.data ?? []) } };
            }

            case 'getDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ol('POST', '/documents.info', { id });
                const doc = data.data ?? {};
                return { output: { id: doc.id ?? '', title: doc.title ?? '', text: doc.text ?? '', url: doc.url ?? '', updatedAt: String(doc.updatedAt ?? '') } };
            }

            case 'createDocument': {
                const title = String(inputs.title ?? '').trim();
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!collectionId) throw new Error('collectionId is required.');
                const payload: any = { title, collectionId };
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.publish !== undefined) payload.publish = inputs.publish === true || inputs.publish === 'true';
                if (inputs.parentDocumentId) payload.parentDocumentId = String(inputs.parentDocumentId);
                const data = await ol('POST', '/documents.create', payload);
                const doc = data.data ?? {};
                return { output: { id: doc.id ?? '', title: doc.title ?? title, url: doc.url ?? '' } };
            }

            case 'updateDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const payload: any = { id };
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.publish !== undefined) payload.publish = inputs.publish === true || inputs.publish === 'true';
                const data = await ol('POST', '/documents.update', payload);
                const doc = data.data ?? {};
                return { output: { id: doc.id ?? id, title: doc.title ?? '', url: doc.url ?? '' } };
            }

            case 'deleteDocument': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await ol('POST', '/documents.delete', { id });
                return { output: { success: 'true', id } };
            }

            case 'listCollections': {
                const payload: any = {};
                if (inputs.limit) payload.limit = Number(inputs.limit);
                if (inputs.offset) payload.offset = Number(inputs.offset);
                const data = await ol('POST', '/collections.list', payload);
                const cols = data.data ?? [];
                return { output: { count: String(cols.length), collections: JSON.stringify(cols) } };
            }

            case 'listDocuments': {
                const collectionId = String(inputs.collectionId ?? '').trim();
                const payload: any = {};
                if (collectionId) payload.collectionId = collectionId;
                if (inputs.limit) payload.limit = Number(inputs.limit);
                if (inputs.offset) payload.offset = Number(inputs.offset);
                const data = await ol('POST', '/documents.list', payload);
                const docs = data.data ?? [];
                return { output: { count: String(docs.length), documents: JSON.stringify(docs) } };
            }

            default:
                return { error: `Outline action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Outline action failed.' };
    }
}
