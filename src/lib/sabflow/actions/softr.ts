'use server';

export async function executeSoftrAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://studio.softr.io/v1/api';
        const headers: Record<string, string> = {
            'Softr-Api-Key': inputs.apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listApps': {
                const res = await fetch(`${baseUrl}/apps`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list apps: ${res.status}` };
                return { output: data };
            }

            case 'getApp': {
                const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get app: ${res.status}` };
                return { output: data };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.page !== undefined) params.set('page', String(inputs.page));
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/users${qs}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list users: ${res.status}` };
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get user: ${res.status}` };
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

            case 'updateUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update user: ${res.status}` };
                return { output: data };
            }

            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to delete user: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'listRecords': {
                const params = new URLSearchParams();
                if (inputs.page !== undefined) params.set('page', String(inputs.page));
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/datasources/${inputs.datasourceId}/records${qs}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list records: ${res.status}` };
                return { output: data };
            }

            case 'getRecord': {
                const res = await fetch(`${baseUrl}/datasources/${inputs.datasourceId}/records/${inputs.recordId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get record: ${res.status}` };
                return { output: data };
            }

            case 'createRecord': {
                const res = await fetch(`${baseUrl}/datasources/${inputs.datasourceId}/records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create record: ${res.status}` };
                return { output: data };
            }

            case 'updateRecord': {
                const res = await fetch(`${baseUrl}/datasources/${inputs.datasourceId}/records/${inputs.recordId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update record: ${res.status}` };
                return { output: data };
            }

            case 'deleteRecord': {
                const res = await fetch(`${baseUrl}/datasources/${inputs.datasourceId}/records/${inputs.recordId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to delete record: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'addUserToGroup': {
                const res = await fetch(`${baseUrl}/user-groups/${inputs.groupId}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ userId: inputs.userId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to add user to group: ${res.status}` };
                return { output: data };
            }

            case 'removeUserFromGroup': {
                const res = await fetch(`${baseUrl}/user-groups/${inputs.groupId}/users/${inputs.userId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to remove user from group: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'listUserGroups': {
                const res = await fetch(`${baseUrl}/user-groups`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list user groups: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Softr action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Softr action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Softr action.' };
    }
}
