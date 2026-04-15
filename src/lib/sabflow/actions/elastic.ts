
'use server';

async function elasticFetch(
    clusterUrl: string,
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    rawBody?: string,
    logger?: any,
) {
    logger?.log(`[Elasticsearch] ${method} ${path}`);
    const headers: Record<string, string> = {
        Authorization: `ApiKey ${apiKey}`,
        Accept: 'application/json',
    };

    const options: RequestInit = { method, headers };

    if (rawBody !== undefined) {
        headers['Content-Type'] = 'application/x-ndjson';
        options.body = rawBody;
    } else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const url = `${clusterUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error?.reason || data?.error?.type || `Elasticsearch error: ${res.status}`);
    return data;
}

export async function executeElasticAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const clusterUrl = String(inputs.clusterUrl ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!clusterUrl) throw new Error('clusterUrl is required.');
        if (!apiKey) throw new Error('apiKey is required.');

        const es = (method: string, path: string, body?: any, rawBody?: string) =>
            elasticFetch(clusterUrl, apiKey, method, path, body, rawBody, logger);

        switch (actionName) {
            case 'indexDocument': {
                const index = String(inputs.index ?? '').trim();
                const document = inputs.document;
                if (!index) throw new Error('index is required.');
                if (!document || typeof document !== 'object') throw new Error('document must be an object.');
                const id = String(inputs.id ?? '').trim();
                const path = id ? `/${index}/_doc/${id}` : `/${index}/_doc/`;
                const method = id ? 'PUT' : 'POST';
                const data = await es(method, path, document);
                return { output: { id: data._id, index: data._index, result: data.result } };
            }

            case 'getDocument': {
                const index = String(inputs.index ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!index || !id) throw new Error('index and id are required.');
                const data = await es('GET', `/${index}/_doc/${id}`);
                return { output: { id: data._id, source: data._source ?? {} } };
            }

            case 'updateDocument': {
                const index = String(inputs.index ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                const doc = inputs.doc;
                if (!index || !id) throw new Error('index and id are required.');
                if (!doc || typeof doc !== 'object') throw new Error('doc must be an object.');
                const data = await es('POST', `/${index}/_update/${id}`, { doc });
                return { output: { id: data._id, result: data.result } };
            }

            case 'deleteDocument': {
                const index = String(inputs.index ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!index || !id) throw new Error('index and id are required.');
                const data = await es('DELETE', `/${index}/_doc/${id}`);
                return { output: { result: data.result } };
            }

            case 'search': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const query = inputs.query && typeof inputs.query === 'object' ? inputs.query : { match_all: {} };
                const size = inputs.size !== undefined ? Number(inputs.size) : undefined;
                const from = inputs.from !== undefined ? Number(inputs.from) : undefined;
                const body: any = { query };
                if (size !== undefined) body.size = size;
                if (from !== undefined) body.from = from;
                const data = await es('POST', `/${index}/_search`, body);
                const hits = data.hits ?? {};
                return {
                    output: {
                        hits: {
                            total: hits.total?.value ?? hits.total ?? 0,
                            hits: (hits.hits ?? []).map((h: any) => ({ id: h._id, source: h._source ?? {} })),
                        },
                    },
                };
            }

            case 'bulkIndex': {
                const index = String(inputs.index ?? '').trim();
                const documents = inputs.documents;
                if (!index) throw new Error('index is required.');
                if (!Array.isArray(documents) || documents.length === 0) throw new Error('documents must be a non-empty array.');
                const ndjson = documents
                    .map((doc: any) => {
                        const action = JSON.stringify({ index: { _index: index, ...(doc._id ? { _id: doc._id } : {}) } });
                        const { _id, ...source } = doc;
                        return `${action}\n${JSON.stringify(source)}`;
                    })
                    .join('\n') + '\n';
                const data = await es('POST', '/_bulk', undefined, ndjson);
                return { output: { errors: data.errors ?? false, items: data.items ?? [] } };
            }

            case 'createIndex': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const body: any = {};
                if (inputs.mappings && typeof inputs.mappings === 'object') body.mappings = inputs.mappings;
                if (inputs.settings && typeof inputs.settings === 'object') body.settings = inputs.settings;
                const data = await es('PUT', `/${index}`, body);
                return { output: { acknowledged: data.acknowledged ?? false } };
            }

            case 'deleteIndex': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const data = await es('DELETE', `/${index}`);
                return { output: { acknowledged: data.acknowledged ?? false } };
            }

            case 'listIndices': {
                const pattern = String(inputs.pattern ?? '*').trim() || '*';
                const data = await es('GET', `/_cat/indices/${pattern}?format=json`);
                return { output: { indices: Array.isArray(data) ? data : [] } };
            }

            case 'getIndexInfo': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const data = await es('GET', `/${index}`);
                const info = data[index] ?? data;
                return { output: { mappings: info.mappings ?? {}, settings: info.settings ?? {} } };
            }

            case 'countDocuments': {
                const index = String(inputs.index ?? '').trim();
                if (!index) throw new Error('index is required.');
                const query = inputs.query && typeof inputs.query === 'object' ? inputs.query : { match_all: {} };
                const data = await es('POST', `/${index}/_count`, { query });
                return { output: { count: data.count ?? 0 } };
            }

            case 'deleteByQuery': {
                const index = String(inputs.index ?? '').trim();
                const query = inputs.query;
                if (!index) throw new Error('index is required.');
                if (!query || typeof query !== 'object') throw new Error('query must be an object.');
                const data = await es('POST', `/${index}/_delete_by_query`, { query });
                return { output: { deleted: data.deleted ?? 0, total: data.total ?? 0 } };
            }

            case 'createAlias': {
                const index = String(inputs.index ?? '').trim();
                const alias = String(inputs.alias ?? '').trim();
                if (!index || !alias) throw new Error('index and alias are required.');
                const data = await es('PUT', `/${index}/_alias/${alias}`);
                return { output: { acknowledged: data.acknowledged ?? false } };
            }

            case 'getClusterHealth': {
                const data = await es('GET', '/_cluster/health');
                return {
                    output: {
                        status: data.status,
                        numberOfNodes: data.number_of_nodes,
                        activeShards: data.active_shards,
                    },
                };
            }

            default:
                return { error: `Elasticsearch action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Elasticsearch action failed.' };
    }
}
