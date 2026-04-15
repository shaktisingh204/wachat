'use server';

export async function executeElasticsearchEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) return { error: 'baseUrl is required' };

    const credentials = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
    const authHeader = `Basic ${credentials}`;

    try {
        switch (actionName) {
            case 'indexDocument': {
                const { index, documentId, document } = inputs;
                if (!index || !document) return { error: 'index and document are required' };
                const url = documentId ? `${baseUrl}/${index}/_doc/${documentId}` : `${baseUrl}/${index}/_doc`;
                const method = documentId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(document),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to index document' };
                return { output: data };
            }

            case 'getDocument': {
                const { index, documentId } = inputs;
                if (!index || !documentId) return { error: 'index and documentId are required' };
                const res = await fetch(`${baseUrl}/${index}/_doc/${documentId}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to get document' };
                return { output: data };
            }

            case 'updateDocument': {
                const { index, documentId, doc, script } = inputs;
                if (!index || !documentId) return { error: 'index and documentId are required' };
                const body: any = {};
                if (doc) body.doc = doc;
                if (script) body.script = script;
                const res = await fetch(`${baseUrl}/${index}/_update/${documentId}`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to update document' };
                return { output: data };
            }

            case 'deleteDocument': {
                const { index, documentId } = inputs;
                if (!index || !documentId) return { error: 'index and documentId are required' };
                const res = await fetch(`${baseUrl}/${index}/_doc/${documentId}`, {
                    method: 'DELETE',
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to delete document' };
                return { output: data };
            }

            case 'search': {
                const { index, query } = inputs;
                if (!index) return { error: 'index is required' };
                const body: any = {};
                if (query) body.query = query;
                if (inputs.size) body.size = inputs.size;
                if (inputs.from) body.from = inputs.from;
                if (inputs.sort) body.sort = inputs.sort;
                if (inputs.aggs) body.aggs = inputs.aggs;
                if (inputs._source) body._source = inputs._source;
                const res = await fetch(`${baseUrl}/${index}/_search`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to search' };
                return { output: data };
            }

            case 'count': {
                const { index, query } = inputs;
                if (!index) return { error: 'index is required' };
                const body: any = {};
                if (query) body.query = query;
                const res = await fetch(`${baseUrl}/${index}/_count`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to count' };
                return { output: data };
            }

            case 'bulk': {
                const { operations } = inputs;
                if (!operations) return { error: 'operations (ndjson array) are required' };
                const ndjson = Array.isArray(operations)
                    ? operations.map((op: any) => JSON.stringify(op)).join('\n') + '\n'
                    : operations;
                const url = inputs.index ? `${baseUrl}/${inputs.index}/_bulk` : `${baseUrl}/_bulk`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/x-ndjson' },
                    body: ndjson,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to execute bulk operation' };
                return { output: data };
            }

            case 'listIndices': {
                const params = new URLSearchParams({ v: 'true', format: 'json' });
                if (inputs.health) params.set('health', inputs.health);
                const res = await fetch(`${baseUrl}/_cat/indices?${params}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).error?.reason || 'Failed to list indices' };
                return { output: { indices: data } };
            }

            case 'createIndex': {
                const { index, mappings, settings } = inputs;
                if (!index) return { error: 'index is required' };
                const body: any = {};
                if (mappings) body.mappings = mappings;
                if (settings) body.settings = settings;
                const res = await fetch(`${baseUrl}/${index}`, {
                    method: 'PUT',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to create index' };
                return { output: data };
            }

            case 'deleteIndex': {
                const { index } = inputs;
                if (!index) return { error: 'index is required' };
                const res = await fetch(`${baseUrl}/${index}`, {
                    method: 'DELETE',
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to delete index' };
                return { output: data };
            }

            case 'getIndexMapping': {
                const { index } = inputs;
                if (!index) return { error: 'index is required' };
                const res = await fetch(`${baseUrl}/${index}/_mapping`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to get index mapping' };
                return { output: data };
            }

            case 'updateIndexMapping': {
                const { index, properties } = inputs;
                if (!index || !properties) return { error: 'index and properties are required' };
                const body: any = { properties };
                if (inputs.dynamic !== undefined) body.dynamic = inputs.dynamic;
                const res = await fetch(`${baseUrl}/${index}/_mapping`, {
                    method: 'PUT',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to update index mapping' };
                return { output: data };
            }

            case 'getClusterHealth': {
                const params = new URLSearchParams();
                if (inputs.level) params.set('level', inputs.level);
                const res = await fetch(`${baseUrl}/_cluster/health?${params}`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to get cluster health' };
                return { output: data };
            }

            case 'getClusterStats': {
                const res = await fetch(`${baseUrl}/_cluster/stats`, {
                    headers: { Authorization: authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to get cluster stats' };
                return { output: data };
            }

            case 'reindex': {
                const { source, dest } = inputs;
                if (!source || !dest) return { error: 'source and dest are required' };
                const body: any = { source, dest };
                if (inputs.script) body.script = inputs.script;
                if (inputs.conflicts) body.conflicts = inputs.conflicts;
                const res = await fetch(`${baseUrl}/_reindex${inputs.waitForCompletion === false ? '?wait_for_completion=false' : ''}`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.reason || data.error || 'Failed to reindex' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Elasticsearch Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Elasticsearch Enhanced action' };
    }
}
