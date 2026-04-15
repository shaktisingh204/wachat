'use server';

export async function executeAzureActiveDirectoryAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.filter) params.set('$filter', String(inputs.filter));
                if (inputs.select) params.set('$select', String(inputs.select));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`https://graph.microsoft.com/v1.0/users${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { users: data.value, count: data.value?.length ?? 0, nextLink: data['@odata.nextLink'] } };
            }
            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim() || 'me';
                const res = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { user: data } };
            }
            case 'createUser': {
                const body = {
                    accountEnabled: inputs.accountEnabled !== false,
                    displayName: String(inputs.displayName ?? ''),
                    mailNickname: String(inputs.mailNickname ?? ''),
                    userPrincipalName: String(inputs.userPrincipalName ?? ''),
                    passwordProfile: {
                        forceChangePasswordNextSignIn: inputs.forceChangePasswordNextSignIn !== false,
                        password: String(inputs.password ?? ''),
                    },
                    ...(inputs.givenName && { givenName: String(inputs.givenName) }),
                    ...(inputs.surname && { surname: String(inputs.surname) }),
                    ...(inputs.jobTitle && { jobTitle: String(inputs.jobTitle) }),
                    ...(inputs.department && { department: String(inputs.department) }),
                };
                const res = await fetch('https://graph.microsoft.com/v1.0/users', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { user: data } };
            }
            case 'updateUser': {
                const userId = String(inputs.userId ?? '').trim();
                const updateBody: Record<string, any> = {};
                const fields = ['displayName', 'givenName', 'surname', 'jobTitle', 'department', 'mobilePhone', 'officeLocation', 'accountEnabled'];
                for (const f of fields) {
                    if (inputs[f] !== undefined) updateBody[f] = inputs[f];
                }
                const res = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateBody),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, userId } };
            }
            case 'deleteUser': {
                const userId = String(inputs.userId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, userId } };
            }
            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.filter) params.set('$filter', String(inputs.filter));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`https://graph.microsoft.com/v1.0/groups${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { groups: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { group: data } };
            }
            case 'createGroup': {
                const body = {
                    displayName: String(inputs.displayName ?? ''),
                    description: String(inputs.description ?? ''),
                    mailEnabled: inputs.mailEnabled ?? false,
                    mailNickname: String(inputs.mailNickname ?? ''),
                    securityEnabled: inputs.securityEnabled !== false,
                    groupTypes: inputs.groupTypes ?? [],
                };
                const res = await fetch('https://graph.microsoft.com/v1.0/groups', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { group: data } };
            }
            case 'addGroupMember': {
                const groupId = String(inputs.groupId ?? '').trim();
                const memberId = String(inputs.memberId ?? '').trim();
                const body = {
                    '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${memberId}`,
                };
                const res = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/members/$ref`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, groupId, memberId } };
            }
            case 'removeGroupMember': {
                const groupId = String(inputs.groupId ?? '').trim();
                const memberId = String(inputs.memberId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/members/${memberId}/$ref`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, groupId, memberId } };
            }
            case 'listApplications': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.filter) params.set('$filter', String(inputs.filter));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`https://graph.microsoft.com/v1.0/applications${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { applications: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getApplication': {
                const appId = String(inputs.applicationId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/applications/${appId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { application: data } };
            }
            case 'listServicePrincipals': {
                const params = new URLSearchParams();
                if (inputs.top) params.set('$top', String(inputs.top));
                if (inputs.filter) params.set('$filter', String(inputs.filter));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`https://graph.microsoft.com/v1.0/servicePrincipals${qs}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { servicePrincipals: data.value, count: data.value?.length ?? 0 } };
            }
            case 'assignRole': {
                const userId = String(inputs.userId ?? '').trim();
                const roleDefinitionId = String(inputs.roleDefinitionId ?? '').trim();
                const resourceScope = String(inputs.resourceScope ?? '/').trim();
                const body = {
                    principalId: userId,
                    roleDefinitionId,
                    directoryScopeId: resourceScope,
                };
                const res = await fetch('https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { roleAssignment: data } };
            }
            case 'listRoles': {
                const res = await fetch('https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { roles: data.value, count: data.value?.length ?? 0 } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
