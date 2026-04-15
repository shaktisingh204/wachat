'use server';

export async function executeAuth0ManagementAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = `https://${inputs.domain}/api/v2`;

    let token: string;
    if (inputs.managementToken) {
      token = inputs.managementToken;
    } else {
      const tokenRes = await fetch(`https://${inputs.domain}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: inputs.clientId,
          client_secret: inputs.clientSecret,
          audience: `https://${inputs.domain}/api/v2/`,
          grant_type: 'client_credentials',
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return { error: `Auth0 token error: ${err}` };
      }
      const tokenData = await tokenRes.json();
      token = tokenData.access_token;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.page !== undefined) params.set('page', String(inputs.page));
        if (inputs.perPage) params.set('per_page', String(inputs.perPage));
        if (inputs.q) params.set('q', inputs.q);
        const res = await fetch(`${baseUrl}/users?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getUser': {
        const res = await fetch(`${baseUrl}/users/${encodeURIComponent(inputs.userId)}`, { headers });
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
        const res = await fetch(`${baseUrl}/users/${encodeURIComponent(inputs.userId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(inputs.userData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'deleteUser': {
        const res = await fetch(`${baseUrl}/users/${encodeURIComponent(inputs.userId)}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, userId: inputs.userId } };
      }
      case 'listConnections': {
        const params = new URLSearchParams();
        if (inputs.strategy) params.set('strategy', inputs.strategy);
        const res = await fetch(`${baseUrl}/connections?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getConnection': {
        const res = await fetch(`${baseUrl}/connections/${inputs.connectionId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createConnection': {
        const res = await fetch(`${baseUrl}/connections`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.connectionData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listClients': {
        const params = new URLSearchParams();
        if (inputs.page !== undefined) params.set('page', String(inputs.page));
        if (inputs.perPage) params.set('per_page', String(inputs.perPage));
        const res = await fetch(`${baseUrl}/clients?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getClient': {
        const res = await fetch(`${baseUrl}/clients/${inputs.clientId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createClient': {
        const res = await fetch(`${baseUrl}/clients`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.clientData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listRoles': {
        const params = new URLSearchParams();
        if (inputs.page !== undefined) params.set('page', String(inputs.page));
        if (inputs.perPage) params.set('per_page', String(inputs.perPage));
        const res = await fetch(`${baseUrl}/roles?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getRole': {
        const res = await fetch(`${baseUrl}/roles/${inputs.roleId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'assignRoleToUser': {
        const res = await fetch(`${baseUrl}/users/${encodeURIComponent(inputs.userId)}/roles`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ roles: inputs.roles }),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true } };
      }
      case 'listLogs': {
        const params = new URLSearchParams();
        if (inputs.page !== undefined) params.set('page', String(inputs.page));
        if (inputs.perPage) params.set('per_page', String(inputs.perPage));
        if (inputs.from) params.set('from', inputs.from);
        if (inputs.q) params.set('q', inputs.q);
        const res = await fetch(`${baseUrl}/logs?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      default:
        return { error: `Unknown Auth0 Management action: ${actionName}` };
    }
  } catch (e: any) {
    logger.log(`Auth0 Management action error: ${e.message}`);
    return { error: e.message };
  }
}
