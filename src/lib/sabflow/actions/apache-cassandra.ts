'use server';

export async function executeApacheCassandraAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const databaseId = inputs.databaseId || '';
        const region = inputs.region || 'us-east1';
        const applicationToken = inputs.applicationToken || '';
        const baseUrl = inputs.baseUrl || `https://${databaseId}-${region}.apps.astra.datastax.com/api/rest/v2`;
        const keyspace = inputs.keyspace || inputs.namespace || '';

        const authHeaders: Record<string, string> = {
            'X-Cassandra-Token': applicationToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listKeyspaces': {
                const res = await fetch(`${baseUrl}/schemas/keyspaces`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra listKeyspaces failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getKeyspace': {
                const ks = inputs.keyspace || keyspace;
                const res = await fetch(`${baseUrl}/schemas/keyspaces/${ks}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra getKeyspace failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createKeyspace': {
                const body = {
                    name: inputs.name || keyspace,
                    datacenters: inputs.datacenters || [{ name: 'dc1', replicas: 1 }],
                };
                const res = await fetch(`${baseUrl}/schemas/keyspaces`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra createKeyspace failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteKeyspace': {
                const ks = inputs.keyspace || keyspace;
                const res = await fetch(`${baseUrl}/schemas/keyspaces/${ks}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra deleteKeyspace failed: ${res.status} ${err}` };
                }
                return { output: { success: true } };
            }

            case 'listTables': {
                const ks = inputs.keyspace || keyspace;
                const res = await fetch(`${baseUrl}/schemas/keyspaces/${ks}/tables`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra listTables failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getTable': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const res = await fetch(`${baseUrl}/schemas/keyspaces/${ks}/tables/${table}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra getTable failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createTable': {
                const ks = inputs.keyspace || keyspace;
                const body = {
                    name: inputs.name || inputs.tableName || '',
                    columnDefinitions: inputs.columnDefinitions || [],
                    primaryKey: inputs.primaryKey || {},
                    tableOptions: inputs.tableOptions || {},
                };
                const res = await fetch(`${baseUrl}/schemas/keyspaces/${ks}/tables`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra createTable failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteTable': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const res = await fetch(`${baseUrl}/schemas/keyspaces/${ks}/tables/${table}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra deleteTable failed: ${res.status} ${err}` };
                }
                return { output: { success: true } };
            }

            case 'getRow': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const primaryKey = inputs.primaryKey || inputs.rowKey || '';
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                const res = await fetch(`${baseUrl}/keyspaces/${ks}/${table}/${primaryKey}?${params.toString()}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra getRow failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getRows': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page-size', inputs.pageSize);
                if (inputs.pageState) params.set('page-state', inputs.pageState);
                if (inputs.fields) params.set('fields', inputs.fields);
                const res = await fetch(`${baseUrl}/keyspaces/${ks}/${table}?${params.toString()}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra getRows failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'insertRow': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const body = inputs.data || inputs.row || {};
                const res = await fetch(`${baseUrl}/keyspaces/${ks}/${table}`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra insertRow failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'updateRow': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const primaryKey = inputs.primaryKey || inputs.rowKey || '';
                const body = inputs.data || inputs.row || {};
                const res = await fetch(`${baseUrl}/keyspaces/${ks}/${table}/${primaryKey}`, {
                    method: 'PUT',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra updateRow failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteRow': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const primaryKey = inputs.primaryKey || inputs.rowKey || '';
                const res = await fetch(`${baseUrl}/keyspaces/${ks}/${table}/${primaryKey}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra deleteRow failed: ${res.status} ${err}` };
                }
                return { output: { success: true } };
            }

            case 'searchRows': {
                const ks = inputs.keyspace || keyspace;
                const table = inputs.table || inputs.tableName || '';
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page-size', inputs.pageSize);
                if (inputs.pageState) params.set('page-state', inputs.pageState);
                if (inputs.fields) params.set('fields', inputs.fields);
                const body = inputs.where || inputs.filter || {};
                const res = await fetch(`${baseUrl}/keyspaces/${ks}/${table}?${params.toString()}`, {
                    method: 'GET',
                    headers: { ...authHeaders, 'where': JSON.stringify(body) },
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra searchRows failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getSchema': {
                const ks = inputs.keyspace || keyspace;
                const res = await fetch(`${baseUrl}/schemas/keyspaces/${ks}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `Cassandra getSchema failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            default:
                return { error: `Apache Cassandra action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger.log(`Apache Cassandra action error: ${error?.message}`);
        return { error: error?.message || 'Unknown error in Apache Cassandra action' };
    }
}
