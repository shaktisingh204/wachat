'use server';

export async function executeJumpCloudAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://console.jumpcloud.com/api';

    const headers: Record<string, string> = {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.skip) params.set('skip', inputs.skip);
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${baseUrl}/systemusers?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getUser': {
                const userId = inputs.userId;
                const res = await fetch(`${baseUrl}/systemusers/${userId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'createUser': {
                const res = await fetch(`${baseUrl}/systemusers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.user || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'updateUser': {
                const userId = inputs.userId;
                const res = await fetch(`${baseUrl}/systemusers/${userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.updates || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'deleteUser': {
                const userId = inputs.userId;
                const res = await fetch(`${baseUrl}/systemusers/${userId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { deleted: true, userId } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.skip) params.set('skip', inputs.skip);
                const groupType = inputs.groupType || 'user';
                const res = await fetch(`${baseUrl}/v2/${groupType}_groups?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getGroup': {
                const groupId = inputs.groupId;
                const groupType = inputs.groupType || 'user';
                const res = await fetch(`${baseUrl}/v2/${groupType}_groups/${groupId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'createGroup': {
                const groupType = inputs.groupType || 'user';
                const res = await fetch(`${baseUrl}/v2/${groupType}_groups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.group || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'updateGroup': {
                const groupId = inputs.groupId;
                const groupType = inputs.groupType || 'user';
                const res = await fetch(`${baseUrl}/v2/${groupType}_groups/${groupId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.updates || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'deleteGroup': {
                const groupId = inputs.groupId;
                const groupType = inputs.groupType || 'user';
                const res = await fetch(`${baseUrl}/v2/${groupType}_groups/${groupId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { deleted: true, groupId } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listSystemUsers': {
                const systemId = inputs.systemId;
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.skip) params.set('skip', inputs.skip);
                const res = await fetch(`${baseUrl}/v2/systems/${systemId}/users?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'addUserToGroup': {
                const groupId = inputs.groupId;
                const userId = inputs.userId;
                const res = await fetch(`${baseUrl}/v2/usergroups/${groupId}/members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ op: 'add', type: 'user', id: userId }),
                });
                if (res.status === 204) return { output: { added: true, groupId, userId } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'removeUserFromGroup': {
                const groupId = inputs.groupId;
                const userId = inputs.userId;
                const res = await fetch(`${baseUrl}/v2/usergroups/${groupId}/members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ op: 'remove', type: 'user', id: userId }),
                });
                if (res.status === 204) return { output: { removed: true, groupId, userId } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'listSystems': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.skip) params.set('skip', inputs.skip);
                const res = await fetch(`${baseUrl}/systems?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            case 'getSystem': {
                const systemId = inputs.systemId;
                const res = await fetch(`${baseUrl}/systems/${systemId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }
            default:
                return { error: `Unknown JumpCloud action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`JumpCloud action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in JumpCloud action' };
    }
}
