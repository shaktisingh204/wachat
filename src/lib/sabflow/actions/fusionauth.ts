'use server';

export async function executeFusionAuthAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = inputs.baseUrl.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Authorization': inputs.apiKey,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.numberOfResults) params.set('numberOfResults', String(inputs.numberOfResults));
        if (inputs.startRow !== undefined) params.set('startRow', String(inputs.startRow));
        const res = await fetch(`${baseUrl}/api/user/search?${params}`, {
          method: 'GET',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getUser': {
        const queryParam = inputs.email
          ? `email=${encodeURIComponent(inputs.email)}`
          : inputs.username
          ? `username=${encodeURIComponent(inputs.username)}`
          : `userId=${inputs.userId}`;
        const res = await fetch(`${baseUrl}/api/user?${queryParam}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createUser': {
        const res = await fetch(`${baseUrl}/api/user${inputs.userId ? `/${inputs.userId}` : ''}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user: inputs.userData, registration: inputs.registration }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'updateUser': {
        const res = await fetch(`${baseUrl}/api/user/${inputs.userId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ user: inputs.userData }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'deleteUser': {
        const params = new URLSearchParams();
        if (inputs.hardDelete) params.set('hardDelete', 'true');
        const res = await fetch(`${baseUrl}/api/user/${inputs.userId}?${params}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, userId: inputs.userId } };
      }
      case 'loginUser': {
        const res = await fetch(`${baseUrl}/api/login`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            loginId: inputs.loginId,
            password: inputs.password,
            applicationId: inputs.applicationId,
          }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'logoutUser': {
        const params = new URLSearchParams();
        if (inputs.global !== undefined) params.set('global', String(inputs.global));
        if (inputs.refreshToken) params.set('refreshToken', inputs.refreshToken);
        const res = await fetch(`${baseUrl}/api/logout?${params}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true } };
      }
      case 'listApplications': {
        const res = await fetch(`${baseUrl}/api/application`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getApplication': {
        const res = await fetch(`${baseUrl}/api/application/${inputs.applicationId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createApplication': {
        const res = await fetch(`${baseUrl}/api/application${inputs.applicationId ? `/${inputs.applicationId}` : ''}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ application: inputs.applicationData }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listGroups': {
        const res = await fetch(`${baseUrl}/api/group`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getGroup': {
        const res = await fetch(`${baseUrl}/api/group/${inputs.groupId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createGroup': {
        const res = await fetch(`${baseUrl}/api/group${inputs.groupId ? `/${inputs.groupId}` : ''}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ group: inputs.groupData, roleIds: inputs.roleIds }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'addUserToGroup': {
        const res = await fetch(`${baseUrl}/api/group/member`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            members: {
              [inputs.groupId]: [{ userId: inputs.userId }],
            },
          }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'removeUserFromGroup': {
        const res = await fetch(`${baseUrl}/api/group/member?groupId=${inputs.groupId}&userId=${inputs.userId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true } };
      }
      default:
        return { error: `Unknown FusionAuth action: ${actionName}` };
    }
  } catch (e: any) {
    logger.log(`FusionAuth action error: ${e.message}`);
    return { error: e.message };
  }
}
