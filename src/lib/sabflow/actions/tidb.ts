'use server';

export async function executeTidbAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = (inputs.baseUrl || 'https://api.tidbcloud.com').replace(/\/$/, '');
        const publicKey = inputs.publicKey || '';
        const privateKey = inputs.privateKey || '';
        const bearerToken = inputs.bearerToken || inputs.token || '';

        // Build auth headers — prefer bearer token, fall back to Basic (publicKey:privateKey)
        const authHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (bearerToken) {
            authHeaders['Authorization'] = `Bearer ${bearerToken}`;
        } else {
            authHeaders['Authorization'] = `Basic ${Buffer.from(`${publicKey}:${privateKey}`).toString('base64')}`;
        }

        const apiV1 = `${baseUrl}/api/v1beta`;

        switch (actionName) {
            case 'listProjects': {
                const res = await fetch(`${apiV1}/projects`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB listProjects failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getProject': {
                const projectId = inputs.projectId || inputs.id || '';
                const res = await fetch(`${apiV1}/projects/${projectId}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB getProject failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listClusters': {
                const projectId = inputs.projectId || '';
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('page_size', inputs.pageSize);
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters?${params.toString()}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB listClusters failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getCluster': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || inputs.id || '';
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters/${clusterId}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB getCluster failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createCluster': {
                const projectId = inputs.projectId || '';
                const body = {
                    name: inputs.name || '',
                    cluster_type: inputs.clusterType || 'DEVELOPER',
                    cloud_provider: inputs.cloudProvider || 'AWS',
                    region: inputs.region || 'us-east-1',
                    config: inputs.config || {},
                };
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB createCluster failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteCluster': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || inputs.id || '';
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters/${clusterId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB deleteCluster failed: ${res.status} ${err}` };
                }
                return { output: { success: true } };
            }

            case 'listBackups': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || '';
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('page_size', inputs.pageSize);
                const res = await fetch(
                    `${apiV1}/projects/${projectId}/clusters/${clusterId}/backups?${params.toString()}`,
                    { headers: authHeaders }
                );
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB listBackups failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createBackup': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || '';
                const body = {
                    name: inputs.name || `backup-${Date.now()}`,
                    description: inputs.description || '',
                };
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters/${clusterId}/backups`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB createBackup failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'restoreBackup': {
                const projectId = inputs.projectId || '';
                const body = {
                    backup_id: inputs.backupId || '',
                    name: inputs.name || '',
                    config: inputs.config || {},
                };
                const res = await fetch(`${apiV1}/projects/${projectId}/restores`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB restoreBackup failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'executeQuery': {
                // Data App / Data Service endpoint
                const dataAppUrl = inputs.dataAppUrl || inputs.endpointUrl || `${baseUrl}/data/v1/query`;
                const body = {
                    cluster_id: inputs.clusterId || '',
                    database: inputs.database || '',
                    sql: inputs.query || inputs.sql || '',
                    max_rows: inputs.maxRows || 1000,
                };
                const res = await fetch(dataAppUrl, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB executeQuery failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listDatabases': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || '';
                const res = await fetch(
                    `${apiV1}/projects/${projectId}/clusters/${clusterId}/databases`,
                    { headers: authHeaders }
                );
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB listDatabases failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createDatabase': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || '';
                const body = { name: inputs.name || inputs.database || '' };
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters/${clusterId}/databases`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB createDatabase failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listTables': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || '';
                const database = inputs.database || '';
                const res = await fetch(
                    `${apiV1}/projects/${projectId}/clusters/${clusterId}/databases/${database}/tables`,
                    { headers: authHeaders }
                );
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB listTables failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'importData': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || '';
                const body = {
                    type: inputs.type || 'S3',
                    data_format: inputs.dataFormat || 'CSV',
                    csv_format: inputs.csvFormat || {},
                    source_url: inputs.sourceUrl || '',
                    target_table: inputs.targetTable || {},
                };
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters/${clusterId}/imports`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB importData failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'exportData': {
                const projectId = inputs.projectId || '';
                const clusterId = inputs.clusterId || '';
                const body = {
                    database: inputs.database || '',
                    table: inputs.table || '',
                    target: inputs.target || {},
                    data_format: inputs.dataFormat || 'CSV',
                };
                const res = await fetch(`${apiV1}/projects/${projectId}/clusters/${clusterId}/exports`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `TiDB exportData failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            default:
                return { error: `TiDB action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger.log(`TiDB action error: ${error?.message}`);
        return { error: error?.message || 'Unknown error in TiDB action' };
    }
}
