'use server';

export async function executeSingleStoreAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { apiKey } = inputs;
        const baseUrl = 'https://api.singlestore.com';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listWorkspaceGroups': {
                const res = await fetch(`${baseUrl}/v1/workspaceGroups`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listWorkspaceGroups failed' };
                return { output: data };
            }

            case 'getWorkspaceGroup': {
                const res = await fetch(`${baseUrl}/v1/workspaceGroups/${inputs.workspaceGroupID}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'getWorkspaceGroup failed' };
                return { output: data };
            }

            case 'createWorkspaceGroup': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    regionID: inputs.regionID,
                };
                if (inputs.adminPassword) body.adminPassword = inputs.adminPassword;
                if (inputs.expiresAt) body.expiresAt = inputs.expiresAt;
                if (inputs.firewallRanges) body.firewallRanges = inputs.firewallRanges;
                const res = await fetch(`${baseUrl}/v1/workspaceGroups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'createWorkspaceGroup failed' };
                return { output: data };
            }

            case 'listWorkspaces': {
                const params = new URLSearchParams();
                if (inputs.workspaceGroupID) params.set('workspaceGroupID', inputs.workspaceGroupID);
                const res = await fetch(`${baseUrl}/v1/workspaces?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listWorkspaces failed' };
                return { output: data };
            }

            case 'getWorkspace': {
                const res = await fetch(`${baseUrl}/v1/workspaces/${inputs.workspaceID}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'getWorkspace failed' };
                return { output: data };
            }

            case 'createWorkspace': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    workspaceGroupID: inputs.workspaceGroupID,
                    size: inputs.size ?? 'S-1',
                };
                if (inputs.autoSuspend !== undefined) body.autoSuspend = inputs.autoSuspend;
                const res = await fetch(`${baseUrl}/v1/workspaces`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'createWorkspace failed' };
                return { output: data };
            }

            case 'suspendWorkspace': {
                const res = await fetch(`${baseUrl}/v1/workspaces/${inputs.workspaceID}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ suspended: true }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'suspendWorkspace failed' };
                return { output: data };
            }

            case 'resumeWorkspace': {
                const res = await fetch(`${baseUrl}/v1/workspaces/${inputs.workspaceID}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ suspended: false }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'resumeWorkspace failed' };
                return { output: data };
            }

            case 'terminateWorkspace': {
                const res = await fetch(`${baseUrl}/v1/workspaces/${inputs.workspaceID}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data?.message ?? 'terminateWorkspace failed' };
            }

            case 'executeQuery': {
                const body: Record<string, any> = {
                    sql: inputs.sql,
                };
                if (inputs.database) body.database = inputs.database;
                if (inputs.args) body.args = inputs.args;
                const res = await fetch(`${baseUrl}/v1/exec`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'executeQuery failed' };
                return { output: data };
            }

            case 'listDatabases': {
                const params = new URLSearchParams();
                if (inputs.workspaceGroupID) params.set('workspaceGroupID', inputs.workspaceGroupID);
                const res = await fetch(`${baseUrl}/v1/databases?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listDatabases failed' };
                return { output: data };
            }

            case 'createDatabase': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    workspaceGroupID: inputs.workspaceGroupID,
                };
                const res = await fetch(`${baseUrl}/v1/databases`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'createDatabase failed' };
                return { output: data };
            }

            case 'listStorages': {
                const res = await fetch(`${baseUrl}/v1/storages`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'listStorages failed' };
                return { output: data };
            }

            case 'getCredentials': {
                const res = await fetch(`${baseUrl}/v1/sharedtier/virtualWorkspaces/${inputs.virtualWorkspaceID}/credentials`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'getCredentials failed' };
                return { output: data };
            }

            case 'createCredential': {
                const body: Record<string, any> = {
                    username: inputs.username,
                    password: inputs.password,
                };
                if (inputs.virtualWorkspaceID) {
                    const res = await fetch(`${baseUrl}/v1/sharedtier/virtualWorkspaces/${inputs.virtualWorkspaceID}/credentials`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body),
                    });
                    const data = await res.json();
                    if (!res.ok) return { error: data?.message ?? 'createCredential failed' };
                    return { output: data };
                }
                const res = await fetch(`${baseUrl}/v1/credentials`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? 'createCredential failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown SingleStore action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`SingleStore action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in SingleStore action' };
    }
}
