'use server';

// ---------------------------------------------------------------------------
// Keycloak IAM REST API – Users, groups, roles, clients
// Docs: https://www.keycloak.org/docs-api/latest/rest-api/
// ---------------------------------------------------------------------------

async function getKeycloakToken(inputs: any, logger?: any): Promise<string> {
    if (inputs.adminToken) return inputs.adminToken;

    const tokenUrl = `${inputs.serverUrl}/realms/${inputs.realm}/protocol/openid-connect/token`;
    logger?.log(`[Keycloak] Fetching admin token from ${tokenUrl}`);

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: inputs.clientId,
        client_secret: inputs.clientSecret,
    });

    const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error_description ?? data?.error ?? `Keycloak token error: ${res.status}`);
    }
    return data.access_token;
}

async function keycloakFetch(
    token: string,
    serverUrl: string,
    realm: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = `${serverUrl}/admin/realms/${realm}`;
    const url = `${base}${path}`;
    logger?.log(`[Keycloak] ${method} ${url}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204 || res.status === 201) {
        const loc = res.headers.get('Location');
        return loc ? { id: loc.split('/').pop() } : {};
    }

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }
    if (!res.ok) {
        const msg =
            data?.errorMessage ??
            data?.error_description ??
            data?.error ??
            `Keycloak API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeKeycloakAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const token = await getKeycloakToken(inputs, logger);
        const { serverUrl, realm } = inputs;

        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.search) params.set('search', inputs.search);
                if (inputs.max) params.set('max', String(inputs.max));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/users${query}`, undefined, logger);
                return { output: { users: data } };
            }

            case 'getUser': {
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/users/${inputs.id}`, undefined, logger);
                return { output: { user: data } };
            }

            case 'createUser': {
                const body: any = {
                    username: inputs.username,
                    email: inputs.email,
                    enabled: inputs.enabled ?? true,
                };
                if (inputs.password) {
                    body.credentials = [{ type: 'password', value: inputs.password, temporary: false }];
                }
                const data = await keycloakFetch(token, serverUrl, realm, 'POST', `/users`, body, logger);
                return { output: { result: data } };
            }

            case 'updateUser': {
                const data = await keycloakFetch(token, serverUrl, realm, 'PUT', `/users/${inputs.id}`, inputs.updates ?? {}, logger);
                return { output: { result: data } };
            }

            case 'deleteUser': {
                const data = await keycloakFetch(token, serverUrl, realm, 'DELETE', `/users/${inputs.id}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'resetPassword': {
                const body = { type: 'password', value: inputs.password, temporary: false };
                const data = await keycloakFetch(token, serverUrl, realm, 'PUT', `/users/${inputs.id}/reset-password`, body, logger);
                return { output: { result: data } };
            }

            case 'listGroups': {
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/groups`, undefined, logger);
                return { output: { groups: data } };
            }

            case 'getGroup': {
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/groups/${inputs.id}`, undefined, logger);
                return { output: { group: data } };
            }

            case 'createGroup': {
                const body = { name: inputs.name };
                const data = await keycloakFetch(token, serverUrl, realm, 'POST', `/groups`, body, logger);
                return { output: { result: data } };
            }

            case 'addUserToGroup': {
                const data = await keycloakFetch(token, serverUrl, realm, 'PUT', `/users/${inputs.id}/groups/${inputs.groupId}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'removeUserFromGroup': {
                const data = await keycloakFetch(token, serverUrl, realm, 'DELETE', `/users/${inputs.id}/groups/${inputs.groupId}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'listRoles': {
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/roles`, undefined, logger);
                return { output: { roles: data } };
            }

            case 'createRole': {
                const body = { name: inputs.name };
                const data = await keycloakFetch(token, serverUrl, realm, 'POST', `/roles`, body, logger);
                return { output: { result: data } };
            }

            case 'assignRole': {
                const body = Array.isArray(inputs.roles)
                    ? inputs.roles
                    : [{ id: inputs.roleId, name: inputs.roleName }];
                const data = await keycloakFetch(token, serverUrl, realm, 'POST', `/users/${inputs.id}/role-mappings/realm`, body, logger);
                return { output: { result: data } };
            }

            case 'listClients': {
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/clients`, undefined, logger);
                return { output: { clients: data } };
            }

            case 'getClient': {
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/clients/${inputs.id}`, undefined, logger);
                return { output: { client: data } };
            }

            case 'getClientSecret': {
                const data = await keycloakFetch(token, serverUrl, realm, 'GET', `/clients/${inputs.id}/client-secret`, undefined, logger);
                return { output: { secret: data } };
            }

            default:
                return { error: `Unknown Keycloak action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Keycloak] Error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in Keycloak action' };
    }
}
