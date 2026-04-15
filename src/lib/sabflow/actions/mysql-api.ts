'use server';

export async function executeMySQLAPIAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const org = inputs.org;
        if (!org) return { error: 'org is required.' };

        const token = inputs.accessToken || inputs.password;
        if (!token) return { error: 'accessToken or password is required.' };

        const baseUrl = `https://api.planetscale.com/v1/organizations/${org}`;

        const req = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) return { error: (data && data.message) || text || 'Request failed.' };
            return { output: data };
        };

        switch (actionName) {
            case 'listDatabases': {
                return req('GET', '/databases');
            }

            case 'getDatabase': {
                const { database } = inputs;
                if (!database) return { error: 'database is required.' };
                return req('GET', `/databases/${database}`);
            }

            case 'createDatabase': {
                const { name, region, plan, clusterSize, defaultBranch } = inputs;
                if (!name) return { error: 'name is required.' };
                return req('POST', '/databases', {
                    name,
                    ...(region && { region }),
                    ...(plan && { plan }),
                    ...(clusterSize && { cluster_size: clusterSize }),
                    ...(defaultBranch && { default_branch: defaultBranch }),
                });
            }

            case 'deleteDatabase': {
                const { database } = inputs;
                if (!database) return { error: 'database is required.' };
                return req('DELETE', `/databases/${database}`);
            }

            case 'listBranches': {
                const { database } = inputs;
                if (!database) return { error: 'database is required.' };
                return req('GET', `/databases/${database}/branches`);
            }

            case 'getBranch': {
                const { database, branch } = inputs;
                if (!database || !branch) return { error: 'database and branch are required.' };
                return req('GET', `/databases/${database}/branches/${branch}`);
            }

            case 'createBranch': {
                const { database, name, parentBranch, backupId, seedData } = inputs;
                if (!database || !name) return { error: 'database and name are required.' };
                return req('POST', `/databases/${database}/branches`, {
                    name,
                    ...(parentBranch && { parent_branch: parentBranch }),
                    ...(backupId && { backup_id: backupId }),
                    ...(seedData !== undefined && { seed_data: seedData }),
                });
            }

            case 'deleteBranch': {
                const { database, branch } = inputs;
                if (!database || !branch) return { error: 'database and branch are required.' };
                return req('DELETE', `/databases/${database}/branches/${branch}`);
            }

            case 'runQuery': {
                const { database, branch, query } = inputs;
                if (!database || !query) return { error: 'database and query are required.' };
                const branchName = branch || 'main';
                return req('POST', `/databases/${database}/branches/${branchName}/execute`, {
                    query,
                });
            }

            case 'listPasswords': {
                const { database, branch } = inputs;
                if (!database) return { error: 'database is required.' };
                const branchName = branch || 'main';
                return req('GET', `/databases/${database}/branches/${branchName}/passwords`);
            }

            case 'createPassword': {
                const { database, branch, name, role, ttl } = inputs;
                if (!database || !name) return { error: 'database and name are required.' };
                const branchName = branch || 'main';
                return req('POST', `/databases/${database}/branches/${branchName}/passwords`, {
                    name,
                    ...(role && { role }),
                    ...(ttl && { ttl }),
                });
            }

            case 'deletePassword': {
                const { database, branch, passwordId } = inputs;
                if (!database || !passwordId) return { error: 'database and passwordId are required.' };
                const branchName = branch || 'main';
                return req('DELETE', `/databases/${database}/branches/${branchName}/passwords/${passwordId}`);
            }

            case 'getSchema': {
                const { database, branch } = inputs;
                if (!database) return { error: 'database is required.' };
                const branchName = branch || 'main';
                return req('GET', `/databases/${database}/branches/${branchName}/schema`);
            }

            case 'listTables': {
                const { database, branch } = inputs;
                if (!database) return { error: 'database is required.' };
                const branchName = branch || 'main';
                const result = await req('GET', `/databases/${database}/branches/${branchName}/schema`);
                if (result.error) return result;
                const schema: string = (result.output as any)?.sql || '';
                const tables = [...schema.matchAll(/CREATE TABLE[^`]*`([^`]+)`/gi)].map(m => m[1]);
                return { output: { tables } };
            }

            case 'getTableSchema': {
                const { database, branch, table } = inputs;
                if (!database || !table) return { error: 'database and table are required.' };
                const branchName = branch || 'main';
                return req('GET', `/databases/${database}/branches/${branchName}/schema?table=${encodeURIComponent(table)}`);
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
