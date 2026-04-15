'use server';

export async function executeConvexAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const deploymentUrl = (inputs.deploymentUrl as string).replace(/\/$/, '');
        const accessToken = inputs.accessToken as string;

        const apiRequest = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${deploymentUrl}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
            return data;
        };

        const dashboardRequest = async (method: string, path: string, body?: any) => {
            const res = await fetch(`https://api.convex.dev/v1${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
            return data;
        };

        switch (actionName) {
            case 'runQuery': {
                const body: any = { path: inputs.functionPath };
                if (inputs.args) body.args = inputs.args;
                const data = await apiRequest('POST', '/api/query', body);
                return { output: data };
            }
            case 'runMutation': {
                const body: any = { path: inputs.functionPath };
                if (inputs.args) body.args = inputs.args;
                const data = await apiRequest('POST', '/api/mutation', body);
                return { output: data };
            }
            case 'runAction': {
                const body: any = { path: inputs.functionPath };
                if (inputs.args) body.args = inputs.args;
                const data = await apiRequest('POST', '/api/action', body);
                return { output: data };
            }
            case 'listFunctions': {
                const data = await dashboardRequest('GET', `/deployments/${inputs.deploymentName}/functions`);
                return { output: data };
            }
            case 'getFunction': {
                const data = await dashboardRequest('GET', `/deployments/${inputs.deploymentName}/functions/${encodeURIComponent(inputs.functionPath)}`);
                return { output: data };
            }
            case 'listTables': {
                const data = await dashboardRequest('GET', `/deployments/${inputs.deploymentName}/tables`);
                return { output: data };
            }
            case 'getTableSchema': {
                const data = await dashboardRequest('GET', `/deployments/${inputs.deploymentName}/tables/${inputs.tableName}/schema`);
                return { output: data };
            }
            case 'listIndexes': {
                const data = await dashboardRequest('GET', `/deployments/${inputs.deploymentName}/tables/${inputs.tableName}/indexes`);
                return { output: data };
            }
            case 'getDeploymentStatus': {
                const data = await dashboardRequest('GET', `/deployments/${inputs.deploymentName}`);
                return { output: data };
            }
            case 'listFiles': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params}` : '';
                const data = await apiRequest('GET', `/api/storage/list${query}`);
                return { output: data };
            }
            case 'uploadFile': {
                const res = await fetch(`${deploymentUrl}/api/storage/upload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': inputs.contentType || 'application/octet-stream',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    body: inputs.fileData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
                return { output: data };
            }
            case 'deleteFile': {
                const data = await apiRequest('DELETE', `/api/storage/${inputs.storageId}`);
                return { output: data };
            }
            case 'scheduleFunction': {
                const body: any = {
                    path: inputs.functionPath,
                    ts: inputs.ts,
                };
                if (inputs.args) body.args = inputs.args;
                const data = await apiRequest('POST', '/api/schedule', body);
                return { output: data };
            }
            case 'cancelScheduledFunction': {
                const data = await apiRequest('DELETE', `/api/schedule/${inputs.jobId}`);
                return { output: data };
            }
            case 'listScheduledFunctions': {
                const data = await apiRequest('GET', '/api/schedule');
                return { output: data };
            }
            default:
                return { error: `Unknown Convex action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Convex action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
