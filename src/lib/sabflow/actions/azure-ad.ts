'use server';

export async function executeAzureADAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = 'https://graph.microsoft.com/v1.0';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${inputs.accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.top) params.set('$top', String(inputs.top));
        if (inputs.filter) params.set('$filter', inputs.filter);
        if (inputs.select) params.set('$select', inputs.select);
        const res = await fetch(`${baseUrl}/users?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createUser': {
        const res = await fetch(`${baseUrl}/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.userData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'updateUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(inputs.userData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, userId: inputs.userId } };
      }
      case 'deleteUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, userId: inputs.userId } };
      }
      case 'listGroups': {
        const params = new URLSearchParams();
        if (inputs.top) params.set('$top', String(inputs.top));
        if (inputs.filter) params.set('$filter', inputs.filter);
        const res = await fetch(`${baseUrl}/groups?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getGroup': {
        const res = await fetch(`${baseUrl}/groups/${inputs.groupId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createGroup': {
        const res = await fetch(`${baseUrl}/groups`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.groupData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'addMemberToGroup': {
        const res = await fetch(`${baseUrl}/groups/${inputs.groupId}/members/$ref`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${inputs.memberId}`,
          }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true } };
      }
      case 'removeMemberFromGroup': {
        const res = await fetch(`${baseUrl}/groups/${inputs.groupId}/members/${inputs.memberId}/$ref`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true } };
      }
      case 'listApplications': {
        const params = new URLSearchParams();
        if (inputs.top) params.set('$top', String(inputs.top));
        if (inputs.filter) params.set('$filter', inputs.filter);
        const res = await fetch(`${baseUrl}/applications?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getApplication': {
        const res = await fetch(`${baseUrl}/applications/${inputs.applicationId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listServicePrincipals': {
        const params = new URLSearchParams();
        if (inputs.top) params.set('$top', String(inputs.top));
        if (inputs.filter) params.set('$filter', inputs.filter);
        const res = await fetch(`${baseUrl}/servicePrincipals?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'assignRole': {
        const res = await fetch(`${baseUrl}/roleManagement/directory/roleAssignments`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            roleDefinitionId: inputs.roleDefinitionId,
            principalId: inputs.principalId,
            directoryScopeId: inputs.directoryScopeId || '/',
          }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listRoleAssignments': {
        const params = new URLSearchParams();
        if (inputs.filter) params.set('$filter', inputs.filter);
        const res = await fetch(`${baseUrl}/roleManagement/directory/roleAssignments?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      default:
        return { error: `Unknown Azure AD action: ${actionName}` };
    }
  } catch (e: any) {
    logger.log(`Azure AD action error: ${e.message}`);
    return { error: e.message };
  }
}
