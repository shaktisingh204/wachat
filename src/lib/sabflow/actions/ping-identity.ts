'use server';

export async function executePingIdentityAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = `${inputs.environmentUrl}/v1`;

    let token: string;
    if (inputs.accessToken) {
      token = inputs.accessToken;
    } else {
      const tokenRes = await fetch(`${inputs.tokenUrl || `${inputs.environmentUrl}/as/token`}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return { error: `PingIdentity token error: ${err}` };
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
        if (inputs.filter) params.set('filter', inputs.filter);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/users?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getUser': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/users/${inputs.userId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createUser': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.userData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'updateUser': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/users/${inputs.userId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(inputs.userData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'deleteUser': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/users/${inputs.userId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, userId: inputs.userId } };
      }
      case 'listGroups': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/groups`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getGroup': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/groups/${inputs.groupId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'createGroup': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/groups`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.groupData),
        });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listApplications': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/applications`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getApplication': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/applications/${inputs.applicationId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listPopulations': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/populations`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getPopulation': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/populations/${inputs.populationId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listPasswordPolicies': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/passwordPolicies`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'listIdentityProviders': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/identityProviders`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      case 'getSignOnPolicy': {
        const res = await fetch(`${baseUrl}/environments/${inputs.environmentId}/signOnPolicies/${inputs.policyId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        return { output: await res.json() };
      }
      default:
        return { error: `Unknown PingIdentity action: ${actionName}` };
    }
  } catch (e: any) {
    logger.log(`PingIdentity action error: ${e.message}`);
    return { error: e.message };
  }
}
