'use server';

// ---------------------------------------------------------------------------
// SuperTokens Auth API – Self-hosted user, session, and role management
// Docs: https://supertokens.com/docs/apis
// ---------------------------------------------------------------------------

async function superTokensFetch(
    connectionUri: string,
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${connectionUri}${path}`;
    logger?.log(`[SuperTokens] ${method} ${url}`);

    const options: RequestInit = {
        method,
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
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
            data?.error ??
            `SuperTokens API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeSuperTokensAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { connectionUri, apiKey } = inputs;

        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                if (inputs.timeJoinedOrder) params.set('timeJoinedOrder', inputs.timeJoinedOrder);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await superTokensFetch(connectionUri, apiKey, 'GET', `/recipe/dashboard/users${query}`, undefined, logger);
                return { output: { users: data } };
            }

            case 'getUser': {
                const data = await superTokensFetch(connectionUri, apiKey, 'GET', `/user?userId=${encodeURIComponent(inputs.userId)}`, undefined, logger);
                return { output: { user: data } };
            }

            case 'deleteUser': {
                const data = await superTokensFetch(connectionUri, apiKey, 'POST', `/user/remove`, { userId: inputs.userId }, logger);
                return { output: { result: data } };
            }

            case 'getUsersByEmail': {
                const data = await superTokensFetch(connectionUri, apiKey, 'GET', `/users/by-email?email=${encodeURIComponent(inputs.email)}`, undefined, logger);
                return { output: { users: data } };
            }

            case 'createEmailPasswordUser': {
                const body = { email: inputs.email, password: inputs.password };
                const data = await superTokensFetch(connectionUri, apiKey, 'POST', `/recipe/signup`, body, logger);
                return { output: { user: data } };
            }

            case 'changePassword': {
                const body = { userId: inputs.userId, newPassword: inputs.newPassword };
                const data = await superTokensFetch(connectionUri, apiKey, 'PUT', `/recipe/user/password`, body, logger);
                return { output: { result: data } };
            }

            case 'listSessions': {
                const fetchAll = inputs.fetchAcrossAllTenants !== undefined
                    ? inputs.fetchAcrossAllTenants
                    : true;
                const data = await superTokensFetch(
                    connectionUri,
                    apiKey,
                    'GET',
                    `/recipe/session/user?userId=${encodeURIComponent(inputs.userId)}&fetchAcrossAllTenants=${fetchAll}`,
                    undefined,
                    logger
                );
                return { output: { sessions: data } };
            }

            case 'revokeSession': {
                const sessionHandles = Array.isArray(inputs.sessionHandles)
                    ? inputs.sessionHandles
                    : [inputs.sessionHandle];
                const data = await superTokensFetch(connectionUri, apiKey, 'POST', `/recipe/session/remove`, { sessionHandles }, logger);
                return { output: { result: data } };
            }

            case 'revokeAllUserSessions': {
                const data = await superTokensFetch(connectionUri, apiKey, 'POST', `/recipe/session/remove`, { userId: inputs.userId }, logger);
                return { output: { result: data } };
            }

            case 'createRole': {
                const body: any = { role: inputs.role, permissions: inputs.permissions ?? [] };
                const data = await superTokensFetch(connectionUri, apiKey, 'PUT', `/recipe/role`, body, logger);
                return { output: { result: data } };
            }

            case 'getRoles': {
                const data = await superTokensFetch(connectionUri, apiKey, 'GET', `/recipe/roles`, undefined, logger);
                return { output: { roles: data } };
            }

            case 'deleteRole': {
                const data = await superTokensFetch(connectionUri, apiKey, 'DELETE', `/recipe/role?role=${encodeURIComponent(inputs.role)}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'addRoleToUser': {
                const body: any = { userId: inputs.userId, role: inputs.role };
                if (inputs.tenantId) body.tenantId = inputs.tenantId;
                const data = await superTokensFetch(connectionUri, apiKey, 'PUT', `/recipe/user/role`, body, logger);
                return { output: { result: data } };
            }

            case 'removeRoleFromUser': {
                const body: any = { userId: inputs.userId, role: inputs.role };
                const data = await superTokensFetch(connectionUri, apiKey, 'DELETE', `/recipe/user/role`, body, logger);
                return { output: { result: data } };
            }

            case 'listUserRoles': {
                const data = await superTokensFetch(connectionUri, apiKey, 'GET', `/recipe/user/roles?userId=${encodeURIComponent(inputs.userId)}`, undefined, logger);
                return { output: { roles: data } };
            }

            default:
                return { error: `Unknown SuperTokens action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[SuperTokens] Error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in SuperTokens action' };
    }
}
