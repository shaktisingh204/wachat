'use server';

// ---------------------------------------------------------------------------
// Okta IAM API Enhanced – Extended user/group/app lifecycle operations
// Docs: https://developer.okta.com/docs/reference/core-okta-api/
// ---------------------------------------------------------------------------

async function oktaEnhancedFetch(
    apiToken: string,
    domain: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = `https://${domain}/api/v1`;
    const url = `${base}${path}`;
    logger?.log(`[OktaEnhanced] ${method} ${url}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `SSWS ${apiToken}`,
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
            data?.errorSummary ??
            data?.message ??
            `Okta API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeOktaEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiToken, domain } = inputs;

        switch (actionName) {
            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await oktaEnhancedFetch(apiToken, domain, 'GET', `/users${query}`, undefined, logger);
                return { output: { users: data } };
            }

            case 'getUser': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'GET', `/users/${inputs.userId}`, undefined, logger);
                return { output: { user: data } };
            }

            case 'createUser': {
                const body = {
                    profile: {
                        login: inputs.login,
                        email: inputs.email,
                        firstName: inputs.firstName,
                        lastName: inputs.lastName,
                    },
                    credentials: {
                        password: { value: inputs.password },
                    },
                };
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/users?activate=true`, body, logger);
                return { output: { user: data } };
            }

            case 'updateUser': {
                const body = { profile: inputs.profile ?? {} };
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/users/${inputs.userId}`, body, logger);
                return { output: { user: data } };
            }

            case 'deactivateUser': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/users/${inputs.userId}/lifecycle/deactivate`, undefined, logger);
                return { output: { result: data } };
            }

            case 'deleteUser': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'DELETE', `/users/${inputs.userId}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await oktaEnhancedFetch(apiToken, domain, 'GET', `/groups${query}`, undefined, logger);
                return { output: { groups: data } };
            }

            case 'getGroup': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'GET', `/groups/${inputs.groupId}`, undefined, logger);
                return { output: { group: data } };
            }

            case 'createGroup': {
                const body = {
                    profile: {
                        name: inputs.name,
                        description: inputs.description ?? '',
                    },
                };
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/groups`, body, logger);
                return { output: { group: data } };
            }

            case 'addUserToGroup': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'PUT', `/groups/${inputs.groupId}/users/${inputs.userId}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'removeUserFromGroup': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'DELETE', `/groups/${inputs.groupId}/users/${inputs.userId}`, undefined, logger);
                return { output: { result: data } };
            }

            case 'listUserGroups': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'GET', `/users/${inputs.userId}/groups`, undefined, logger);
                return { output: { groups: data } };
            }

            case 'listApps': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'GET', `/apps`, undefined, logger);
                return { output: { apps: data } };
            }

            case 'getApp': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'GET', `/apps/${inputs.appId}`, undefined, logger);
                return { output: { app: data } };
            }

            case 'assignUserToApp': {
                const body = { id: inputs.userId, scope: 'USER' };
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/apps/${inputs.appId}/users`, body, logger);
                return { output: { assignment: data } };
            }

            case 'resetPassword': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/users/${inputs.userId}/credentials/forgot_password`, undefined, logger);
                return { output: { result: data } };
            }

            case 'suspendUser': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/users/${inputs.userId}/lifecycle/suspend`, undefined, logger);
                return { output: { result: data } };
            }

            case 'unsuspendUser': {
                const data = await oktaEnhancedFetch(apiToken, domain, 'POST', `/users/${inputs.userId}/lifecycle/unsuspend`, undefined, logger);
                return { output: { result: data } };
            }

            default:
                return { error: `Unknown OktaEnhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[OktaEnhanced] Error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in OktaEnhanced action' };
    }
}
