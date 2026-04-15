
'use server';

async function algoliaFetch(
    method: string,
    url: string,
    appId: string,
    apiKey: string,
    body?: any
): Promise<any> {
    const res = await fetch(url, {
        method,
        headers: {
            'X-Algolia-Application-Id': appId,
            'X-Algolia-API-Key': apiKey,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { success: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Algolia API error ${res.status}`);
    }
    return data;
}

export async function executeAlgoliaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const appId = String(inputs.appId ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!appId) throw new Error('appId is required.');
        if (!apiKey) throw new Error('apiKey is required.');

        const BASE = `https://${appId}-dsn.algolia.net/1`;

        switch (actionName) {
            case 'searchIndex': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const query = String(inputs.query ?? '');
                const params = inputs.params || {};
                const data = await algoliaFetch('POST', `${BASE}/indexes/${encodeURIComponent(index)}/query`, appId, apiKey, {
                    query,
                    ...params,
                });
                logger.log(`[Algolia] searchIndex "${index}"`);
                return { output: data };
            }

            case 'searchMultiple': {
                const queries = inputs.queries || [];
                const data = await algoliaFetch('POST', `${BASE}/indexes/*/queries`, appId, apiKey, { requests: queries });
                logger.log(`[Algolia] searchMultiple`);
                return { output: data };
            }

            case 'addObject': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const objectBody = inputs.object || {};
                const data = await algoliaFetch('POST', `${BASE}/indexes/${encodeURIComponent(index)}`, appId, apiKey, objectBody);
                logger.log(`[Algolia] addObject to "${index}"`);
                return { output: data };
            }

            case 'updateObject': {
                const index = String(inputs.index ?? '').trim();
                const objectId = String(inputs.objectId ?? '').trim();
                if (!index) throw new Error('index is required.');
                if (!objectId) throw new Error('objectId is required.');
                const objectBody = inputs.object || {};
                const data = await algoliaFetch('PUT', `${BASE}/indexes/${encodeURIComponent(index)}/${encodeURIComponent(objectId)}`, appId, apiKey, objectBody);
                logger.log(`[Algolia] updateObject ${objectId} in "${index}"`);
                return { output: data };
            }

            case 'partialUpdate': {
                const index = String(inputs.index ?? '').trim();
                const objectId = String(inputs.objectId ?? '').trim();
                if (!index) throw new Error('index is required.');
                if (!objectId) throw new Error('objectId is required.');
                const objectBody = inputs.object || {};
                const data = await algoliaFetch('POST', `${BASE}/indexes/${encodeURIComponent(index)}/${encodeURIComponent(objectId)}/partial`, appId, apiKey, objectBody);
                logger.log(`[Algolia] partialUpdate ${objectId} in "${index}"`);
                return { output: data };
            }

            case 'deleteObject': {
                const index = String(inputs.index ?? '').trim();
                const objectId = String(inputs.objectId ?? '').trim();
                if (!index) throw new Error('index is required.');
                if (!objectId) throw new Error('objectId is required.');
                const data = await algoliaFetch('DELETE', `${BASE}/indexes/${encodeURIComponent(index)}/${encodeURIComponent(objectId)}`, appId, apiKey);
                logger.log(`[Algolia] deleteObject ${objectId} from "${index}"`);
                return { output: data };
            }

            case 'getObject': {
                const index = String(inputs.index ?? '').trim();
                const objectId = String(inputs.objectId ?? '').trim();
                if (!index) throw new Error('index is required.');
                if (!objectId) throw new Error('objectId is required.');
                const data = await algoliaFetch('GET', `${BASE}/indexes/${encodeURIComponent(index)}/${encodeURIComponent(objectId)}`, appId, apiKey);
                logger.log(`[Algolia] getObject ${objectId} from "${index}"`);
                return { output: data };
            }

            case 'listIndices': {
                const data = await algoliaFetch('GET', `${BASE}/indexes`, appId, apiKey);
                logger.log(`[Algolia] listIndices`);
                return { output: data };
            }

            case 'clearIndex': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const data = await algoliaFetch('POST', `${BASE}/indexes/${encodeURIComponent(index)}/clear`, appId, apiKey);
                logger.log(`[Algolia] clearIndex "${index}"`);
                return { output: data };
            }

            case 'deleteIndex': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const data = await algoliaFetch('DELETE', `${BASE}/indexes/${encodeURIComponent(index)}`, appId, apiKey);
                logger.log(`[Algolia] deleteIndex "${index}"`);
                return { output: data };
            }

            case 'browseIndex': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const params = inputs.params || {};
                const data = await algoliaFetch('POST', `${BASE}/indexes/${encodeURIComponent(index)}/browse`, appId, apiKey, params);
                logger.log(`[Algolia] browseIndex "${index}"`);
                return { output: data };
            }

            case 'batchWrite': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const requests = inputs.requests || [];
                const data = await algoliaFetch('POST', `${BASE}/indexes/${encodeURIComponent(index)}/batch`, appId, apiKey, { requests });
                logger.log(`[Algolia] batchWrite to "${index}"`);
                return { output: data };
            }

            case 'addRule': {
                const index = String(inputs.index ?? '').trim();
                const objectId = String(inputs.objectId ?? '').trim();
                if (!index) throw new Error('index is required.');
                if (!objectId) throw new Error('objectId is required.');
                const ruleBody = inputs.rule || {};
                const data = await algoliaFetch('PUT', `${BASE}/indexes/${encodeURIComponent(index)}/rules/${encodeURIComponent(objectId)}`, appId, apiKey, ruleBody);
                logger.log(`[Algolia] addRule ${objectId} to "${index}"`);
                return { output: data };
            }

            case 'searchRules': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const query = String(inputs.query ?? '');
                const data = await algoliaFetch('POST', `${BASE}/indexes/${encodeURIComponent(index)}/rules/search`, appId, apiKey, { query });
                logger.log(`[Algolia] searchRules in "${index}"`);
                return { output: data };
            }

            case 'listApiKeys': {
                const data = await algoliaFetch('GET', `${BASE}/keys`, appId, apiKey);
                logger.log(`[Algolia] listApiKeys`);
                return { output: data };
            }

            default:
                throw new Error(`Algolia action "${actionName}" is not implemented.`);
        }
    } catch (err: any) {
        const message = err?.message || 'Unknown Algolia error';
        logger.log(`[Algolia] Error: ${message}`);
        return { error: message };
    }
}
