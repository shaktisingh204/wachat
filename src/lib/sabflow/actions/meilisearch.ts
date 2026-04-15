'use server';

export async function executeMeilisearchAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || 'http://localhost:7700').replace(/\/$/, '');
        const masterKey = inputs.masterKey || '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(masterKey ? { Authorization: `Bearer ${masterKey}` } : {}),
        };

        const doFetch = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.message || data || `HTTP ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listIndexes': {
                const data = await doFetch('GET', '/indexes');
                return { output: { indexes: data } };
            }
            case 'getIndex': {
                const data = await doFetch('GET', `/indexes/${inputs.indexUid}`);
                return { output: { index: data } };
            }
            case 'createIndex': {
                const data = await doFetch('POST', '/indexes', {
                    uid: inputs.indexUid,
                    ...(inputs.primaryKey ? { primaryKey: inputs.primaryKey } : {}),
                });
                return { output: { task: data } };
            }
            case 'updateIndex': {
                const data = await doFetch('PATCH', `/indexes/${inputs.indexUid}`, {
                    primaryKey: inputs.primaryKey,
                });
                return { output: { task: data } };
            }
            case 'deleteIndex': {
                const data = await doFetch('DELETE', `/indexes/${inputs.indexUid}`);
                return { output: { task: data } };
            }
            case 'getIndexStats': {
                const data = await doFetch('GET', `/indexes/${inputs.indexUid}/stats`);
                return { output: { stats: data } };
            }
            case 'addDocuments': {
                const docs = typeof inputs.documents === 'string' ? JSON.parse(inputs.documents) : inputs.documents;
                const qs = inputs.primaryKey ? `?primaryKey=${inputs.primaryKey}` : '';
                const data = await doFetch('POST', `/indexes/${inputs.indexUid}/documents${qs}`, docs);
                return { output: { task: data } };
            }
            case 'getDocument': {
                const data = await doFetch('GET', `/indexes/${inputs.indexUid}/documents/${inputs.documentId}`);
                return { output: { document: data } };
            }
            case 'updateDocuments': {
                const docs = typeof inputs.documents === 'string' ? JSON.parse(inputs.documents) : inputs.documents;
                const qs = inputs.primaryKey ? `?primaryKey=${inputs.primaryKey}` : '';
                const data = await doFetch('PUT', `/indexes/${inputs.indexUid}/documents${qs}`, docs);
                return { output: { task: data } };
            }
            case 'deleteDocument': {
                const data = await doFetch('DELETE', `/indexes/${inputs.indexUid}/documents/${inputs.documentId}`);
                return { output: { task: data } };
            }
            case 'deleteAllDocuments': {
                const data = await doFetch('DELETE', `/indexes/${inputs.indexUid}/documents`);
                return { output: { task: data } };
            }
            case 'searchDocuments': {
                const body: any = {
                    q: inputs.q !== undefined ? inputs.q : '',
                    ...(inputs.filter ? { filter: inputs.filter } : {}),
                    ...(inputs.sort ? { sort: inputs.sort } : {}),
                    ...(inputs.limit !== undefined ? { limit: Number(inputs.limit) } : {}),
                    ...(inputs.offset !== undefined ? { offset: Number(inputs.offset) } : {}),
                    ...(inputs.attributesToRetrieve ? { attributesToRetrieve: inputs.attributesToRetrieve } : {}),
                };
                const data = await doFetch('POST', `/indexes/${inputs.indexUid}/search`, body);
                return { output: { results: data } };
            }
            case 'getSearchSettings': {
                const data = await doFetch('GET', `/indexes/${inputs.indexUid}/settings`);
                return { output: { settings: data } };
            }
            case 'updateSearchSettings': {
                const settings = typeof inputs.settings === 'string' ? JSON.parse(inputs.settings) : inputs.settings;
                const data = await doFetch('PATCH', `/indexes/${inputs.indexUid}/settings`, settings);
                return { output: { task: data } };
            }
            case 'resetSearchSettings': {
                const data = await doFetch('DELETE', `/indexes/${inputs.indexUid}/settings`);
                return { output: { task: data } };
            }
            default:
                return { error: `Unknown Meilisearch action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Meilisearch action error [${actionName}]: ${err.message}`);
        return { error: err.message || String(err) };
    }
}
