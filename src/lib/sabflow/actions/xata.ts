'use server';

export async function executeXataAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiBase = 'https://api.xata.io';

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
            if (!res.ok) throw new Error(data.message || data.errors?.[0]?.message || JSON.stringify(data));
            return data;
        };

        // Workspace-scoped request helper
        const workspaceRequest = async (method: string, path: string, body?: any) => {
            const workspaceId = inputs.workspaceId;
            const region = inputs.region || 'us-east-1';
            const base = `https://${workspaceId}.${region}.xata.sh`;
            const res = await fetch(`${base}${path}`, {
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
            if (!res.ok) throw new Error(data.message || data.errors?.[0]?.message || JSON.stringify(data));
            return data;
        };

        switch (actionName) {
            case 'listDatabases': {
                const data = await apiRequest('GET', `/workspaces/${inputs.workspaceId}/dbs`);
                return { output: data };
            }
            case 'getDatabase': {
                const data = await apiRequest('GET', `/workspaces/${inputs.workspaceId}/dbs/${inputs.dbName}`);
                return { output: data };
            }
            case 'createDatabase': {
                const body: any = { defaultBranchName: inputs.defaultBranchName || 'main' };
                if (inputs.region) body.region = inputs.region;
                if (inputs.ui) body.ui = inputs.ui;
                const data = await apiRequest('PUT', `/workspaces/${inputs.workspaceId}/dbs/${inputs.dbName}`, body);
                return { output: data };
            }
            case 'deleteDatabase': {
                const data = await apiRequest('DELETE', `/workspaces/${inputs.workspaceId}/dbs/${inputs.dbName}`);
                return { output: data };
            }
            case 'listBranches': {
                const data = await workspaceRequest('GET', `/db/${inputs.dbName}`);
                return { output: data };
            }
            case 'getBranch': {
                const data = await workspaceRequest('GET', `/db/${inputs.dbName}:${inputs.branchName}`);
                return { output: data };
            }
            case 'createBranch': {
                const body: any = {};
                if (inputs.from) body.from = inputs.from;
                if (inputs.metadata) body.metadata = inputs.metadata;
                const data = await workspaceRequest('PUT', `/db/${inputs.dbName}:${inputs.branchName}`, body);
                return { output: data };
            }
            case 'deleteBranch': {
                const data = await workspaceRequest('DELETE', `/db/${inputs.dbName}:${inputs.branchName}`);
                return { output: data };
            }
            case 'listTables': {
                const data = await workspaceRequest('GET', `/db/${inputs.dbName}:${inputs.branchName}/tables`);
                return { output: data };
            }
            case 'createTable': {
                const data = await workspaceRequest('PUT', `/db/${inputs.dbName}:${inputs.branchName}/tables/${inputs.tableName}`);
                return { output: data };
            }
            case 'getTableSchema': {
                const data = await workspaceRequest('GET', `/db/${inputs.dbName}:${inputs.branchName}/tables/${inputs.tableName}/schema`);
                return { output: data };
            }
            case 'insertRecord': {
                const data = await workspaceRequest('POST', `/db/${inputs.dbName}:${inputs.branchName}/tables/${inputs.tableName}/data`, inputs.record);
                return { output: data };
            }
            case 'getRecord': {
                const data = await workspaceRequest('GET', `/db/${inputs.dbName}:${inputs.branchName}/tables/${inputs.tableName}/data/${inputs.recordId}`);
                return { output: data };
            }
            case 'updateRecord': {
                const data = await workspaceRequest('PATCH', `/db/${inputs.dbName}:${inputs.branchName}/tables/${inputs.tableName}/data/${inputs.recordId}`, inputs.record);
                return { output: data };
            }
            case 'deleteRecord': {
                const data = await workspaceRequest('DELETE', `/db/${inputs.dbName}:${inputs.branchName}/tables/${inputs.tableName}/data/${inputs.recordId}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Xata action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Xata action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
