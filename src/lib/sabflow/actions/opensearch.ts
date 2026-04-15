'use server';

export async function executeOpensearchAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');

        const buildAuthHeader = (): string => {
            if (inputs.accessToken) return `Bearer ${inputs.accessToken}`;
            if (inputs.username && inputs.password) {
                const creds = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
                return `Basic ${creds}`;
            }
            return '';
        };

        const authHeader = buildAuthHeader();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
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
            if (!res.ok) throw new Error((data?.error?.reason || data?.error || data) || `HTTP ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'search': {
                const index = inputs.index || '_all';
                const query = typeof inputs.query === 'string' ? JSON.parse(inputs.query) : inputs.query;
                const data = await doFetch('POST', `/${index}/_search`, query || { query: { match_all: {} } });
                return { output: { results: data } };
            }
            case 'indexDocument': {
                const doc = typeof inputs.document === 'string' ? JSON.parse(inputs.document) : inputs.document;
                const path = inputs.documentId
                    ? `/${inputs.index}/_doc/${inputs.documentId}`
                    : `/${inputs.index}/_doc`;
                const method = inputs.documentId ? 'PUT' : 'POST';
                const data = await doFetch(method, path, doc);
                return { output: { result: data } };
            }
            case 'getDocument': {
                const data = await doFetch('GET', `/${inputs.index}/_doc/${inputs.documentId}`);
                return { output: { document: data } };
            }
            case 'updateDocument': {
                const doc = typeof inputs.document === 'string' ? JSON.parse(inputs.document) : inputs.document;
                const data = await doFetch('POST', `/${inputs.index}/_update/${inputs.documentId}`, { doc });
                return { output: { result: data } };
            }
            case 'deleteDocument': {
                const data = await doFetch('DELETE', `/${inputs.index}/_doc/${inputs.documentId}`);
                return { output: { result: data } };
            }
            case 'bulkIndex': {
                const operations = typeof inputs.operations === 'string' ? inputs.operations : inputs.operations.map((op: any) => JSON.stringify(op)).join('\n');
                const res = await fetch(`${baseUrl}/_bulk`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-ndjson' },
                    body: operations + '\n',
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                return { output: { result: data } };
            }
            case 'createIndex': {
                const body: any = {};
                if (inputs.settings) body.settings = typeof inputs.settings === 'string' ? JSON.parse(inputs.settings) : inputs.settings;
                if (inputs.mappings) body.mappings = typeof inputs.mappings === 'string' ? JSON.parse(inputs.mappings) : inputs.mappings;
                const data = await doFetch('PUT', `/${inputs.index}`, Object.keys(body).length ? body : undefined);
                return { output: { result: data } };
            }
            case 'deleteIndex': {
                const data = await doFetch('DELETE', `/${inputs.index}`);
                return { output: { result: data } };
            }
            case 'listIndices': {
                const data = await doFetch('GET', '/_cat/indices?format=json');
                return { output: { indices: data } };
            }
            case 'getMapping': {
                const data = await doFetch('GET', `/${inputs.index}/_mapping`);
                return { output: { mapping: data } };
            }
            case 'putMapping': {
                const mapping = typeof inputs.mapping === 'string' ? JSON.parse(inputs.mapping) : inputs.mapping;
                const data = await doFetch('PUT', `/${inputs.index}/_mapping`, mapping);
                return { output: { result: data } };
            }
            case 'getClusterHealth': {
                const data = await doFetch('GET', '/_cluster/health');
                return { output: { health: data } };
            }
            case 'getClusterStats': {
                const data = await doFetch('GET', '/_cluster/stats');
                return { output: { stats: data } };
            }
            case 'createAlias': {
                const body = {
                    actions: [{ add: { index: inputs.index, alias: inputs.aliasName } }],
                };
                const data = await doFetch('POST', '/_aliases', body);
                return { output: { result: data } };
            }
            case 'searchWithAggregations': {
                const body = typeof inputs.body === 'string' ? JSON.parse(inputs.body) : inputs.body;
                const data = await doFetch('POST', `/${inputs.index}/_search`, body);
                return { output: { results: data } };
            }
            default:
                return { error: `Unknown OpenSearch action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`OpenSearch action error [${actionName}]: ${err.message}`);
        return { error: err.message || String(err) };
    }
}
