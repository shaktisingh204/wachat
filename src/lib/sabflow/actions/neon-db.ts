'use server';

export async function executeNeonDBAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://console.neon.tech/api/v2';
        const apiKey = inputs.apiKey || '';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const apiGet = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Neon error ${res.status}: ${text}`);
            }
            return res.json();
        };

        const apiPost = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Neon error ${res.status}: ${text}`);
            }
            return res.json();
        };

        const apiPatch = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Neon error ${res.status}: ${text}`);
            }
            return res.json();
        };

        const apiDelete = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Neon error ${res.status}: ${text}`);
            }
            return res.status === 204 ? { success: true } : res.json();
        };

        switch (actionName) {
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const query = params.toString() ? `?${params}` : '';
                const result = await apiGet(`/projects${query}`);
                return { output: result };
            }

            case 'getProject': {
                const result = await apiGet(`/projects/${inputs.projectId}`);
                return { output: result };
            }

            case 'createProject': {
                const result = await apiPost('/projects', {
                    project: {
                        name: inputs.name,
                        region_id: inputs.regionId || 'aws-us-east-2',
                        pg_version: inputs.pgVersion || 16,
                        default_endpoint_settings: inputs.endpointSettings || {},
                    },
                });
                return { output: result };
            }

            case 'updateProject': {
                const result = await apiPatch(`/projects/${inputs.projectId}`, {
                    project: {
                        name: inputs.name,
                        default_endpoint_settings: inputs.endpointSettings,
                    },
                });
                return { output: result };
            }

            case 'deleteProject': {
                const result = await apiDelete(`/projects/${inputs.projectId}`);
                return { output: result };
            }

            case 'listBranches': {
                const result = await apiGet(`/projects/${inputs.projectId}/branches`);
                return { output: result };
            }

            case 'getBranch': {
                const result = await apiGet(`/projects/${inputs.projectId}/branches/${inputs.branchId}`);
                return { output: result };
            }

            case 'createBranch': {
                const result = await apiPost(`/projects/${inputs.projectId}/branches`, {
                    branch: {
                        name: inputs.name,
                        parent_id: inputs.parentId,
                        parent_lsn: inputs.parentLsn,
                        parent_timestamp: inputs.parentTimestamp,
                    },
                    endpoints: inputs.endpoints,
                });
                return { output: result };
            }

            case 'updateBranch': {
                const result = await apiPatch(`/projects/${inputs.projectId}/branches/${inputs.branchId}`, {
                    branch: { name: inputs.name },
                });
                return { output: result };
            }

            case 'deleteBranch': {
                const result = await apiDelete(`/projects/${inputs.projectId}/branches/${inputs.branchId}`);
                return { output: result };
            }

            case 'listEndpoints': {
                const result = await apiGet(`/projects/${inputs.projectId}/endpoints`);
                return { output: result };
            }

            case 'getEndpoint': {
                const result = await apiGet(`/projects/${inputs.projectId}/endpoints/${inputs.endpointId}`);
                return { output: result };
            }

            case 'createEndpoint': {
                const result = await apiPost(`/projects/${inputs.projectId}/endpoints`, {
                    endpoint: {
                        branch_id: inputs.branchId,
                        type: inputs.type || 'read_write',
                        settings: inputs.settings || {},
                        autoscaling_limit_min_cu: inputs.minCu,
                        autoscaling_limit_max_cu: inputs.maxCu,
                        suspend_timeout_seconds: inputs.suspendTimeout,
                    },
                });
                return { output: result };
            }

            case 'deleteEndpoint': {
                const result = await apiDelete(`/projects/${inputs.projectId}/endpoints/${inputs.endpointId}`);
                return { output: result };
            }

            case 'listDatabases': {
                const result = await apiGet(`/projects/${inputs.projectId}/branches/${inputs.branchId}/databases`);
                return { output: result };
            }

            default:
                logger.log(`Neon DB: Unknown action "${actionName}"`);
                return { error: `Unknown Neon DB action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Neon DB action error: ${err.message}`);
        return { error: err.message || 'Unknown Neon DB error' };
    }
}
