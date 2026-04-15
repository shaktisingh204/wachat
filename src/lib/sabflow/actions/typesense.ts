'use server';

export async function executeTypesenseAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');
        const apiKey = inputs.apiKey || '';
        const headers: Record<string, string> = {
            'X-TYPESENSE-API-KEY': apiKey,
            'Content-Type': 'application/json',
        };

        const doFetch = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.message || data || `HTTP ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listCollections': {
                const data = await doFetch('GET', '/collections');
                return { output: { collections: data } };
            }
            case 'getCollection': {
                const data = await doFetch('GET', `/collections/${inputs.collectionName}`);
                return { output: { collection: data } };
            }
            case 'createCollection': {
                const schema = typeof inputs.schema === 'string' ? JSON.parse(inputs.schema) : inputs.schema;
                const data = await doFetch('POST', '/collections', schema);
                return { output: { collection: data } };
            }
            case 'deleteCollection': {
                const data = await doFetch('DELETE', `/collections/${inputs.collectionName}`);
                return { output: { deleted: data } };
            }
            case 'indexDocument': {
                const doc = typeof inputs.document === 'string' ? JSON.parse(inputs.document) : inputs.document;
                const action = inputs.action || 'create';
                const data = await doFetch('POST', `/collections/${inputs.collectionName}/documents?action=${action}`, doc);
                return { output: { document: data } };
            }
            case 'getDocument': {
                const data = await doFetch('GET', `/collections/${inputs.collectionName}/documents/${inputs.documentId}`);
                return { output: { document: data } };
            }
            case 'updateDocument': {
                const doc = typeof inputs.document === 'string' ? JSON.parse(inputs.document) : inputs.document;
                const data = await doFetch('PATCH', `/collections/${inputs.collectionName}/documents/${inputs.documentId}`, doc);
                return { output: { document: data } };
            }
            case 'deleteDocument': {
                const data = await doFetch('DELETE', `/collections/${inputs.collectionName}/documents/${inputs.documentId}`);
                return { output: { deleted: data } };
            }
            case 'searchDocuments': {
                const params = new URLSearchParams({
                    q: inputs.q || '*',
                    query_by: inputs.queryBy || 'id',
                    ...(inputs.filterBy ? { filter_by: inputs.filterBy } : {}),
                    ...(inputs.sortBy ? { sort_by: inputs.sortBy } : {}),
                    ...(inputs.page ? { page: String(inputs.page) } : {}),
                    ...(inputs.perPage ? { per_page: String(inputs.perPage) } : {}),
                });
                const data = await doFetch('GET', `/collections/${inputs.collectionName}/documents/search?${params}`);
                return { output: { results: data } };
            }
            case 'importDocuments': {
                const docs = typeof inputs.documents === 'string' ? inputs.documents : inputs.documents.map((d: any) => JSON.stringify(d)).join('\n');
                const action = inputs.action || 'create';
                const data = await doFetch('POST', `/collections/${inputs.collectionName}/documents/import?action=${action}`, docs);
                return { output: { result: data } };
            }
            case 'exportDocuments': {
                const params = new URLSearchParams({
                    ...(inputs.filterBy ? { filter_by: inputs.filterBy } : {}),
                    ...(inputs.includeFields ? { include_fields: inputs.includeFields } : {}),
                });
                const data = await doFetch('GET', `/collections/${inputs.collectionName}/documents/export?${params}`);
                return { output: { documents: data } };
            }
            case 'listAliases': {
                const data = await doFetch('GET', '/aliases');
                return { output: { aliases: data } };
            }
            case 'createAlias': {
                const data = await doFetch('PUT', `/aliases/${inputs.aliasName}`, { collection_name: inputs.collectionName });
                return { output: { alias: data } };
            }
            case 'deleteAlias': {
                const data = await doFetch('DELETE', `/aliases/${inputs.aliasName}`);
                return { output: { deleted: data } };
            }
            case 'getHealth': {
                const data = await doFetch('GET', '/health');
                return { output: { health: data } };
            }
            default:
                return { error: `Unknown Typesense action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Typesense action error [${actionName}]: ${err.message}`);
        return { error: err.message || String(err) };
    }
}
