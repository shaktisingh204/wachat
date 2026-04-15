'use server';

export async function executePineconeEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    const baseUrl = 'https://api.pinecone.io';
    const apiKey = inputs.apiKey;

    try {
        switch (actionName) {
            case 'listIndexes': {
                const res = await fetch(`${baseUrl}/indexes`, {
                    headers: { 'Api-Key': apiKey },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { indexes: data.indexes || data } };
            }

            case 'describeIndex': {
                const res = await fetch(`${baseUrl}/indexes/${inputs.indexName}`, {
                    headers: { 'Api-Key': apiKey },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'createIndex': {
                const res = await fetch(`${baseUrl}/indexes`, {
                    method: 'POST',
                    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.indexName,
                        dimension: inputs.dimension,
                        metric: inputs.metric || 'cosine',
                        spec: inputs.spec || { serverless: { cloud: inputs.cloud || 'aws', region: inputs.region || 'us-east-1' } },
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'deleteIndex': {
                const res = await fetch(`${baseUrl}/indexes/${inputs.indexName}`, {
                    method: 'DELETE',
                    headers: { 'Api-Key': apiKey },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `HTTP ${res.status}`);
                }
                return { output: { success: true, indexName: inputs.indexName } };
            }

            case 'describeIndexStats': {
                const host = inputs.indexHost;
                const res = await fetch(`${host}/describe_index_stats`, {
                    method: 'POST',
                    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.filter ? { filter: inputs.filter } : {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'upsertVectors': {
                const host = inputs.indexHost;
                const res = await fetch(`${host}/vectors/upsert`, {
                    method: 'POST',
                    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vectors: inputs.vectors,
                        namespace: inputs.namespace || '',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { upsertedCount: data.upsertedCount } };
            }

            case 'queryVectors': {
                const host = inputs.indexHost;
                const res = await fetch(`${host}/query`, {
                    method: 'POST',
                    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vector: inputs.vector,
                        topK: inputs.topK || 10,
                        namespace: inputs.namespace || '',
                        includeValues: inputs.includeValues ?? false,
                        includeMetadata: inputs.includeMetadata ?? true,
                        filter: inputs.filter,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { matches: data.matches, namespace: data.namespace } };
            }

            case 'fetchVectors': {
                const host = inputs.indexHost;
                const ids = Array.isArray(inputs.ids) ? inputs.ids : [inputs.ids];
                const params = new URLSearchParams();
                ids.forEach((id: string) => params.append('ids', id));
                if (inputs.namespace) params.append('namespace', inputs.namespace);
                const res = await fetch(`${host}/vectors/fetch?${params.toString()}`, {
                    headers: { 'Api-Key': apiKey },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { vectors: data.vectors, namespace: data.namespace } };
            }

            case 'deleteVectors': {
                const host = inputs.indexHost;
                const res = await fetch(`${host}/vectors/delete`, {
                    method: 'POST',
                    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ids: inputs.ids,
                        namespace: inputs.namespace || '',
                        deleteAll: inputs.deleteAll ?? false,
                        filter: inputs.filter,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'updateVector': {
                const host = inputs.indexHost;
                const res = await fetch(`${host}/vectors/update`, {
                    method: 'POST',
                    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: inputs.id,
                        values: inputs.values,
                        setMetadata: inputs.setMetadata,
                        namespace: inputs.namespace || '',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'listCollections': {
                const res = await fetch(`${baseUrl}/collections`, {
                    headers: { 'Api-Key': apiKey },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { collections: data.collections || data } };
            }

            case 'describeCollection': {
                const res = await fetch(`${baseUrl}/collections/${inputs.collectionName}`, {
                    headers: { 'Api-Key': apiKey },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'createCollection': {
                const res = await fetch(`${baseUrl}/collections`, {
                    method: 'POST',
                    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.collectionName,
                        source: inputs.source,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'deleteCollection': {
                const res = await fetch(`${baseUrl}/collections/${inputs.collectionName}`, {
                    method: 'DELETE',
                    headers: { 'Api-Key': apiKey },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `HTTP ${res.status}`);
                }
                return { output: { success: true, collectionName: inputs.collectionName } };
            }

            case 'listNamespaces': {
                const host = inputs.indexHost;
                const res = await fetch(`${host}/namespaces`, {
                    headers: { 'Api-Key': apiKey },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { namespaces: data.namespaces || data } };
            }

            default:
                return { error: `Unknown action "${actionName}" for pinecone_enhanced.` };
        }
    } catch (err: any) {
        logger.log(`Pinecone Enhanced error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Pinecone Enhanced action failed.' };
    }
}
