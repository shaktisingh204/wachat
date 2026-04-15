'use server';

export async function executeTursoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiBase = 'https://api.turso.tech/v1';

        const apiRequest = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${apiBase}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${inputs.apiToken}`,
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
            return data;
        };

        const executeSql = async (statements: { type: string; stmt: { sql: string; args?: any[] } }[]) => {
            const dbUrl = inputs.databaseUrl;
            const authToken = inputs.authToken;
            const res = await fetch(`${dbUrl}/v2/pipeline`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ requests: statements }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || JSON.stringify(data));
            return data;
        };

        switch (actionName) {
            case 'listOrganizations': {
                const data = await apiRequest('GET', '/organizations');
                return { output: data };
            }
            case 'getOrganization': {
                const data = await apiRequest('GET', `/organizations/${inputs.organizationName}`);
                return { output: data };
            }
            case 'listDatabases': {
                const data = await apiRequest('GET', `/organizations/${inputs.organizationName}/databases`);
                return { output: data };
            }
            case 'getDatabase': {
                const data = await apiRequest('GET', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}`);
                return { output: data };
            }
            case 'createDatabase': {
                const body: any = { name: inputs.name };
                if (inputs.group) body.group = inputs.group;
                if (inputs.seed) body.seed = inputs.seed;
                const data = await apiRequest('POST', `/organizations/${inputs.organizationName}/databases`, body);
                return { output: data };
            }
            case 'deleteDatabase': {
                const data = await apiRequest('DELETE', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}`);
                return { output: data };
            }
            case 'getDatabaseStats': {
                const data = await apiRequest('GET', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}/stats`);
                return { output: data };
            }
            case 'listInstances': {
                const data = await apiRequest('GET', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}/instances`);
                return { output: data };
            }
            case 'getInstance': {
                const data = await apiRequest('GET', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}/instances/${inputs.instanceName}`);
                return { output: data };
            }
            case 'createInstance': {
                const body: any = { location: inputs.location };
                if (inputs.password) body.password = inputs.password;
                const data = await apiRequest('POST', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}/instances`, body);
                return { output: data };
            }
            case 'deleteInstance': {
                const data = await apiRequest('DELETE', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}/instances/${inputs.instanceName}`);
                return { output: data };
            }
            case 'executeQuery': {
                const sql = inputs.sql as string;
                const args = inputs.args || [];
                const data = await executeSql([
                    { type: 'execute', stmt: { sql, args } },
                    { type: 'close', stmt: { sql: '' } },
                ]);
                return { output: data };
            }
            case 'executeTransaction': {
                const statements: string[] = inputs.statements || [];
                const requests = [
                    ...statements.map((sql) => ({ type: 'execute', stmt: { sql } })),
                    { type: 'close', stmt: { sql: '' } },
                ];
                const data = await executeSql(requests as any);
                return { output: data };
            }
            case 'listLocations': {
                const data = await apiRequest('GET', '/locations');
                return { output: data };
            }
            case 'getDatabaseUsage': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiRequest('GET', `/organizations/${inputs.organizationName}/databases/${inputs.databaseName}/usage${query}`);
                return { output: data };
            }
            default:
                return { error: `Unknown Turso action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Turso action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
