'use server';

export async function executeAppsmithAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = inputs.appsmithUrl
            ? `${inputs.appsmithUrl}/api/v1`
            : 'https://app.appsmith.com/api/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listApplications': {
                const res = await fetch(`${baseUrl}/applications`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to list applications: ${res.status}` };
                return { output: data };
            }

            case 'getApplication': {
                const res = await fetch(`${baseUrl}/applications/${inputs.applicationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to get application: ${res.status}` };
                return { output: data };
            }

            case 'createApplication': {
                const res = await fetch(`${baseUrl}/applications`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to create application: ${res.status}` };
                return { output: data };
            }

            case 'updateApplication': {
                const res = await fetch(`${baseUrl}/applications/${inputs.applicationId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to update application: ${res.status}` };
                return { output: data };
            }

            case 'deleteApplication': {
                const res = await fetch(`${baseUrl}/applications/${inputs.applicationId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.responseMeta?.error?.message || `Failed to delete application: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'listPages': {
                const res = await fetch(`${baseUrl}/pages?applicationId=${inputs.applicationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to list pages: ${res.status}` };
                return { output: data };
            }

            case 'getPage': {
                const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to get page: ${res.status}` };
                return { output: data };
            }

            case 'createPage': {
                const res = await fetch(`${baseUrl}/pages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to create page: ${res.status}` };
                return { output: data };
            }

            case 'updatePage': {
                const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to update page: ${res.status}` };
                return { output: data };
            }

            case 'listDatasources': {
                const res = await fetch(`${baseUrl}/datasources?workspaceId=${inputs.workspaceId || ''}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to list datasources: ${res.status}` };
                return { output: data };
            }

            case 'getDatasource': {
                const res = await fetch(`${baseUrl}/datasources/${inputs.datasourceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to get datasource: ${res.status}` };
                return { output: data };
            }

            case 'createDatasource': {
                const res = await fetch(`${baseUrl}/datasources`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to create datasource: ${res.status}` };
                return { output: data };
            }

            case 'testDatasource': {
                const res = await fetch(`${baseUrl}/datasources/${inputs.datasourceId}/test`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to test datasource: ${res.status}` };
                return { output: data };
            }

            case 'listWorkspaces': {
                const res = await fetch(`${baseUrl}/workspaces`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to list workspaces: ${res.status}` };
                return { output: data };
            }

            case 'getWorkspace': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspaceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.responseMeta?.error?.message || `Failed to get workspace: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Appsmith action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Appsmith action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Appsmith action.' };
    }
}
