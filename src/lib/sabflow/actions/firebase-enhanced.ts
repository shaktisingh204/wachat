'use server';

export async function executeFirebaseEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://firestore.googleapis.com/v1';

    function getAuthHeader(): string {
        if (inputs.idToken) return `Bearer ${inputs.idToken}`;
        if (inputs.serviceAccountKey) {
            // For service account, use the access_token field if already exchanged
            const sak = typeof inputs.serviceAccountKey === 'string'
                ? JSON.parse(inputs.serviceAccountKey)
                : inputs.serviceAccountKey;
            if (sak.access_token) return `Bearer ${sak.access_token}`;
        }
        return `Bearer ${inputs.idToken || ''}`;
    }

    const authHeader = getAuthHeader();
    const projectId = inputs.projectId;

    try {
        switch (actionName) {
            case 'getDocument': {
                const { collection, documentId } = inputs;
                if (!projectId || !collection || !documentId) return { error: 'projectId, collection and documentId are required' };
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents/${collection}/${documentId}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to get document' };
                return { output: data };
            }

            case 'listDocuments': {
                const { collection } = inputs;
                if (!projectId || !collection) return { error: 'projectId and collection are required' };
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.orderBy) params.set('orderBy', inputs.orderBy);
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents/${collection}?${params}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list documents' };
                return { output: data };
            }

            case 'createDocument': {
                const { collection, documentId, fields } = inputs;
                if (!projectId || !collection || !fields) return { error: 'projectId, collection and fields are required' };
                const params = new URLSearchParams();
                if (documentId) params.set('documentId', documentId);
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents/${collection}?${params}`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create document' };
                return { output: data };
            }

            case 'updateDocument': {
                const { collection, documentId, fields, updateMask } = inputs;
                if (!projectId || !collection || !documentId || !fields) return { error: 'projectId, collection, documentId and fields are required' };
                const params = new URLSearchParams();
                if (updateMask) {
                    const masks = Array.isArray(updateMask) ? updateMask : [updateMask];
                    masks.forEach((m: string) => params.append('updateMask.fieldPaths', m));
                }
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents/${collection}/${documentId}?${params}`, {
                    method: 'PATCH',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to update document' };
                return { output: data };
            }

            case 'deleteDocument': {
                const { collection, documentId } = inputs;
                if (!projectId || !collection || !documentId) return { error: 'projectId, collection and documentId are required' };
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents/${collection}/${documentId}`, {
                    method: 'DELETE',
                    headers: { Authorization: authHeader },
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'Failed to delete document' };
                }
                return { output: { success: true, deleted: `${collection}/${documentId}` } };
            }

            case 'runQuery': {
                const { structuredQuery } = inputs;
                if (!projectId || !structuredQuery) return { error: 'projectId and structuredQuery are required' };
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents:runQuery`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ structuredQuery }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to run query' };
                return { output: data };
            }

            case 'listCollections': {
                const { documentPath } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const docPath = documentPath ? `/${documentPath}` : '';
                const body: any = {};
                if (inputs.pageSize) body.pageSize = inputs.pageSize;
                if (inputs.pageToken) body.pageToken = inputs.pageToken;
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents${docPath}:listCollectionIds`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list collections' };
                return { output: data };
            }

            case 'batchGet': {
                const { documents } = inputs;
                if (!projectId || !documents) return { error: 'projectId and documents are required' };
                const docRefs = Array.isArray(documents) ? documents : [documents];
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents:batchGet`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ documents: docRefs }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to batch get documents' };
                return { output: data };
            }

            case 'batchWrite': {
                const { writes } = inputs;
                if (!projectId || !writes) return { error: 'projectId and writes are required' };
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents:batchWrite`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ writes }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to batch write' };
                return { output: data };
            }

            case 'createIndex': {
                const { collectionId, fields } = inputs;
                if (!projectId || !collectionId || !fields) return { error: 'projectId, collectionId and fields are required' };
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/collectionGroups/${collectionId}/indexes`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queryScope: inputs.queryScope || 'COLLECTION', fields }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to create index' };
                return { output: data };
            }

            case 'listIndexes': {
                const { collectionId } = inputs;
                if (!projectId || !collectionId) return { error: 'projectId and collectionId are required' };
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/collectionGroups/${collectionId}/indexes`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to list indexes' };
                return { output: data };
            }

            case 'deleteIndex': {
                const { collectionId, indexId } = inputs;
                if (!projectId || !collectionId || !indexId) return { error: 'projectId, collectionId and indexId are required' };
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/collectionGroups/${collectionId}/indexes/${indexId}`, {
                    method: 'DELETE',
                    headers: { Authorization: authHeader },
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'Failed to delete index' };
                }
                return { output: { success: true } };
            }

            case 'runTransaction': {
                const { writes, transaction } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const body: any = {};
                if (writes) body.writes = writes;
                if (transaction) body.transaction = transaction;
                const res = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents:commit`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to run transaction' };
                return { output: data };
            }

            case 'importDocuments': {
                const { inputUriPrefix, collectionIds } = inputs;
                if (!projectId || !inputUriPrefix) return { error: 'projectId and inputUriPrefix are required' };
                const body: any = { inputUriPrefix };
                if (collectionIds) body.collectionIds = Array.isArray(collectionIds) ? collectionIds : [collectionIds];
                const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):importDocuments`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to import documents' };
                return { output: data };
            }

            case 'exportDocuments': {
                const { outputUriPrefix, collectionIds } = inputs;
                if (!projectId || !outputUriPrefix) return { error: 'projectId and outputUriPrefix are required' };
                const body: any = { outputUriPrefix };
                if (collectionIds) body.collectionIds = Array.isArray(collectionIds) ? collectionIds : [collectionIds];
                const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'Failed to export documents' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Firebase Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Firebase Enhanced action' };
    }
}
