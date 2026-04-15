
'use server';

const PINECONE_CONTROL = 'https://api.pinecone.io';

async function pineconeRequest(
    method: string,
    url: string,
    apiKey: string,
    body?: any
): Promise<any> {
    const res = await fetch(url, {
        method,
        headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.error || text || `HTTP ${res.status}`);
    return data;
}

export async function executePineconeAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('"apiKey" is required.');
        const indexHost = String(inputs.indexHost ?? '').trim();

        switch (actionName) {
            case 'listIndexes': {
                logger.log('[Pinecone] listIndexes');
                const data = await pineconeRequest('GET', `${PINECONE_CONTROL}/indexes`, apiKey);
                return { output: data };
            }

            case 'getIndex': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Pinecone] getIndex: ${name}`);
                const data = await pineconeRequest('GET', `${PINECONE_CONTROL}/indexes/${encodeURIComponent(name)}`, apiKey);
                return { output: data };
            }

            case 'createIndex': {
                const name = String(inputs.name ?? '').trim();
                const dimension = Number(inputs.dimension);
                const metric = String(inputs.metric ?? 'cosine').trim();
                const spec = inputs.spec ?? {};
                if (!name) throw new Error('"name" is required.');
                if (!dimension) throw new Error('"dimension" is required.');
                logger.log(`[Pinecone] createIndex: ${name}`);
                const data = await pineconeRequest('POST', `${PINECONE_CONTROL}/indexes`, apiKey, { name, dimension, metric, spec });
                return { output: data };
            }

            case 'deleteIndex': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Pinecone] deleteIndex: ${name}`);
                await pineconeRequest('DELETE', `${PINECONE_CONTROL}/indexes/${encodeURIComponent(name)}`, apiKey);
                return { output: { success: true, deleted: name } };
            }

            case 'upsert': {
                if (!indexHost) throw new Error('"indexHost" is required.');
                const vectors = inputs.vectors ?? [];
                const namespace = inputs.namespace;
                logger.log(`[Pinecone] upsert ${vectors.length} vectors`);
                const body: any = { vectors };
                if (namespace) body.namespace = namespace;
                const data = await pineconeRequest('POST', `${indexHost}/vectors/upsert`, apiKey, body);
                return { output: data };
            }

            case 'query': {
                if (!indexHost) throw new Error('"indexHost" is required.');
                const vector = inputs.vector;
                const topK = Number(inputs.topK ?? 10);
                const namespace = inputs.namespace;
                const includeMetadata = inputs.includeMetadata !== false;
                if (!vector) throw new Error('"vector" is required.');
                logger.log(`[Pinecone] query topK=${topK}`);
                const body: any = { vector, topK, includeMetadata };
                if (namespace) body.namespace = namespace;
                const data = await pineconeRequest('POST', `${indexHost}/query`, apiKey, body);
                return { output: data };
            }

            case 'fetch': {
                if (!indexHost) throw new Error('"indexHost" is required.');
                const ids = inputs.ids;
                const namespace = inputs.namespace;
                if (!ids) throw new Error('"ids" is required.');
                const idsArr: string[] = Array.isArray(ids) ? ids : String(ids).split(',').map((s: string) => s.trim());
                const params = new URLSearchParams();
                idsArr.forEach((id) => params.append('ids', id));
                if (namespace) params.set('namespace', namespace);
                logger.log(`[Pinecone] fetch ${idsArr.length} vectors`);
                const data = await pineconeRequest('GET', `${indexHost}/vectors/fetch?${params}`, apiKey);
                return { output: data };
            }

            case 'deleteVectors': {
                if (!indexHost) throw new Error('"indexHost" is required.');
                const ids = inputs.ids;
                const namespace = inputs.namespace;
                if (!ids) throw new Error('"ids" is required.');
                const idsArr: string[] = Array.isArray(ids) ? ids : String(ids).split(',').map((s: string) => s.trim());
                const body: any = { ids: idsArr };
                if (namespace) body.namespace = namespace;
                logger.log(`[Pinecone] deleteVectors count=${idsArr.length}`);
                const data = await pineconeRequest('POST', `${indexHost}/vectors/delete`, apiKey, body);
                return { output: { success: true, ...data } };
            }

            case 'describeStats': {
                if (!indexHost) throw new Error('"indexHost" is required.');
                logger.log('[Pinecone] describeStats');
                const data = await pineconeRequest('POST', `${indexHost}/describe_index_stats`, apiKey, {});
                return { output: data };
            }

            case 'listCollections': {
                logger.log('[Pinecone] listCollections');
                const data = await pineconeRequest('GET', `${PINECONE_CONTROL}/collections`, apiKey);
                return { output: data };
            }

            case 'createCollection': {
                const name = String(inputs.name ?? '').trim();
                const source = String(inputs.source ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                if (!source) throw new Error('"source" index name is required.');
                logger.log(`[Pinecone] createCollection: ${name}`);
                const data = await pineconeRequest('POST', `${PINECONE_CONTROL}/collections`, apiKey, { name, source });
                return { output: data };
            }

            case 'deleteCollection': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Pinecone] deleteCollection: ${name}`);
                await pineconeRequest('DELETE', `${PINECONE_CONTROL}/collections/${encodeURIComponent(name)}`, apiKey);
                return { output: { success: true, deleted: name } };
            }

            default:
                throw new Error(`Unknown Pinecone action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[Pinecone] Error in ${actionName}: ${err.message}`);
        return { error: err.message || 'Unknown Pinecone error' };
    }
}
