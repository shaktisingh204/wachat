'use server';

export async function executePlanetscaleAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiBase = 'https://api.planetscale.com/v1';

        const getAdminAuth = (): string => {
            const encoded = Buffer.from(`${inputs.serviceTokenId}:${inputs.serviceToken}`).toString('base64');
            return `Basic ${encoded}`;
        };

        const apiRequest = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${apiBase}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getAdminAuth(),
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.code || JSON.stringify(data));
            return data;
        };

        const executeSQL = async (sql: string, args?: any[]) => {
            const host = inputs.host || `aws.connect.psdb.cloud`;
            const database = inputs.database;
            const encoded = Buffer.from(`${inputs.username || inputs.serviceTokenId}:${inputs.password || inputs.serviceToken}`).toString('base64');
            const res = await fetch(`https://${host}/${database}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${encoded}`,
                },
                body: JSON.stringify({ query: sql, variables: args || [] }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || JSON.stringify(data));
            return data;
        };

        switch (actionName) {
            case 'listOrganizations': {
                const data = await apiRequest('GET', '/organizations');
                return { output: data };
            }
            case 'listDatabases': {
                const data = await apiRequest('GET', `/organizations/${inputs.organization}/databases`);
                return { output: data };
            }
            case 'createDatabase': {
                const data = await apiRequest('POST', `/organizations/${inputs.organization}/databases`, {
                    name: inputs.name,
                    notes: inputs.notes,
                    plan: inputs.plan,
                    region: inputs.region,
                    cluster_size: inputs.clusterSize,
                });
                return { output: data };
            }
            case 'getDatabase': {
                const data = await apiRequest('GET', `/organizations/${inputs.organization}/databases/${inputs.database}`);
                return { output: data };
            }
            case 'deleteDatabase': {
                const data = await apiRequest('DELETE', `/organizations/${inputs.organization}/databases/${inputs.database}`);
                return { output: data };
            }
            case 'listBranches': {
                const data = await apiRequest('GET', `/organizations/${inputs.organization}/databases/${inputs.database}/branches`);
                return { output: data };
            }
            case 'createBranch': {
                const data = await apiRequest('POST', `/organizations/${inputs.organization}/databases/${inputs.database}/branches`, {
                    name: inputs.branchName,
                    parent_branch: inputs.parentBranch || 'main',
                    backup_id: inputs.backupId,
                });
                return { output: data };
            }
            case 'deleteBranch': {
                const data = await apiRequest('DELETE', `/organizations/${inputs.organization}/databases/${inputs.database}/branches/${inputs.branch}`);
                return { output: data };
            }
            case 'getBranch': {
                const data = await apiRequest('GET', `/organizations/${inputs.organization}/databases/${inputs.database}/branches/${inputs.branch}`);
                return { output: data };
            }
            case 'listDeployRequests': {
                const data = await apiRequest('GET', `/organizations/${inputs.organization}/databases/${inputs.database}/deploy-requests`);
                return { output: data };
            }
            case 'createDeployRequest': {
                const data = await apiRequest('POST', `/organizations/${inputs.organization}/databases/${inputs.database}/deploy-requests`, {
                    branch: inputs.branch,
                    into_branch: inputs.intoBranch || 'main',
                    notes: inputs.notes,
                });
                return { output: data };
            }
            case 'mergeDeployRequest': {
                const data = await apiRequest('POST', `/organizations/${inputs.organization}/databases/${inputs.database}/deploy-requests/${inputs.deployRequestNumber}/deploy`);
                return { output: data };
            }
            case 'executeQuery': {
                const data = await executeSQL(inputs.query, inputs.args);
                return { output: data };
            }
            case 'listPasswords': {
                const data = await apiRequest('GET', `/organizations/${inputs.organization}/databases/${inputs.database}/branches/${inputs.branch}/passwords`);
                return { output: data };
            }
            case 'createPassword': {
                const data = await apiRequest('POST', `/organizations/${inputs.organization}/databases/${inputs.database}/branches/${inputs.branch}/passwords`, {
                    name: inputs.name,
                    role: inputs.role || 'readwriter',
                    ttl: inputs.ttl,
                });
                return { output: data };
            }
            default:
                return { error: `Unknown PlanetScale action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`PlanetScale action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
