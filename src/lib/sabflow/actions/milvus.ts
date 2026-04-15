'use server';

export async function executeMilvusAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    const baseUrl = (inputs.milvusUrl || 'https://cluster.zillizcloud.com').replace(/\/$/, '');
    const token = inputs.token;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    const dbName = inputs.dbName || 'default';

    try {
        switch (actionName) {
            case 'listCollections': {
                const res = await fetch(`${baseUrl}/v2/vectordb/collections/list`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ dbName }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { collections: data.data } };
            }

            case 'describeCollection': {
                const res = await fetch(`${baseUrl}/v2/vectordb/collections/describe`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ collectionName: inputs.collectionName, dbName }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: data.data };
            }

            case 'createCollection': {
                const res = await fetch(`${baseUrl}/v2/vectordb/collections/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        dimension: inputs.dimension,
                        metricType: inputs.metricType || 'COSINE',
                        primaryFieldName: inputs.primaryFieldName || 'id',
                        vectorFieldName: inputs.vectorFieldName || 'vector',
                        schema: inputs.schema,
                        params: inputs.params,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'dropCollection': {
                const res = await fetch(`${baseUrl}/v2/vectordb/collections/drop`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ collectionName: inputs.collectionName, dbName }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'insertVectors': {
                const res = await fetch(`${baseUrl}/v2/vectordb/entities/insert`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        data: inputs.data,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { insertCount: data.data?.insertCount, insertIds: data.data?.insertIds } };
            }

            case 'searchVectors': {
                const res = await fetch(`${baseUrl}/v2/vectordb/entities/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        data: inputs.vectors,
                        annsField: inputs.annsField || 'vector',
                        limit: inputs.limit || 10,
                        offset: inputs.offset || 0,
                        filter: inputs.filter,
                        outputFields: inputs.outputFields,
                        searchParams: inputs.searchParams,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { results: data.data } };
            }

            case 'queryVectors': {
                const res = await fetch(`${baseUrl}/v2/vectordb/entities/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        filter: inputs.filter || '',
                        outputFields: inputs.outputFields,
                        limit: inputs.limit || 100,
                        offset: inputs.offset || 0,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { data: data.data } };
            }

            case 'deleteVectors': {
                const res = await fetch(`${baseUrl}/v2/vectordb/entities/delete`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        filter: inputs.filter,
                        ids: inputs.ids,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { deleteCount: data.data?.deleteCount } };
            }

            case 'upsertVectors': {
                const res = await fetch(`${baseUrl}/v2/vectordb/entities/upsert`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        data: inputs.data,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { upsertCount: data.data?.upsertCount, upsertIds: data.data?.upsertIds } };
            }

            case 'loadCollection': {
                const res = await fetch(`${baseUrl}/v2/vectordb/collections/load`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ collectionName: inputs.collectionName, dbName }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'releaseCollection': {
                const res = await fetch(`${baseUrl}/v2/vectordb/collections/release`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ collectionName: inputs.collectionName, dbName }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'createIndex': {
                const res = await fetch(`${baseUrl}/v2/vectordb/indexes/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        fieldName: inputs.fieldName || 'vector',
                        indexName: inputs.indexName,
                        metricType: inputs.metricType || 'COSINE',
                        indexType: inputs.indexType || 'AUTOINDEX',
                        params: inputs.params,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'dropIndex': {
                const res = await fetch(`${baseUrl}/v2/vectordb/indexes/drop`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        indexName: inputs.indexName,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { success: true } };
            }

            case 'describeIndex': {
                const res = await fetch(`${baseUrl}/v2/vectordb/indexes/describe`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        collectionName: inputs.collectionName,
                        indexName: inputs.indexName,
                        dbName,
                    }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: data.data };
            }

            case 'getLoadState': {
                const res = await fetch(`${baseUrl}/v2/vectordb/collections/get_load_state`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ collectionName: inputs.collectionName, dbName }),
                });
                const data = await res.json();
                if (!res.ok || data.code !== 0) throw new Error(data?.message || `HTTP ${res.status}`);
                return { output: { loadState: data.data?.loadState, loadProgress: data.data?.loadProgress } };
            }

            default:
                return { error: `Unknown action "${actionName}" for milvus.` };
        }
    } catch (err: any) {
        logger.log(`Milvus error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Milvus action failed.' };
    }
}
