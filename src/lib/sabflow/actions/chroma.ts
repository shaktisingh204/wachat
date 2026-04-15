'use server';

export async function executeChromaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    const baseUrl = (inputs.chromaUrl || 'http://localhost:8000').replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (inputs.apiKey) {
        headers['Authorization'] = `Bearer ${inputs.apiKey}`;
    }

    try {
        switch (actionName) {
            case 'listCollections': {
                const res = await fetch(`${baseUrl}/api/v1/collections`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { collections: data } };
            }

            case 'getCollection': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionName}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'createCollection': {
                const res = await fetch(`${baseUrl}/api/v1/collections`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.collectionName,
                        metadata: inputs.metadata || {},
                        get_or_create: inputs.getOrCreate ?? false,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'updateCollection': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        new_name: inputs.newName,
                        new_metadata: inputs.newMetadata,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'deleteCollection': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionName}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                }
                return { output: { success: true, collectionName: inputs.collectionName } };
            }

            case 'addDocuments': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionId}/add`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ids: inputs.ids,
                        embeddings: inputs.embeddings,
                        documents: inputs.documents,
                        metadatas: inputs.metadatas,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'queryDocuments': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionId}/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query_embeddings: inputs.queryEmbeddings,
                        query_texts: inputs.queryTexts,
                        n_results: inputs.nResults || 10,
                        where: inputs.where,
                        where_document: inputs.whereDocument,
                        include: inputs.include || ['documents', 'metadatas', 'distances'],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'getDocuments': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionId}/get`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ids: inputs.ids,
                        where: inputs.where,
                        limit: inputs.limit,
                        offset: inputs.offset,
                        include: inputs.include || ['documents', 'metadatas'],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'updateDocuments': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionId}/update`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ids: inputs.ids,
                        embeddings: inputs.embeddings,
                        documents: inputs.documents,
                        metadatas: inputs.metadatas,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'deleteDocuments': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionId}/delete`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ids: inputs.ids,
                        where: inputs.where,
                        where_document: inputs.whereDocument,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { deleted: data } };
            }

            case 'countDocuments': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionId}/count`, {
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { count: data } };
            }

            case 'getCollectionInfo': {
                const res = await fetch(`${baseUrl}/api/v1/collections/${inputs.collectionName}`, {
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { id: data.id, name: data.name, metadata: data.metadata } };
            }

            case 'heartbeat': {
                const res = await fetch(`${baseUrl}/api/v1/heartbeat`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { alive: true, nanosecondHeartbeat: data['nanosecond heartbeat'] } };
            }

            case 'getVersion': {
                const res = await fetch(`${baseUrl}/api/v1/version`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { version: data } };
            }

            case 'resetDatabase': {
                const res = await fetch(`${baseUrl}/api/v1/reset`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
                return { output: { success: data } };
            }

            default:
                return { error: `Unknown action "${actionName}" for chroma.` };
        }
    } catch (err: any) {
        logger.log(`Chroma error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Chroma action failed.' };
    }
}
