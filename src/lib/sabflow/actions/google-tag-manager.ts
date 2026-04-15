'use server';

export async function executeGoogleTagManagerAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, accountId, containerId, workspaceId } = inputs;
    const baseUrl = 'https://tagmanager.googleapis.com/tagmanager/v2';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listAccounts': {
                const res = await fetch(`${baseUrl}/accounts`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listAccounts failed' };
                return { output: data };
            }

            case 'getAccount': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getAccount failed' };
                return { output: data };
            }

            case 'listContainers': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listContainers failed' };
                return { output: data };
            }

            case 'getContainer': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getContainer failed' };
                return { output: data };
            }

            case 'createContainer': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createContainer failed' };
                return { output: data };
            }

            case 'updateContainer': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'updateContainer failed' };
                return { output: data };
            }

            case 'listWorkspaces': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listWorkspaces failed' };
                return { output: data };
            }

            case 'createWorkspace': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createWorkspace failed' };
                return { output: data };
            }

            case 'createTag': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createTag failed' };
                return { output: data };
            }

            case 'updateTag': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${inputs.tagId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'updateTag failed' };
                return { output: data };
            }

            case 'deleteTag': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${inputs.tagId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'deleteTag failed' };
                }
                return { output: { success: true } };
            }

            case 'listTags': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listTags failed' };
                return { output: data };
            }

            case 'createTrigger': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createTrigger failed' };
                return { output: data };
            }

            case 'updateTrigger': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${inputs.triggerId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'updateTrigger failed' };
                return { output: data };
            }

            case 'publishVersion': {
                const res = await fetch(`${baseUrl}/accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}:submit`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'publishVersion failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`google-tag-manager error: ${err.message}`);
        return { error: err.message || 'Unexpected error in google-tag-manager action' };
    }
}
