'use server';

export async function executeRetoolAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://api.retool.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
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

            case 'createApp': {
                const res = await fetch(`${baseUrl}/apps`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create app: ${res.status}` };
                return { output: data };
            }

            case 'updateApp': {
                const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update app: ${res.status}` };
                return { output: data };
            }

            case 'deleteApp': {
                const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to delete app: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'listFolders': {
                const res = await fetch(`${baseUrl}/folders`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list folders: ${res.status}` };
                return { output: data };
            }

            case 'getFolder': {
                const res = await fetch(`${baseUrl}/folders/${inputs.folderId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get folder: ${res.status}` };
                return { output: data };
            }

            case 'createFolder': {
                const res = await fetch(`${baseUrl}/folders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create folder: ${res.status}` };
                return { output: data };
            }

            case 'listUsers': {
                const res = await fetch(`${baseUrl}/users`, { headers });
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

            case 'inviteUser': {
                const res = await fetch(`${baseUrl}/users/invite`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to invite user: ${res.status}` };
                return { output: data };
            }

            case 'updateUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update user: ${res.status}` };
                return { output: data };
            }

            case 'deactivateUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}/deactivate`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to deactivate user: ${res.status}` };
                return { output: data };
            }

            case 'listGroups': {
                const res = await fetch(`${baseUrl}/groups`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list groups: ${res.status}` };
                return { output: data };
            }

            case 'createGroup': {
                const res = await fetch(`${baseUrl}/groups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create group: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Retool action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Retool action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Retool action.' };
    }
}
