'use server';

export async function executeMeiliSearchEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const host = (inputs.host || '').replace(/\/$/, '');
    if (!host) return { error: 'host is required' };

    const apiKey = inputs.apiKey;
    const authHeader = `Bearer ${apiKey}`;

    try {
        switch (actionName) {
            case 'search': {
                const { indexUid, q } = inputs;
                if (!indexUid) return { error: 'indexUid is required' };
                const body: any = { q: q || '' };
                if (inputs.limit !== undefined) body.limit = inputs.limit;
                if (inputs.offset !== undefined) body.offset = inputs.offset;
                if (inputs.filter) body.filter = inputs.filter;
                if (inputs.facets) body.facets = inputs.facets;
                if (inputs.attributesToRetrieve) body.attributesToRetrieve = inputs.attributesToRetrieve;
                if (inputs.attributesToHighlight) body.attributesToHighlight = inputs.attributesToHighlight;
                if (inputs.sort) body.sort = inputs.sort;
                const res = await fetch(`${host}/indexes/${indexUid}/search`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Search failed' };
                return { output: data };
            }

            case 'multiSearch': {
                const { queries } = inputs;
                if (!queries) return { error: 'queries array is required' };
                const res = await fetch(`${host}/multi-search`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queries: Array.isArray(queries) ? queries : [queries] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Multi-search failed' };
                return { output: data };
            }

            case 'listIndexes': {
                const params = new URLSearchParams();
                if (inputs.offset !== undefined) params.set('offset', String(inputs.offset));
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                const res = await fetch(`${host}/indexes?${params}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to list indexes' };
                return { output: data };
            }

            case 'getIndex': {
                const { indexUid } = inputs;
                if (!indexUid) return { error: 'indexUid is required' };
                const res = await fetch(`${host}/indexes/${indexUid}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to get index' };
                return { output: data };
            }

            case 'createIndex': {
                const { uid, primaryKey } = inputs;
                if (!uid) return { error: 'uid is required' };
                const body: any = { uid };
                if (primaryKey) body.primaryKey = primaryKey;
                const res = await fetch(`${host}/indexes`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to create index' };
                return { output: data };
            }

            case 'updateIndex': {
                const { indexUid, primaryKey } = inputs;
                if (!indexUid) return { error: 'indexUid is required' };
                const res = await fetch(`${host}/indexes/${indexUid}`, {
                    method: 'PATCH',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ primaryKey }),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to update index' };
                return { output: data };
            }

            case 'deleteIndex': {
                const { indexUid } = inputs;
                if (!indexUid) return { error: 'indexUid is required' };
                const res = await fetch(`${host}/indexes/${indexUid}`, {
                    method: 'DELETE',
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to delete index' };
                return { output: data };
            }

            case 'listDocuments': {
                const { indexUid } = inputs;
                if (!indexUid) return { error: 'indexUid is required' };
                const params = new URLSearchParams();
                if (inputs.offset !== undefined) params.set('offset', String(inputs.offset));
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                if (inputs.fields) params.set('fields', inputs.fields);
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${host}/indexes/${indexUid}/documents?${params}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to list documents' };
                return { output: data };
            }

            case 'getDocument': {
                const { indexUid, documentId } = inputs;
                if (!indexUid || !documentId) return { error: 'indexUid and documentId are required' };
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                const res = await fetch(`${host}/indexes/${indexUid}/documents/${documentId}?${params}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to get document' };
                return { output: data };
            }

            case 'addDocuments': {
                const { indexUid, documents, primaryKey } = inputs;
                if (!indexUid || !documents) return { error: 'indexUid and documents are required' };
                const params = new URLSearchParams();
                if (primaryKey) params.set('primaryKey', primaryKey);
                const docs = Array.isArray(documents) ? documents : [documents];
                const res = await fetch(`${host}/indexes/${indexUid}/documents?${params}`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(docs),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to add documents' };
                return { output: data };
            }

            case 'updateDocuments': {
                const { indexUid, documents, primaryKey } = inputs;
                if (!indexUid || !documents) return { error: 'indexUid and documents are required' };
                const params = new URLSearchParams();
                if (primaryKey) params.set('primaryKey', primaryKey);
                const docs = Array.isArray(documents) ? documents : [documents];
                const res = await fetch(`${host}/indexes/${indexUid}/documents?${params}`, {
                    method: 'PUT',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(docs),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to update documents' };
                return { output: data };
            }

            case 'deleteDocument': {
                const { indexUid, documentId } = inputs;
                if (!indexUid || !documentId) return { error: 'indexUid and documentId are required' };
                const res = await fetch(`${host}/indexes/${indexUid}/documents/${documentId}`, {
                    method: 'DELETE',
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to delete document' };
                return { output: data };
            }

            case 'deleteAllDocuments': {
                const { indexUid } = inputs;
                if (!indexUid) return { error: 'indexUid is required' };
                const res = await fetch(`${host}/indexes/${indexUid}/documents`, {
                    method: 'DELETE',
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to delete all documents' };
                return { output: data };
            }

            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                if (inputs.from !== undefined) params.set('from', String(inputs.from));
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.indexUids) params.set('indexUids', inputs.indexUids);
                const res = await fetch(`${host}/tasks?${params}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to list tasks' };
                return { output: data };
            }

            case 'getTask': {
                const { taskUid } = inputs;
                if (!taskUid) return { error: 'taskUid is required' };
                const res = await fetch(`${host}/tasks/${taskUid}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'Failed to get task' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`MeiliSearch Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in MeiliSearch Enhanced action' };
    }
}
