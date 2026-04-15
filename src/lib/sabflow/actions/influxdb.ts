'use server';

export async function executeInfluxdbAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');
        const apiBase = `${baseUrl}/api/v2`;
        const token = inputs.token || '';
        const org = inputs.org || inputs.orgId || '';
        const bucket = inputs.bucket || '';

        const authHeaders: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'writeData': {
                // v1 compatibility: POST /write with line protocol
                const writeUrl = `${baseUrl}/write?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}&precision=${inputs.precision || 'ns'}`;
                const res = await fetch(writeUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'text/plain; charset=utf-8',
                    },
                    body: inputs.lineProtocol || inputs.data || '',
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB writeData failed: ${res.status} ${err}` };
                }
                return { output: { success: true, status: res.status } };
            }

            case 'queryData': {
                // v1 compat GET /query
                const params = new URLSearchParams({
                    db: inputs.db || bucket,
                    q: inputs.query || inputs.sql || '',
                    epoch: inputs.epoch || '',
                });
                const res = await fetch(`${baseUrl}/query?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB queryData failed: ${res.status} ${err}` };
                }
                const data = await res.json();
                return { output: data };
            }

            case 'queryFlux': {
                const res = await fetch(`${apiBase}/query?org=${encodeURIComponent(org)}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/vnd.flux',
                        'Accept': 'application/csv',
                    },
                    body: inputs.fluxQuery || inputs.query || '',
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB queryFlux failed: ${res.status} ${err}` };
                }
                const csv = await res.text();
                return { output: { csv } };
            }

            case 'listBuckets': {
                const params = new URLSearchParams({ org, limit: inputs.limit || '100', offset: inputs.offset || '0' });
                if (inputs.name) params.set('name', inputs.name);
                const res = await fetch(`${apiBase}/buckets?${params.toString()}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB listBuckets failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createBucket': {
                const body = {
                    name: inputs.name || bucket,
                    orgID: inputs.orgID || inputs.orgId || '',
                    retentionRules: inputs.retentionRules || [],
                    description: inputs.description || '',
                };
                const res = await fetch(`${apiBase}/buckets`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB createBucket failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'deleteBucket': {
                const bucketId = inputs.bucketId || inputs.id || '';
                const res = await fetch(`${apiBase}/buckets/${bucketId}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB deleteBucket failed: ${res.status} ${err}` };
                }
                return { output: { success: true } };
            }

            case 'getBucket': {
                const bucketId = inputs.bucketId || inputs.id || '';
                const res = await fetch(`${apiBase}/buckets/${bucketId}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB getBucket failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listOrganizations': {
                const params = new URLSearchParams({ limit: inputs.limit || '100', offset: inputs.offset || '0' });
                if (inputs.org) params.set('org', inputs.org);
                const res = await fetch(`${apiBase}/orgs?${params.toString()}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB listOrganizations failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getOrganization': {
                const orgId = inputs.orgId || inputs.id || '';
                const res = await fetch(`${apiBase}/orgs/${orgId}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB getOrganization failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listDashboards': {
                const params = new URLSearchParams({ org, limit: inputs.limit || '100', offset: inputs.offset || '0' });
                const res = await fetch(`${apiBase}/dashboards?${params.toString()}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB listDashboards failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getDashboard': {
                const dashboardId = inputs.dashboardId || inputs.id || '';
                const res = await fetch(`${apiBase}/dashboards/${dashboardId}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB getDashboard failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'listTasks': {
                const params = new URLSearchParams({ org, limit: inputs.limit || '100', offset: inputs.offset || '0' });
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${apiBase}/tasks?${params.toString()}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB listTasks failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getTask': {
                const taskId = inputs.taskId || inputs.id || '';
                const res = await fetch(`${apiBase}/tasks/${taskId}`, {
                    headers: authHeaders,
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB getTask failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'createTask': {
                const body = {
                    flux: inputs.flux || inputs.query || '',
                    orgID: inputs.orgID || inputs.orgId || '',
                    status: inputs.status || 'active',
                    description: inputs.description || '',
                };
                const res = await fetch(`${apiBase}/tasks`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB createTask failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            case 'getHealth': {
                const res = await fetch(`${baseUrl}/health`);
                if (!res.ok) {
                    const err = await res.text();
                    return { error: `InfluxDB getHealth failed: ${res.status} ${err}` };
                }
                return { output: await res.json() };
            }

            default:
                return { error: `InfluxDB action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger.log(`InfluxDB action error: ${error?.message}`);
        return { error: error?.message || 'Unknown error in InfluxDB action' };
    }
}
