'use server';

export async function executeSnowflakeEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { account, token, accessToken } = inputs;
        const baseUrl = `https://${account}.snowflakecomputing.com/api/v2`;
        const authHeader = token
            ? `Snowflake Token="${token}"`
            : `Bearer ${accessToken}`;
        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'executeStatement': {
                const body: Record<string, any> = {
                    statement: inputs.statement,
                    timeout: inputs.timeout ?? 60,
                };
                if (inputs.database) body.database = inputs.database;
                if (inputs.schema) body.schema = inputs.schema;
                if (inputs.warehouse) body.warehouse = inputs.warehouse;
                if (inputs.role) body.role = inputs.role;
                if (inputs.bindings) body.bindings = inputs.bindings;
                const res = await fetch(`${baseUrl}/statements`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'executeStatement failed' };
                return { output: data };
            }

            case 'listStatements': {
                const params = new URLSearchParams();
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/statements?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listStatements failed' };
                return { output: data };
            }

            case 'cancelStatement': {
                const res = await fetch(`${baseUrl}/statements/${inputs.statementHandle}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'cancelStatement failed' };
                return { output: data };
            }

            case 'listDatabases': {
                const params = new URLSearchParams();
                if (inputs.like) params.set('like', inputs.like);
                if (inputs.startsWith) params.set('startsWith', inputs.startsWith);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/databases?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listDatabases failed' };
                return { output: data };
            }

            case 'getDatabase': {
                const res = await fetch(`${baseUrl}/databases/${inputs.databaseName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'getDatabase failed' };
                return { output: data };
            }

            case 'createDatabase': {
                const body: Record<string, any> = {
                    name: inputs.databaseName,
                };
                if (inputs.comment) body.comment = inputs.comment;
                if (inputs.dataRetentionTimeInDays !== undefined) body.dataRetentionTimeInDays = inputs.dataRetentionTimeInDays;
                const res = await fetch(`${baseUrl}/databases`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'createDatabase failed' };
                return { output: data };
            }

            case 'listSchemas': {
                const params = new URLSearchParams();
                if (inputs.like) params.set('like', inputs.like);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/databases/${inputs.databaseName}/schemas?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listSchemas failed' };
                return { output: data };
            }

            case 'getSchema': {
                const res = await fetch(`${baseUrl}/databases/${inputs.databaseName}/schemas/${inputs.schemaName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'getSchema failed' };
                return { output: data };
            }

            case 'createSchema': {
                const body: Record<string, any> = {
                    name: inputs.schemaName,
                };
                if (inputs.comment) body.comment = inputs.comment;
                const res = await fetch(`${baseUrl}/databases/${inputs.databaseName}/schemas`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'createSchema failed' };
                return { output: data };
            }

            case 'listTables': {
                const params = new URLSearchParams();
                if (inputs.like) params.set('like', inputs.like);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(
                    `${baseUrl}/databases/${inputs.databaseName}/schemas/${inputs.schemaName}/tables?${params}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listTables failed' };
                return { output: data };
            }

            case 'getTable': {
                const res = await fetch(
                    `${baseUrl}/databases/${inputs.databaseName}/schemas/${inputs.schemaName}/tables/${inputs.tableName}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'getTable failed' };
                return { output: data };
            }

            case 'createTable': {
                const body: Record<string, any> = {
                    name: inputs.tableName,
                    columns: inputs.columns,
                };
                if (inputs.comment) body.comment = inputs.comment;
                const res = await fetch(
                    `${baseUrl}/databases/${inputs.databaseName}/schemas/${inputs.schemaName}/tables`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body),
                    }
                );
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'createTable failed' };
                return { output: data };
            }

            case 'listWarehouses': {
                const params = new URLSearchParams();
                if (inputs.like) params.set('like', inputs.like);
                const res = await fetch(`${baseUrl}/warehouses?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listWarehouses failed' };
                return { output: data };
            }

            case 'getWarehouse': {
                const res = await fetch(`${baseUrl}/warehouses/${inputs.warehouseName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'getWarehouse failed' };
                return { output: data };
            }

            case 'resumeWarehouse': {
                const res = await fetch(`${baseUrl}/warehouses/${inputs.warehouseName}/resume`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'resumeWarehouse failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown Snowflake Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Snowflake Enhanced action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in Snowflake Enhanced action' };
    }
}
