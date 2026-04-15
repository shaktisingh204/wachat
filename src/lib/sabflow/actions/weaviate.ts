
'use server';

async function weaviateRequest(
    method: string,
    url: string,
    apiKey: string,
    body?: any
): Promise<any> {
    const res = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-Weaviate-Api-Key': apiKey,
            'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        const msg = data?.error?.[0]?.message || data?.message || text || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeWeaviateAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '').trim();
        if (!serverUrl) throw new Error('"serverUrl" is required.');
        const apiKey = String(inputs.apiKey ?? '').trim();
        const base = `${serverUrl}/v1`;

        switch (actionName) {
            case 'getSchema': {
                logger.log('[Weaviate] getSchema');
                const data = await weaviateRequest('GET', `${base}/schema`, apiKey);
                return { output: data };
            }

            case 'createClass': {
                const classDef = inputs.classDef ?? inputs.classDefinition ?? {};
                if (!classDef.class) throw new Error('"classDef.class" is required.');
                logger.log(`[Weaviate] createClass: ${classDef.class}`);
                const data = await weaviateRequest('POST', `${base}/schema`, apiKey, classDef);
                return { output: data };
            }

            case 'deleteClass': {
                const className = String(inputs.className ?? '').trim();
                if (!className) throw new Error('"className" is required.');
                logger.log(`[Weaviate] deleteClass: ${className}`);
                await weaviateRequest('DELETE', `${base}/schema/${encodeURIComponent(className)}`, apiKey);
                return { output: { success: true, deleted: className } };
            }

            case 'addObject': {
                const cls = String(inputs.class ?? '').trim();
                const properties = inputs.properties ?? {};
                if (!cls) throw new Error('"class" is required.');
                const body: any = { class: cls, properties };
                if (inputs.vector) body.vector = inputs.vector;
                logger.log(`[Weaviate] addObject class=${cls}`);
                const data = await weaviateRequest('POST', `${base}/objects`, apiKey, body);
                return { output: data };
            }

            case 'getObject': {
                const className = String(inputs.className ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!className) throw new Error('"className" is required.');
                if (!id) throw new Error('"id" is required.');
                logger.log(`[Weaviate] getObject ${className}/${id}`);
                const data = await weaviateRequest('GET', `${base}/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}`, apiKey);
                return { output: data };
            }

            case 'updateObject': {
                const className = String(inputs.className ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                const properties = inputs.properties ?? {};
                if (!className) throw new Error('"className" is required.');
                if (!id) throw new Error('"id" is required.');
                logger.log(`[Weaviate] updateObject ${className}/${id}`);
                const data = await weaviateRequest('PATCH', `${base}/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}`, apiKey, { properties });
                return { output: data ?? { success: true } };
            }

            case 'deleteObject': {
                const className = String(inputs.className ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!className) throw new Error('"className" is required.');
                if (!id) throw new Error('"id" is required.');
                logger.log(`[Weaviate] deleteObject ${className}/${id}`);
                await weaviateRequest('DELETE', `${base}/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}`, apiKey);
                return { output: { success: true, deleted: id } };
            }

            case 'searchByVector': {
                const className = String(inputs.className ?? '').trim();
                const vector = inputs.vector;
                const limit = Number(inputs.limit ?? 10);
                if (!className) throw new Error('"className" is required.');
                if (!vector) throw new Error('"vector" is required.');
                logger.log(`[Weaviate] searchByVector class=${className}`);
                const query = `{ Get { ${className}(nearVector: { vector: ${JSON.stringify(vector)} } limit: ${limit}) { _additional { id distance } } } }`;
                const data = await weaviateRequest('POST', `${base}/graphql`, apiKey, { query });
                return { output: data };
            }

            case 'searchByText': {
                const className = String(inputs.className ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                const limit = Number(inputs.limit ?? 10);
                const concepts = inputs.concepts ?? [text];
                if (!className) throw new Error('"className" is required.');
                if (!text && !inputs.concepts) throw new Error('"text" or "concepts" is required.');
                logger.log(`[Weaviate] searchByText class=${className}`);
                const query = `{ Get { ${className}(nearText: { concepts: ${JSON.stringify(concepts)} } limit: ${limit}) { _additional { id certainty } } } }`;
                const data = await weaviateRequest('POST', `${base}/graphql`, apiKey, { query });
                return { output: data };
            }

            case 'getObjects': {
                const cls = String(inputs.class ?? '').trim();
                const limit = Number(inputs.limit ?? 25);
                if (!cls) throw new Error('"class" is required.');
                logger.log(`[Weaviate] getObjects class=${cls} limit=${limit}`);
                const params = new URLSearchParams({ class: cls, limit: String(limit) });
                const data = await weaviateRequest('GET', `${base}/objects?${params}`, apiKey);
                return { output: data };
            }

            case 'batchAddObjects': {
                const objects = inputs.objects ?? [];
                if (!Array.isArray(objects) || objects.length === 0) throw new Error('"objects" array is required.');
                logger.log(`[Weaviate] batchAddObjects count=${objects.length}`);
                const data = await weaviateRequest('POST', `${base}/batch/objects`, apiKey, { objects });
                return { output: data };
            }

            case 'batchDeleteObjects': {
                const className = String(inputs.className ?? '').trim();
                const match = inputs.match ?? {};
                if (!className) throw new Error('"className" is required.');
                logger.log(`[Weaviate] batchDeleteObjects class=${className}`);
                const data = await weaviateRequest('DELETE', `${base}/batch/objects`, apiKey, { match: { class: className, ...match } });
                return { output: data };
            }

            case 'backupCreate': {
                const backend = String(inputs.backend ?? 's3').trim();
                const backupId = String(inputs.backupId ?? '').trim();
                if (!backupId) throw new Error('"backupId" is required.');
                logger.log(`[Weaviate] backupCreate backend=${backend} id=${backupId}`);
                const data = await weaviateRequest('POST', `${base}/backups/${encodeURIComponent(backend)}`, apiKey, { id: backupId });
                return { output: data };
            }

            default:
                throw new Error(`Unknown Weaviate action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[Weaviate] Error in ${actionName}: ${err.message}`);
        return { error: err.message || 'Unknown Weaviate error' };
    }
}
