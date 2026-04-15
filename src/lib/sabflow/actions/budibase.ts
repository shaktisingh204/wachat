'use server';

export async function executeBudibaseAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = inputs.budibaseUrl
            ? `${inputs.budibaseUrl}/api`
            : 'https://budibase.app/api';
        const headers: Record<string, string> = {
            'x-budibase-api-key': inputs.apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listApplications': {
                const res = await fetch(`${baseUrl}/applications/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.query || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list applications: ${res.status}` };
                return { output: data };
            }

            case 'getApplication': {
                const res = await fetch(`${baseUrl}/applications/${inputs.appId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get application: ${res.status}` };
                return { output: data };
            }

            case 'createApplication': {
                const res = await fetch(`${baseUrl}/applications`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create application: ${res.status}` };
                return { output: data };
            }

            case 'updateApplication': {
                const res = await fetch(`${baseUrl}/applications/${inputs.appId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update application: ${res.status}` };
                return { output: data };
            }

            case 'deleteApplication': {
                const res = await fetch(`${baseUrl}/applications/${inputs.appId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to delete application: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'listTables': {
                const res = await fetch(`${baseUrl}/tables/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ appId: inputs.appId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list tables: ${res.status}` };
                return { output: data };
            }

            case 'getTable': {
                const res = await fetch(`${baseUrl}/tables/${inputs.tableId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get table: ${res.status}` };
                return { output: data };
            }

            case 'createTable': {
                const res = await fetch(`${baseUrl}/tables`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create table: ${res.status}` };
                return { output: data };
            }

            case 'listRows': {
                const res = await fetch(`${baseUrl}/tables/${inputs.tableId}/rows/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.query || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list rows: ${res.status}` };
                return { output: data };
            }

            case 'getRow': {
                const res = await fetch(`${baseUrl}/tables/${inputs.tableId}/rows/${inputs.rowId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get row: ${res.status}` };
                return { output: data };
            }

            case 'createRow': {
                const res = await fetch(`${baseUrl}/tables/${inputs.tableId}/rows`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create row: ${res.status}` };
                return { output: data };
            }

            case 'updateRow': {
                const res = await fetch(`${baseUrl}/tables/${inputs.tableId}/rows/${inputs.rowId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update row: ${res.status}` };
                return { output: data };
            }

            case 'deleteRow': {
                const res = await fetch(`${baseUrl}/tables/${inputs.tableId}/rows`, {
                    method: 'DELETE',
                    headers,
                    body: JSON.stringify({ _id: inputs.rowId }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to delete row: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'listUsers': {
                const res = await fetch(`${baseUrl}/users/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.query || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list users: ${res.status}` };
                return { output: data };
            }

            case 'createUser': {
                const res = await fetch(`${baseUrl}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create user: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Budibase action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Budibase action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Budibase action.' };
    }
}
