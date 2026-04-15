'use server';

export async function executeCockroachdbAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const cloudApiBase = 'https://cockroachlabs.cloud/api/v1';
        const apiKey = inputs.apiKey || '';
        const cluster = inputs.cluster || inputs.clusterHost || '';

        const cloudHeaders: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listClusters': {
                const params = new URLSearchParams();
                if (inputs.showInactive) params.set('show_inactive', inputs.showInactive);
                if (inputs.paginationPage) params.set('pagination.page', inputs.paginationPage);
                if (inputs.paginationLimit) params.set('pagination.limit', inputs.paginationLimit);
                const res = await fetch(`${cloudApiBase}/clusters?${params.toString()}`, {
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB listClusters failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getCluster': {
                const clusterId = inputs.clusterId || inputs.id || '';
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}`, {
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB getCluster failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createCluster': {
                const body = {
                    name: inputs.name || '',
                    provider: inputs.provider || 'GCP',
                    spec: inputs.spec || {},
                };
                const res = await fetch(`${cloudApiBase}/clusters`, {
                    method: 'POST',
                    headers: cloudHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB createCluster failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteCluster': {
                const clusterId = inputs.clusterId || inputs.id || '';
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}`, {
                    method: 'DELETE',
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB deleteCluster failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listDatabases': {
                const clusterId = inputs.clusterId || '';
                const params = new URLSearchParams();
                if (inputs.paginationPage) params.set('pagination.page', inputs.paginationPage);
                if (inputs.paginationLimit) params.set('pagination.limit', inputs.paginationLimit);
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/databases?${params.toString()}`, {
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB listDatabases failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createDatabase': {
                const clusterId = inputs.clusterId || '';
                const body = { name: inputs.name || inputs.database || '' };
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/databases`, {
                    method: 'POST',
                    headers: cloudHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB createDatabase failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteDatabase': {
                const clusterId = inputs.clusterId || '';
                const database = inputs.database || inputs.name || '';
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/databases/${database}`, {
                    method: 'DELETE',
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB deleteDatabase failed: ${res.status} ${err}` };
                }
                return { output: { success: true } };
            }

            case 'listUsers': {
                const clusterId = inputs.clusterId || '';
                const params = new URLSearchParams();
                if (inputs.paginationPage) params.set('pagination.page', inputs.paginationPage);
                if (inputs.paginationLimit) params.set('pagination.limit', inputs.paginationLimit);
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/sql-users?${params.toString()}`, {
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB listUsers failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createUser': {
                const clusterId = inputs.clusterId || '';
                const body = {
                    name: inputs.name || inputs.username || '',
                    password: inputs.password || '',
                };
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/sql-users`, {
                    method: 'POST',
                    headers: cloudHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB createUser failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteUser': {
                const clusterId = inputs.clusterId || '';
                const username = inputs.username || inputs.name || '';
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/sql-users/${username}`, {
                    method: 'DELETE',
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB deleteUser failed: ${res.status} ${err}` };
                }
                return { output: { success: true } };
            }

            case 'executeQuery': {
                const sqlApiUrl = inputs.sqlApiUrl || `https://${cluster}:26257/api/v1/sql`;
                const sqlUser = inputs.sqlUser || inputs.username || '';
                const sqlPassword = inputs.sqlPassword || inputs.password || '';
                const basicAuth = Buffer.from(`${sqlUser}:${sqlPassword}`).toString('base64');
                const body = {
                    database: inputs.database || 'defaultdb',
                    statements: [{ sql: inputs.query || inputs.sql || '' }],
                };
                const res = await fetch(sqlApiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB executeQuery failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'executeBatch': {
                const sqlApiUrl = inputs.sqlApiUrl || `https://${cluster}:26257/api/v1/sql`;
                const sqlUser = inputs.sqlUser || inputs.username || '';
                const sqlPassword = inputs.sqlPassword || inputs.password || '';
                const basicAuth = Buffer.from(`${sqlUser}:${sqlPassword}`).toString('base64');
                const statements = (inputs.queries || inputs.statements || []).map((q: string) => ({ sql: q }));
                const body = {
                    database: inputs.database || 'defaultdb',
                    statements,
                };
                const res = await fetch(sqlApiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB executeBatch failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getClusterMetrics': {
                const clusterId = inputs.clusterId || '';
                const params = new URLSearchParams();
                if (inputs.granularity) params.set('granularity', inputs.granularity);
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/metrics?${params.toString()}`, {
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB getClusterMetrics failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'exportData': {
                const clusterId = inputs.clusterId || '';
                const body = {
                    target: inputs.target || {},
                    type: inputs.type || 'CSV',
                };
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/export`, {
                    method: 'POST',
                    headers: cloudHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB exportData failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listCertificates': {
                const clusterId = inputs.clusterId || '';
                const res = await fetch(`${cloudApiBase}/clusters/${clusterId}/certificates`, {
                    headers: cloudHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `CockroachDB listCertificates failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            default:
                return { error: `CockroachDB action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger.log(`CockroachDB action error: ${error?.message}`);
        return { error: error?.message || 'Unknown error in CockroachDB action' };
    }
}
