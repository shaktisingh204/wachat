'use server';

export async function executeAlgoliaEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const appId = inputs.appId || '';
        const apiKey = inputs.apiKey || '';
        const baseUrl = `https://${appId}-dsn.algolia.net/1`;
        const headers: Record<string, string> = {
            'X-Algolia-Application-Id': appId,
            'X-Algolia-API-Key': apiKey,
            'Content-Type': 'application/json',
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
            case 'search': {
                const indexName = inputs.indexName;
                const body: any = {
                    params: `query=${encodeURIComponent(inputs.query || '')}${inputs.filters ? `&filters=${encodeURIComponent(inputs.filters)}` : ''}${inputs.hitsPerPage ? `&hitsPerPage=${inputs.hitsPerPage}` : ''}${inputs.page !== undefined ? `&page=${inputs.page}` : ''}`,
                };
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(indexName)}/query`, body);
                return { output: { results: data } };
            }
            case 'multiSearch': {
                const requests = typeof inputs.requests === 'string' ? JSON.parse(inputs.requests) : inputs.requests;
                const data = await doFetch('POST', '/indexes/*/queries', { requests });
                return { output: { results: data } };
            }
            case 'browseIndex': {
                const body: any = {
                    params: inputs.params || '',
                    ...(inputs.cursor ? { cursor: inputs.cursor } : {}),
                };
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}/browse`, body);
                return { output: { results: data } };
            }
            case 'getObject': {
                const qs = inputs.attributesToRetrieve ? `?attributesToRetrieve=${encodeURIComponent(inputs.attributesToRetrieve)}` : '';
                const data = await doFetch('GET', `/indexes/${encodeURIComponent(inputs.indexName)}/${encodeURIComponent(inputs.objectID)}${qs}`);
                return { output: { object: data } };
            }
            case 'saveObject': {
                const obj = typeof inputs.object === 'string' ? JSON.parse(inputs.object) : inputs.object;
                let data: any;
                if (obj.objectID) {
                    data = await doFetch('PUT', `/indexes/${encodeURIComponent(inputs.indexName)}/${encodeURIComponent(obj.objectID)}`, obj);
                } else {
                    data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}`, obj);
                }
                return { output: { result: data } };
            }
            case 'partialUpdateObject': {
                const obj = typeof inputs.object === 'string' ? JSON.parse(inputs.object) : inputs.object;
                const createIfNotExists = inputs.createIfNotExists !== false;
                const qs = `?createIfNotExists=${createIfNotExists}`;
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}/${encodeURIComponent(inputs.objectID)}/partial${qs}`, obj);
                return { output: { result: data } };
            }
            case 'deleteObject': {
                const data = await doFetch('DELETE', `/indexes/${encodeURIComponent(inputs.indexName)}/${encodeURIComponent(inputs.objectID)}`);
                return { output: { result: data } };
            }
            case 'batchWrite': {
                const requests = typeof inputs.requests === 'string' ? JSON.parse(inputs.requests) : inputs.requests;
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}/batch`, { requests });
                return { output: { result: data } };
            }
            case 'saveObjects': {
                const objects = typeof inputs.objects === 'string' ? JSON.parse(inputs.objects) : inputs.objects;
                const requests = objects.map((obj: any) => ({ action: 'addObject', body: obj }));
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}/batch`, { requests });
                return { output: { result: data } };
            }
            case 'clearIndex': {
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}/clear`);
                return { output: { result: data } };
            }
            case 'listIndices': {
                const data = await doFetch('GET', '/indexes');
                return { output: { indices: data } };
            }
            case 'getIndexSettings': {
                const data = await doFetch('GET', `/indexes/${encodeURIComponent(inputs.indexName)}/settings`);
                return { output: { settings: data } };
            }
            case 'setIndexSettings': {
                const settings = typeof inputs.settings === 'string' ? JSON.parse(inputs.settings) : inputs.settings;
                const forward = inputs.forwardToReplicas ? '?forwardToReplicas=true' : '';
                const data = await doFetch('PUT', `/indexes/${encodeURIComponent(inputs.indexName)}/settings${forward}`, settings);
                return { output: { result: data } };
            }
            case 'copyIndex': {
                const body: any = { operation: 'copy', destination: inputs.destination };
                if (inputs.scope) body.scope = inputs.scope;
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}/operation`, body);
                return { output: { result: data } };
            }
            case 'moveIndex': {
                const body = { operation: 'move', destination: inputs.destination };
                const data = await doFetch('POST', `/indexes/${encodeURIComponent(inputs.indexName)}/operation`, body);
                return { output: { result: data } };
            }
            default:
                return { error: `Unknown Algolia Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Algolia Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message || String(err) };
    }
}
