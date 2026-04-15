'use server';

// ---------------------------------------------------------------------------
// Auth0 Management API v2 Enhanced – Users, roles, connections, organizations
// Docs: https://auth0.com/docs/api/management/v2
// ---------------------------------------------------------------------------

async function getAuth0Token(inputs: any, logger?: any): Promise<string> {
    if (inputs.managementToken) return inputs.managementToken;

    // Auto-fetch via client_credentials flow
    const tokenUrl = `https://${inputs.domain}/oauth/token`;
    logger?.log(`[Auth0Enhanced] Fetching management token from ${tokenUrl}`);
    const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: inputs.clientId,
            client_secret: inputs.clientSecret,
            audience: `https://${inputs.domain}/api/v2/`,
        }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error_description ?? data?.error ?? `Auth0 token error: ${res.status}`);
    }
    return data.access_token;
}

async function auth0Fetch(
    token: string,
    domain: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `https://${domain}/api/v2${path}`;
    logger?.log(`[Auth0Enhanced] ${method} ${url}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }
    if (!res.ok) {
        const msg =
            data?.message ??
            data?.error_description ??
            data?.error ??
            `Auth0 API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeAuth0EnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const token = await getAuth0Token(inputs, logger);
        const { domain } = inputs;

        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.fields) params.set('fields', inputs.fields);
                if (inputs.page !== undefined) params.set('page', String(inputs.page));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await auth0Fetch(token, domain, 'GET', `/users${query}`, undefined, logger);
                return { output: { users: data } };
            }

            case 'getUser': {
                const data = await auth0Fetch(token, domain, 'GET', `/users/${encodeURIComponent(inputs.userId)}`, undefined, logger);
                return { output: { user: data } };
            }

            case 'createUser': {
                const body: any = {
                    connection: inputs.connection,
                    email: inputs.email,
                    password: inputs.password,
                };
                if (inputs.name) body.name = inputs.name;
                const data = await auth0Fetch(token, domain, 'POST', `/users`, body, logger);
                return { output: { user: data } };
            }

            case 'updateUser': {
                const data = await auth0Fetch(token, domain, 'PATCH', `/users/${encodeURIComponent(inputs.userId)}`, inputs.updates ?? {}, logger);
                return { output: { user: data } };
            }

            case 'deleteUser': {
                const data = await auth0Fetch(token, domain, 'DELETE', `/users/${encodeURIComponent(inputs.userId)}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'getUserRoles': {
                const data = await auth0Fetch(token, domain, 'GET', `/users/${encodeURIComponent(inputs.userId)}/roles`, undefined, logger);
                return { output: { roles: data } };
            }

            case 'assignRolesToUser': {
                const body = { roles: Array.isArray(inputs.roleIds) ? inputs.roleIds : [inputs.roleId] };
                const data = await auth0Fetch(token, domain, 'POST', `/users/${encodeURIComponent(inputs.userId)}/roles`, body, logger);
                return { output: { result: data } };
            }

            case 'removeRolesFromUser': {
                const body = { roles: Array.isArray(inputs.roleIds) ? inputs.roleIds : [inputs.roleId] };
                const data = await auth0Fetch(token, domain, 'DELETE', `/users/${encodeURIComponent(inputs.userId)}/roles`, body, logger);
                return { output: { result: data } };
            }

            case 'listRoles': {
                const data = await auth0Fetch(token, domain, 'GET', `/roles`, undefined, logger);
                return { output: { roles: data } };
            }

            case 'getRole': {
                const data = await auth0Fetch(token, domain, 'GET', `/roles/${inputs.id}`, undefined, logger);
                return { output: { role: data } };
            }

            case 'createRole': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                const data = await auth0Fetch(token, domain, 'POST', `/roles`, body, logger);
                return { output: { role: data } };
            }

            case 'listConnections': {
                const data = await auth0Fetch(token, domain, 'GET', `/connections`, undefined, logger);
                return { output: { connections: data } };
            }

            case 'getConnection': {
                const data = await auth0Fetch(token, domain, 'GET', `/connections/${inputs.id}`, undefined, logger);
                return { output: { connection: data } };
            }

            case 'listOrganizations': {
                const data = await auth0Fetch(token, domain, 'GET', `/organizations`, undefined, logger);
                return { output: { organizations: data } };
            }

            case 'getOrganization': {
                const data = await auth0Fetch(token, domain, 'GET', `/organizations/${inputs.id}`, undefined, logger);
                return { output: { organization: data } };
            }

            case 'createOrganization': {
                const body: any = { name: inputs.name };
                if (inputs.display_name) body.display_name = inputs.display_name;
                const data = await auth0Fetch(token, domain, 'POST', `/organizations`, body, logger);
                return { output: { organization: data } };
            }

            case 'blockUser': {
                const data = await auth0Fetch(token, domain, 'PATCH', `/users/${encodeURIComponent(inputs.userId)}`, { blocked: true }, logger);
                return { output: { user: data } };
            }

            case 'sendVerificationEmail': {
                const body = { user_id: inputs.userId };
                const data = await auth0Fetch(token, domain, 'POST', `/jobs/verification-email`, body, logger);
                return { output: { job: data } };
            }

            default:
                return { error: `Unknown Auth0Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Auth0Enhanced] Error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in Auth0Enhanced action' };
    }
}
