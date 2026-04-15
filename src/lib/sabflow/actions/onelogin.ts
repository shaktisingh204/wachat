'use server';

export async function executeOneLoginAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = 'https://api.us.onelogin.com/api/2';

    // Get OAuth2 token
    const tokenRes = await fetch('https://api.us.onelogin.com/auth/oauth2/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return { error: `OneLogin token error: ${err}` };
    }
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.page) params.set('page', String(inputs.page));
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
          method: 'PUT',
          headers,
          body: JSON.stringify(inputs.userData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'deleteUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, userId: inputs.userId } };
      }
      case 'listRoles': {
        const res = await fetch(`${baseUrl}/roles`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getRole': {
        const res = await fetch(`${baseUrl}/roles/${inputs.roleId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'assignRoleToUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}/add_roles`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ role_id_array: inputs.roleIds }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true } };
      }
      case 'removeRoleFromUser': {
        const res = await fetch(`${baseUrl}/users/${inputs.userId}/remove_roles`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ role_id_array: inputs.roleIds }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true } };
      }
      case 'listApps': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/apps?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getApp': {
        const res = await fetch(`${baseUrl}/apps/${inputs.appId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listGroups': {
        const res = await fetch(`${baseUrl}/groups`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getGroup': {
        const res = await fetch(`${baseUrl}/groups/${inputs.groupId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'generateSAMLAssertion': {
        const res = await fetch(`${baseUrl}/saml_assertion`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            username_or_email: inputs.usernameOrEmail,
            password: inputs.password,
            app_id: inputs.appId,
            subdomain: inputs.subdomain,
          }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listEvents': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.page) params.set('page', String(inputs.page));
        if (inputs.eventTypeId) params.set('event_type_id', String(inputs.eventTypeId));
        const res = await fetch(`${baseUrl}/events?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      default:
        return { error: `Unknown OneLogin action: ${actionName}` };
    }
  } catch (e: any) {
    logger.log(`OneLogin action error: ${e.message}`);
    return { error: e.message };
  }
}
