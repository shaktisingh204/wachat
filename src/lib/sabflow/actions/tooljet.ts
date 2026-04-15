'use server';

export async function executeTooljetAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = inputs.tooljetUrl
            ? `${inputs.tooljetUrl}/api`
            : 'https://app.tooljet.com/api';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listApps': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.folder) params.set('folder', inputs.folder);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/apps${qs}`, { headers });
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

            case 'listDataSources': {
                const res = await fetch(`${baseUrl}/data_sources`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list data sources: ${res.status}` };
                return { output: data };
            }

            case 'getDataSource': {
                const res = await fetch(`${baseUrl}/data_sources/${inputs.dataSourceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get data source: ${res.status}` };
                return { output: data };
            }

            case 'createDataSource': {
                const res = await fetch(`${baseUrl}/data_sources`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create data source: ${res.status}` };
                return { output: data };
            }

            case 'listFolders': {
                const res = await fetch(`${baseUrl}/folders`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list folders: ${res.status}` };
                return { output: data };
            }

            case 'createFolder': {
                const res = await fetch(`${baseUrl}/folders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name }),
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

            case 'listOrganizations': {
                const res = await fetch(`${baseUrl}/organizations`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list organizations: ${res.status}` };
                return { output: data };
            }

            case 'getOrganization': {
                const res = await fetch(`${baseUrl}/organizations/${inputs.organizationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get organization: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `ToolJet action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`ToolJet action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in ToolJet action.' };
    }
}
