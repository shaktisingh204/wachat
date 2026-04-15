'use server';

export async function executeNeonAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiBase = 'https://console.neon.tech/api/v2';

        const apiRequest = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${apiBase}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${inputs.apiKey}`,
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
            return data;
        };

        const executeQuery = async (sql: string, params?: any[]) => {
            const host = inputs.host;
            const encoded = Buffer.from(`${inputs.user}:${inputs.password}`).toString('base64');
            const res = await fetch(`https://${host}/sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${encoded}`,
                    'Neon-Connection-String': inputs.connectionString || '',
                },
                body: JSON.stringify({
                    query: sql,
                    params: params || [],
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
            return data;
        };

        switch (actionName) {
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiRequest('GET', `/projects${query}`);
                return { output: data };
            }
            case 'getProject': {
                const data = await apiRequest('GET', `/projects/${inputs.projectId}`);
                return { output: data };
            }
            case 'createProject': {
                const data = await apiRequest('POST', '/projects', {
                    project: {
                        name: inputs.name,
                        region_id: inputs.regionId || 'aws-us-east-2',
                        pg_version: inputs.pgVersion || 16,
                        provisioner: inputs.provisioner || 'k8s-neonvm',
                        autoscaling_limit_min_cu: inputs.minCu,
                        autoscaling_limit_max_cu: inputs.maxCu,
                    },
                });
                return { output: data };
            }
            case 'deleteProject': {
                const data = await apiRequest('DELETE', `/projects/${inputs.projectId}`);
                return { output: data };
            }
            case 'listBranches': {
                const data = await apiRequest('GET', `/projects/${inputs.projectId}/branches`);
                return { output: data };
            }
            case 'createBranch': {
                const data = await apiRequest('POST', `/projects/${inputs.projectId}/branches`, {
                    branch: {
                        name: inputs.branchName,
                        parent_id: inputs.parentId,
                        parent_lsn: inputs.parentLsn,
                        parent_timestamp: inputs.parentTimestamp,
                    },
                    endpoints: inputs.createEndpoint ? [{ type: 'read_write' }] : undefined,
                });
                return { output: data };
            }
            case 'deleteBranch': {
                const data = await apiRequest('DELETE', `/projects/${inputs.projectId}/branches/${inputs.branchId}`);
                return { output: data };
            }
            case 'getBranch': {
                const data = await apiRequest('GET', `/projects/${inputs.projectId}/branches/${inputs.branchId}`);
                return { output: data };
            }
            case 'listEndpoints': {
                const data = await apiRequest('GET', `/projects/${inputs.projectId}/endpoints`);
                return { output: data };
            }
            case 'createEndpoint': {
                const data = await apiRequest('POST', `/projects/${inputs.projectId}/endpoints`, {
                    endpoint: {
                        branch_id: inputs.branchId,
                        type: inputs.type || 'read_write',
                        region_id: inputs.regionId,
                        autoscaling_limit_min_cu: inputs.minCu,
                        autoscaling_limit_max_cu: inputs.maxCu,
                        provisioner: inputs.provisioner || 'k8s-neonvm',
                    },
                });
                return { output: data };
            }
            case 'deleteEndpoint': {
                const data = await apiRequest('DELETE', `/projects/${inputs.projectId}/endpoints/${inputs.endpointId}`);
                return { output: data };
            }
            case 'listDatabases': {
                const data = await apiRequest('GET', `/projects/${inputs.projectId}/branches/${inputs.branchId}/databases`);
                return { output: data };
            }
            case 'createDatabase': {
                const data = await apiRequest('POST', `/projects/${inputs.projectId}/branches/${inputs.branchId}/databases`, {
                    database: {
                        name: inputs.name,
                        owner_name: inputs.ownerName,
                    },
                });
                return { output: data };
            }
            case 'deleteDatabase': {
                const data = await apiRequest('DELETE', `/projects/${inputs.projectId}/branches/${inputs.branchId}/databases/${inputs.databaseName}`);
                return { output: data };
            }
            case 'executeQuery': {
                const data = await executeQuery(inputs.query, inputs.params);
                return { output: data };
            }
            default:
                return { error: `Unknown Neon action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Neon action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
