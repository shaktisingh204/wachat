'use server';

export async function executeGoogleWorkspaceAdminAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://admin.googleapis.com/admin/directory/v1';
        const authHeader = `Bearer ${inputs.accessToken}`;

        const adminFetch = async (path: string, method = 'GET', body?: any) => {
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || `Google Workspace Admin API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                params.set('customer', inputs.customer || 'my_customer');
                if (inputs.maxResults) params.set('maxResults', inputs.maxResults);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.orderBy) params.set('orderBy', inputs.orderBy);
                if (inputs.domain) params.set('domain', inputs.domain);
                const data = await adminFetch(`/users?${params.toString()}`);
                return { output: { users: data.users || [], nextPageToken: data.nextPageToken } };
            }
            case 'getUser': {
                const data = await adminFetch(`/users/${encodeURIComponent(inputs.userKey)}`);
                return { output: { user: data } };
            }
            case 'createUser': {
                const data = await adminFetch('/users', 'POST', {
                    primaryEmail: inputs.primaryEmail,
                    name: {
                        givenName: inputs.firstName,
                        familyName: inputs.lastName,
                    },
                    password: inputs.password,
                    changePasswordAtNextLogin: inputs.changePasswordAtNextLogin || false,
                    orgUnitPath: inputs.orgUnitPath || '/',
                    recoveryEmail: inputs.recoveryEmail,
                    recoveryPhone: inputs.recoveryPhone,
                });
                return { output: { user: data } };
            }
            case 'updateUser': {
                const data = await adminFetch(`/users/${encodeURIComponent(inputs.userKey)}`, 'PUT', {
                    name: inputs.firstName || inputs.lastName ? {
                        givenName: inputs.firstName,
                        familyName: inputs.lastName,
                    } : undefined,
                    primaryEmail: inputs.primaryEmail,
                    password: inputs.password,
                    suspended: inputs.suspended,
                    orgUnitPath: inputs.orgUnitPath,
                    recoveryEmail: inputs.recoveryEmail,
                    recoveryPhone: inputs.recoveryPhone,
                });
                return { output: { user: data } };
            }
            case 'deleteUser': {
                await adminFetch(`/users/${encodeURIComponent(inputs.userKey)}`, 'DELETE');
                return { output: { success: true } };
            }
            case 'listGroups': {
                const params = new URLSearchParams();
                params.set('customer', inputs.customer || 'my_customer');
                if (inputs.maxResults) params.set('maxResults', inputs.maxResults);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.domain) params.set('domain', inputs.domain);
                if (inputs.userKey) params.set('userKey', inputs.userKey);
                const data = await adminFetch(`/groups?${params.toString()}`);
                return { output: { groups: data.groups || [], nextPageToken: data.nextPageToken } };
            }
            case 'createGroup': {
                const data = await adminFetch('/groups', 'POST', {
                    email: inputs.email,
                    name: inputs.name,
                    description: inputs.description,
                });
                return { output: { group: data } };
            }
            case 'addGroupMember': {
                const data = await adminFetch(`/groups/${encodeURIComponent(inputs.groupKey)}/members`, 'POST', {
                    email: inputs.memberEmail,
                    role: inputs.role || 'MEMBER',
                    type: inputs.type || 'USER',
                });
                return { output: { member: data } };
            }
            case 'removeGroupMember': {
                await adminFetch(`/groups/${encodeURIComponent(inputs.groupKey)}/members/${encodeURIComponent(inputs.memberKey)}`, 'DELETE');
                return { output: { success: true } };
            }
            case 'listGroupMembers': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', inputs.maxResults);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.roles) params.set('roles', inputs.roles);
                const data = await adminFetch(`/groups/${encodeURIComponent(inputs.groupKey)}/members?${params.toString()}`);
                return { output: { members: data.members || [], nextPageToken: data.nextPageToken } };
            }
            case 'listOrgUnits': {
                const params = new URLSearchParams();
                params.set('customerId', inputs.customerId || 'my_customer');
                if (inputs.orgUnitPath) params.set('orgUnitPath', inputs.orgUnitPath);
                if (inputs.type) params.set('type', inputs.type);
                const data = await adminFetch(`/customer/${inputs.customerId || 'my_customer'}/orgunits?${params.toString()}`);
                return { output: { organizationUnits: data.organizationUnits || [] } };
            }
            case 'createOrgUnit': {
                const data = await adminFetch(`/customer/${inputs.customerId || 'my_customer'}/orgunits`, 'POST', {
                    name: inputs.name,
                    description: inputs.description,
                    parentOrgUnitPath: inputs.parentOrgUnitPath || '/',
                });
                return { output: { orgUnit: data } };
            }
            case 'updateOrgUnit': {
                const data = await adminFetch(
                    `/customer/${inputs.customerId || 'my_customer'}/orgunits/${encodeURIComponent((inputs.orgUnitPath || '').replace(/^\//, ''))}`,
                    'PUT',
                    {
                        name: inputs.name,
                        description: inputs.description,
                        parentOrgUnitPath: inputs.parentOrgUnitPath,
                    }
                );
                return { output: { orgUnit: data } };
            }
            case 'listDomains': {
                const data = await adminFetch(`/customer/${inputs.customerId || 'my_customer'}/domains`);
                return { output: { domains: data.domains || [] } };
            }
            case 'listRoles': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', inputs.maxResults);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await adminFetch(`/customer/${inputs.customerId || 'my_customer'}/roles?${params.toString()}`);
                return { output: { roles: data.items || [], nextPageToken: data.nextPageToken } };
            }
            default:
                logger.log(`Google Workspace Admin: unknown action "${actionName}"`);
                return { error: `Unknown Google Workspace Admin action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Google Workspace Admin action error: ${err.message}`);
        return { error: err.message || 'Google Workspace Admin action failed' };
    }
}
