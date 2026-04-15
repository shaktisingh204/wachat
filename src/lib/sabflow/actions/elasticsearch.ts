'use server';

export async function executeElasticsearchAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');

        const getAuthHeader = (): string => {
            if (inputs.apiKey) {
                const encoded = Buffer.from(`${inputs.apiKeyId || ''}:${inputs.apiKey}`).toString('base64');
                return `ApiKey ${encoded}`;
            }
            const encoded = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
            return `Basic ${encoded}`;
        };

        const esRequest = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getAuthHeader(),
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.reason || JSON.stringify(data));
            return data;
        };

        switch (actionName) {
            case 'search': {
                const data = await esRequest('POST', `/${inputs.index || '*'}/_search`, {
                    query: inputs.query || { match_all: {} },
                    size: inputs.size || 10,
                    from: inputs.from || 0,
                    sort: inputs.sort,
                    _source: inputs.source,
                });
                return { output: data };
            }
            case 'indexDocument': {
                const path = inputs.documentId
                    ? `/${inputs.index}/_doc/${inputs.documentId}`
                    : `/${inputs.index}/_doc`;
                const method = inputs.documentId ? 'PUT' : 'POST';
                const data = await esRequest(method, path, inputs.document);
                return { output: data };
            }
            case 'getDocument': {
                const data = await esRequest('GET', `/${inputs.index}/_doc/${inputs.documentId}`);
                return { output: data };
            }
            case 'updateDocument': {
                const data = await esRequest('POST', `/${inputs.index}/_update/${inputs.documentId}`, {
                    doc: inputs.document,
                    doc_as_upsert: inputs.upsert || false,
                });
                return { output: data };
            }
            case 'deleteDocument': {
                const data = await esRequest('DELETE', `/${inputs.index}/_doc/${inputs.documentId}`);
                return { output: data };
            }
            case 'bulkIndex': {
                const docs: any[] = inputs.documents || [];
                const lines = docs.flatMap((doc: any) => [
                    JSON.stringify({ index: { _index: inputs.index, _id: doc._id } }),
                    JSON.stringify(doc._id ? (() => { const d = { ...doc }; delete d._id; return d; })() : doc),
                ]);
                const res = await fetch(`${baseUrl}/_bulk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-ndjson',
                        'Authorization': getAuthHeader(),
                    },
                    body: lines.join('\n') + '\n',
                });
                const data = await res.json();
                if (!res.ok) throw new Error(JSON.stringify(data));
                return { output: data };
            }
            case 'createIndex': {
                const data = await esRequest('PUT', `/${inputs.index}`, {
                    settings: inputs.settings,
                    mappings: inputs.mappings,
                });
                return { output: data };
            }
            case 'deleteIndex': {
                const data = await esRequest('DELETE', `/${inputs.index}`);
                return { output: data };
            }
            case 'listIndices': {
                const res = await fetch(`${baseUrl}/_cat/indices?format=json`, {
                    headers: { 'Authorization': getAuthHeader() },
                });
                const data = await res.json();
                return { output: { indices: data } };
            }
            case 'getIndexMapping': {
                const data = await esRequest('GET', `/${inputs.index}/_mapping`);
                return { output: data };
            }
            case 'putMapping': {
                const data = await esRequest('PUT', `/${inputs.index}/_mapping`, inputs.mapping);
                return { output: data };
            }
            case 'getClusterHealth': {
                const data = await esRequest('GET', '/_cluster/health');
                return { output: data };
            }
            case 'getClusterStats': {
                const data = await esRequest('GET', '/_cluster/stats');
                return { output: data };
            }
            case 'createAlias': {
                const data = await esRequest('POST', '/_aliases', {
                    actions: [{ add: { index: inputs.index, alias: inputs.alias, filter: inputs.filter } }],
                });
                return { output: data };
            }
            case 'scrollSearch': {
                let data;
                if (inputs.scrollId) {
                    data = await esRequest('POST', '/_search/scroll', {
                        scroll: inputs.scroll || '1m',
                        scroll_id: inputs.scrollId,
                    });
                } else {
                    data = await esRequest('POST', `/${inputs.index || '*'}/_search?scroll=${inputs.scroll || '1m'}`, {
                        query: inputs.query || { match_all: {} },
                        size: inputs.size || 100,
                    });
                }
                return { output: data };
            }
            default:
                return { error: `Unknown Elasticsearch action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Elasticsearch action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
