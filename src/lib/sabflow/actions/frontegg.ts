'use server';

export async function executeFronteggAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = `${inputs.baseUrl}/identity/resources`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('_limit', String(inputs.limit));
                if (inputs.offset) params.set('_offset', String(inputs.offset));
                if (inputs.sortBy) params.set('_sortBy', inputs.sortBy);
                if (inputs.filter) params.set('_filter', inputs.filter);
                const res = await fetch(`${baseUrl}/users/v1?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list users' };
                return { output: data };
            }
            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/v1/${inputs.userId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get user' };
                return { output: data };
            }
            case 'createUser': {
                const body: Record<string, any> = { email: inputs.email };
                if (inputs.name) body.name = inputs.name;
                if (inputs.roleIds) body.roleIds = inputs.roleIds;
                if (inputs.metadata) body.metadata = inputs.metadata;
                if (inputs.skipInviteEmail !== undefined) body.skipInviteEmail = inputs.skipInviteEmail;
                const res = await fetch(`${baseUrl}/users/v1`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create user' };
                return { output: data };
            }
            case 'updateUser': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.metadata) body.metadata = inputs.metadata;
                if (inputs.profilePictureUrl) body.profilePictureUrl = inputs.profilePictureUrl;
                const res = await fetch(`${baseUrl}/users/v1/${inputs.userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update user' };
                return { output: data };
            }
            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/users/v1/${inputs.userId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 200 || res.status === 204) return { output: { deleted: true, userId: inputs.userId } };
                const data = await res.json();
                return { error: data.message || 'Failed to delete user' };
            }
            case 'listRoles': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('_limit', String(inputs.limit));
                if (inputs.offset) params.set('_offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/roles/v1?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list roles' };
                return { output: data };
            }
            case 'getRole': {
                const res = await fetch(`${baseUrl}/roles/v1/${inputs.roleId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get role' };
                return { output: data };
            }
            case 'createRole': {
                const body: Record<string, any> = { key: inputs.key, name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.level !== undefined) body.level = inputs.level;
                const res = await fetch(`${baseUrl}/roles/v1`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create role' };
                return { output: data };
            }
            case 'listTenants': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('_limit', String(inputs.limit));
                if (inputs.offset) params.set('_offset', String(inputs.offset));
                if (inputs.sortBy) params.set('_sortBy', inputs.sortBy);
                const res = await fetch(`${baseUrl}/tenants/v1?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list tenants' };
                return { output: data };
            }
            case 'getTenant': {
                const res = await fetch(`${baseUrl}/tenants/v1/${inputs.tenantId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get tenant' };
                return { output: data };
            }
            case 'createTenant': {
                const body: Record<string, any> = { tenantId: inputs.tenantId };
                if (inputs.name) body.name = inputs.name;
                if (inputs.metadata) body.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/tenants/v1`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create tenant' };
                return { output: data };
            }
            case 'updateTenant': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.metadata) body.metadata = inputs.metadata;
                if (inputs.website) body.website = inputs.website;
                const res = await fetch(`${baseUrl}/tenants/v1/${inputs.tenantId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update tenant' };
                return { output: data };
            }
            case 'listPermissions': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('_limit', String(inputs.limit));
                if (inputs.offset) params.set('_offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/permissions/v1?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list permissions' };
                return { output: data };
            }
            case 'createPermission': {
                const body: Record<string, any> = { key: inputs.key, name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.categoryId) body.categoryId = inputs.categoryId;
                const res = await fetch(`${baseUrl}/permissions/v1`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create permission' };
                return { output: data };
            }
            case 'assignRoleToUser': {
                const body = { roleIds: Array.isArray(inputs.roleIds) ? inputs.roleIds : [inputs.roleId] };
                const res = await fetch(`${baseUrl}/users/v1/${inputs.userId}/roles`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to assign role to user' };
                return { output: data };
            }
            default:
                return { error: `Unknown Frontegg action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Frontegg error: ${err.message}`);
        return { error: err.message || 'Frontegg action failed' };
    }
}
