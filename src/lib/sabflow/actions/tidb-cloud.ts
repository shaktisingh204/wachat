'use server';

export async function executeTiDBCloudAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://api.tidbcloud.com/api/v1beta';
        const credentials = Buffer.from(`${inputs.publicKey}:${inputs.privateKey}`).toString('base64');

        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
        };

        const apiGet = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`TiDB Cloud error ${res.status}: ${text}`);
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
                throw new Error(`TiDB Cloud error ${res.status}: ${text}`);
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
                throw new Error(`TiDB Cloud error ${res.status}: ${text}`);
            }
            return res.json();
        };

        const apiDelete = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`TiDB Cloud error ${res.status}: ${text}`);
            }
            return res.status === 204 ? { success: true } : res.json();
        };

        switch (actionName) {
            case 'listProjects': {
                const result = await apiGet('/projects');
                return { output: result };
            }

            case 'getProject': {
                const result = await apiGet(`/projects/${inputs.projectId}`);
                return { output: result };
            }

            case 'createProject': {
                const result = await apiPost('/projects', {
                    name: inputs.name,
                    aws_cmek_enabled: inputs.awsCmekEnabled || false,
                });
                return { output: result };
            }

            case 'deleteProject': {
                const result = await apiDelete(`/projects/${inputs.projectId}`);
                return { output: result };
            }

            case 'listClusters': {
                const result = await apiGet(`/projects/${inputs.projectId}/clusters`);
                return { output: result };
            }

            case 'getCluster': {
                const result = await apiGet(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}`);
                return { output: result };
            }

            case 'createCluster': {
                const result = await apiPost(`/projects/${inputs.projectId}/clusters`, {
                    name: inputs.name,
                    cluster_type: inputs.clusterType || 'DEVELOPER',
                    cloud_provider: inputs.cloudProvider || 'AWS',
                    region: inputs.region || 'us-east-1',
                    config: inputs.config || {},
                });
                return { output: result };
            }

            case 'deleteCluster': {
                const result = await apiDelete(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}`);
                return { output: result };
            }

            case 'pauseCluster': {
                const result = await apiPost(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}/pause`, {});
                return { output: result };
            }

            case 'resumeCluster': {
                const result = await apiPost(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}/resume`, {});
                return { output: result };
            }

            case 'listBackups': {
                const result = await apiGet(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}/backups`);
                return { output: result };
            }

            case 'createBackup': {
                const result = await apiPost(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}/backups`, {
                    name: inputs.name || `backup-${Date.now()}`,
                    description: inputs.description || '',
                });
                return { output: result };
            }

            case 'restoreCluster': {
                const result = await apiPost(`/projects/${inputs.projectId}/restores`, {
                    backup_id: inputs.backupId,
                    name: inputs.name,
                    config: inputs.config || {},
                });
                return { output: result };
            }

            case 'listImportTasks': {
                const result = await apiGet(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}/imports`);
                return { output: result };
            }

            case 'getImportTask': {
                const result = await apiGet(`/projects/${inputs.projectId}/clusters/${inputs.clusterId}/imports/${inputs.importId}`);
                return { output: result };
            }

            default:
                logger.log(`TiDB Cloud: Unknown action "${actionName}"`);
                return { error: `Unknown TiDB Cloud action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`TiDB Cloud action error: ${err.message}`);
        return { error: err.message || 'Unknown TiDB Cloud error' };
    }
}
