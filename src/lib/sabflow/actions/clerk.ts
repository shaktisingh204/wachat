'use server';

export async function executeClerkAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.clerk.com/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.secretKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.emailAddress) params.set('email_address', inputs.emailAddress);
                if (inputs.query) params.set('query', inputs.query);
                const res = await fetch(`${baseUrl}/users?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list users' };
                return { output: data };
            }
            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get user' };
                return { output: data };
            }
            case 'createUser': {
                const body: Record<string, any> = {};
                if (inputs.emailAddress) body.email_address = [inputs.emailAddress];
                if (inputs.phoneNumber) body.phone_number = [inputs.phoneNumber];
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.password) body.password = inputs.password;
                if (inputs.publicMetadata) body.public_metadata = inputs.publicMetadata;
                const res = await fetch(`${baseUrl}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create user' };
                return { output: data };
            }
            case 'updateUser': {
                const body: Record<string, any> = {};
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.publicMetadata) body.public_metadata = inputs.publicMetadata;
                if (inputs.privateMetadata) body.private_metadata = inputs.privateMetadata;
                if (inputs.externalId) body.external_id = inputs.externalId;
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update user' };
                return { output: data };
            }
            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to delete user' };
                return { output: data };
            }
            case 'banUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}/ban`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to ban user' };
                return { output: data };
            }
            case 'unbanUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}/unban`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to unban user' };
                return { output: data };
            }
            case 'listSessions': {
                const params = new URLSearchParams();
                if (inputs.userId) params.set('user_id', inputs.userId);
                if (inputs.clientId) params.set('client_id', inputs.clientId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/sessions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list sessions' };
                return { output: data };
            }
            case 'getSession': {
                const res = await fetch(`${baseUrl}/sessions/${inputs.sessionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get session' };
                return { output: data };
            }
            case 'revokeSession': {
                const res = await fetch(`${baseUrl}/sessions/${inputs.sessionId}/revoke`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to revoke session' };
                return { output: data };
            }
            case 'listOrganizations': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.query) params.set('query', inputs.query);
                const res = await fetch(`${baseUrl}/organizations?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list organizations' };
                return { output: data };
            }
            case 'getOrganization': {
                const res = await fetch(`${baseUrl}/organizations/${inputs.organizationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get organization' };
                return { output: data };
            }
            case 'createOrganization': {
                const body: Record<string, any> = { name: inputs.name };
                if (inputs.createdBy) body.created_by = inputs.createdBy;
                if (inputs.publicMetadata) body.public_metadata = inputs.publicMetadata;
                if (inputs.slug) body.slug = inputs.slug;
                const res = await fetch(`${baseUrl}/organizations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create organization' };
                return { output: data };
            }
            case 'updateOrganization': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.slug) body.slug = inputs.slug;
                if (inputs.publicMetadata) body.public_metadata = inputs.publicMetadata;
                const res = await fetch(`${baseUrl}/organizations/${inputs.organizationId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update organization' };
                return { output: data };
            }
            case 'listOrganizationMembers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/organizations/${inputs.organizationId}/memberships?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list organization members' };
                return { output: data };
            }
            default:
                return { error: `Unknown Clerk action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Clerk error: ${err.message}`);
        return { error: err.message || 'Clerk action failed' };
    }
}
