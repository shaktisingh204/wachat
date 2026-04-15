
'use server';

async function qdrantRequest(
    method: string,
    url: string,
    apiKey: string,
    body?: any
): Promise<any> {
    const res = await fetch(url, {
        method,
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        const msg = data?.status?.error || data?.message || text || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeQdrantAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '').trim();
        if (!serverUrl) throw new Error('"serverUrl" is required.');
        const apiKey = String(inputs.apiKey ?? '').trim();

        switch (actionName) {
            case 'listCollections': {
                logger.log('[Qdrant] listCollections');
                const data = await qdrantRequest('GET', `${serverUrl}/collections`, apiKey);
                return { output: data?.result ?? data };
            }

            case 'getCollection': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Qdrant] getCollection: ${name}`);
                const data = await qdrantRequest('GET', `${serverUrl}/collections/${encodeURIComponent(name)}`, apiKey);
                return { output: data?.result ?? data };
            }

            case 'createCollection': {
                const name = String(inputs.name ?? '').trim();
                const vectorsConfig = inputs.vectors ?? inputs.vectorsConfig;
                if (!name) throw new Error('"name" is required.');
                if (!vectorsConfig) throw new Error('"vectors" config is required (e.g. { size: 1536, distance: "Cosine" }).');
                logger.log(`[Qdrant] createCollection: ${name}`);
                const data = await qdrantRequest('PUT', `${serverUrl}/collections/${encodeURIComponent(name)}`, apiKey, { vectors: vectorsConfig });
                return { output: data?.result ?? data };
            }

            case 'deleteCollection': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Qdrant] deleteCollection: ${name}`);
                const data = await qdrantRequest('DELETE', `${serverUrl}/collections/${encodeURIComponent(name)}`, apiKey);
                return { output: data?.result ?? { success: true } };
            }

            case 'upsertPoints': {
                const name = String(inputs.name ?? '').trim();
                const points = inputs.points ?? [];
                if (!name) throw new Error('"name" is required.');
                if (!Array.isArray(points) || points.length === 0) throw new Error('"points" array is required.');
                logger.log(`[Qdrant] upsertPoints collection=${name} count=${points.length}`);
                const data = await qdrantRequest('PUT', `${serverUrl}/collections/${encodeURIComponent(name)}/points`, apiKey, { points });
                return { output: data?.result ?? data };
            }

            case 'searchPoints': {
                const name = String(inputs.name ?? '').trim();
                const vector = inputs.vector;
                const limit = Number(inputs.limit ?? 10);
                const withPayload = inputs.with_payload !== false;
                if (!name) throw new Error('"name" is required.');
                if (!vector) throw new Error('"vector" is required.');
                logger.log(`[Qdrant] searchPoints collection=${name} limit=${limit}`);
                const data = await qdrantRequest('POST', `${serverUrl}/collections/${encodeURIComponent(name)}/points/search`, apiKey, { vector, limit, with_payload: withPayload });
                return { output: data?.result ?? data };
            }

            case 'getPoint': {
                const name = String(inputs.name ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                if (!id) throw new Error('"id" is required.');
                logger.log(`[Qdrant] getPoint collection=${name} id=${id}`);
                const data = await qdrantRequest('GET', `${serverUrl}/collections/${encodeURIComponent(name)}/points/${encodeURIComponent(id)}`, apiKey);
                return { output: data?.result ?? data };
            }

            case 'deletePoints': {
                const name = String(inputs.name ?? '').trim();
                const filter = inputs.filter ?? {};
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Qdrant] deletePoints collection=${name}`);
                const data = await qdrantRequest('POST', `${serverUrl}/collections/${encodeURIComponent(name)}/points/delete`, apiKey, { filter });
                return { output: data?.result ?? data };
            }

            case 'scrollPoints': {
                const name = String(inputs.name ?? '').trim();
                const limit = Number(inputs.limit ?? 10);
                const withPayload = inputs.with_payload !== false;
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Qdrant] scrollPoints collection=${name} limit=${limit}`);
                const body: any = { limit, with_payload: withPayload };
                if (inputs.offset) body.offset = inputs.offset;
                if (inputs.filter) body.filter = inputs.filter;
                const data = await qdrantRequest('POST', `${serverUrl}/collections/${encodeURIComponent(name)}/points/scroll`, apiKey, body);
                return { output: data?.result ?? data };
            }

            case 'countPoints': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Qdrant] countPoints collection=${name}`);
                const body: any = {};
                if (inputs.filter) body.filter = inputs.filter;
                const data = await qdrantRequest('POST', `${serverUrl}/collections/${encodeURIComponent(name)}/points/count`, apiKey, body);
                return { output: data?.result ?? data };
            }

            case 'createSnapshot': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Qdrant] createSnapshot collection=${name}`);
                const data = await qdrantRequest('POST', `${serverUrl}/collections/${encodeURIComponent(name)}/snapshots`, apiKey);
                return { output: data?.result ?? data };
            }

            case 'listSnapshots': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[Qdrant] listSnapshots collection=${name}`);
                const data = await qdrantRequest('GET', `${serverUrl}/collections/${encodeURIComponent(name)}/snapshots`, apiKey);
                return { output: data?.result ?? data };
            }

            case 'getClusterInfo': {
                logger.log('[Qdrant] getClusterInfo');
                const data = await qdrantRequest('GET', `${serverUrl}/cluster`, apiKey);
                return { output: data?.result ?? data };
            }

            default:
                throw new Error(`Unknown Qdrant action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[Qdrant] Error in ${actionName}: ${err.message}`);
        return { error: err.message || 'Unknown Qdrant error' };
    }
}
