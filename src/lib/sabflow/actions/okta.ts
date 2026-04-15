'use server';

// ---------------------------------------------------------------------------
// Okta Identity – User lifecycle, groups and app assignments
// Docs: https://developer.okta.com/docs/reference/core-okta-api/
// ---------------------------------------------------------------------------

async function oktaFetch(
    apiToken: string,
    domain: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = `https://${domain}/api/v1`;
    const url = `${base}${path}`;
    logger?.log(`[Okta] ${method} ${path}`);

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

    // 204 No Content (e.g. addUserToGroup, removeUserFromGroup, deactivateUser)
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

function buildQuery(params: Record<string, any>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

export async function executeOktaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        const domain = String(inputs.domain ?? '').trim();
        if (!apiToken) throw new Error('"apiToken" is required.');
        if (!domain) throw new Error('"domain" is required (e.g. dev-123456.okta.com).');

        const okta = (method: string, path: string, body?: any) =>
            oktaFetch(apiToken, domain, method, path, body, logger);

        switch (actionName) {
            // ── Users ─────────────────────────────────────────────────────────
            case 'listUsers': {
                const q = buildQuery({
                    limit: inputs.limit ?? 200,
                    q: inputs.q,
                    filter: inputs.filter,
                });
                const data = await okta('GET', `/users${q}`);
                return { output: { users: Array.isArray(data) ? data : [] } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                const data = await okta('GET', `/users/${userId}`);
                return {
                    output: {
                        id: data.id,
                        status: data.status,
                        profile: {
                            login: data.profile?.login,
                            email: data.profile?.email,
                            firstName: data.profile?.firstName,
                            lastName: data.profile?.lastName,
                        },
                    },
                };
            }

            case 'createUser': {
                const email = String(inputs.email ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const login = String(inputs.login ?? '').trim();
                if (!email) throw new Error('"email" is required.');
                if (!firstName) throw new Error('"firstName" is required.');
                if (!lastName) throw new Error('"lastName" is required.');
                if (!login) throw new Error('"login" is required.');
                const activate = inputs.activate !== false && inputs.activate !== 'false';
                const body: any = {
                    profile: { email, firstName, lastName, login },
                };
                if (inputs.password) {
                    body.credentials = { password: { value: String(inputs.password) } };
                }
                const suffix = activate ? '?activate=true' : '';
                const data = await okta('POST', `/users${suffix}`, body);
                return { output: { id: data.id, status: data.status, profile: data.profile ?? {} } };
            }

            case 'updateUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                const profile =
                    typeof inputs.profile === 'string'
                        ? JSON.parse(inputs.profile)
                        : inputs.profile ?? {};
                const data = await okta('POST', `/users/${userId}`, { profile });
                return { output: { id: data.id, profile: data.profile ?? {} } };
            }

            case 'deactivateUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                await okta('POST', `/users/${userId}/lifecycle/deactivate`);
                return { output: { status: 'DEPROVISIONED' } };
            }

            case 'reactivateUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                await okta('POST', `/users/${userId}/lifecycle/reactivate`);
                return { output: { status: 'PROVISIONED' } };
            }

            case 'deleteUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                await okta('DELETE', `/users/${userId}`);
                return { output: { deleted: true } };
            }

            case 'resetPassword': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                const data = await okta(
                    'POST',
                    `/users/${userId}/lifecycle/reset_password?sendEmail=false`
                );
                return { output: { resetPasswordUrl: data?.resetPasswordUrl ?? null } };
            }

            // ── Groups ────────────────────────────────────────────────────────
            case 'listGroups': {
                const q = buildQuery({ q: inputs.q, limit: inputs.limit });
                const data = await okta('GET', `/groups${q}`);
                return { output: { groups: Array.isArray(data) ? data : [] } };
            }

            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('"groupId" is required.');
                const data = await okta('GET', `/groups/${groupId}`);
                return {
                    output: {
                        id: data.id,
                        profile: { name: data.profile?.name, description: data.profile?.description },
                    },
                };
            }

            case 'createGroup': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                const profile: any = { name };
                if (inputs.description) profile.description = String(inputs.description).trim();
                const data = await okta('POST', '/groups', { profile });
                return { output: { id: data.id, profile: data.profile ?? {} } };
            }

            case 'addUserToGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!groupId) throw new Error('"groupId" is required.');
                if (!userId) throw new Error('"userId" is required.');
                await okta('PUT', `/groups/${groupId}/users/${userId}`);
                return { output: { added: true } };
            }

            case 'removeUserFromGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!groupId) throw new Error('"groupId" is required.');
                if (!userId) throw new Error('"userId" is required.');
                await okta('DELETE', `/groups/${groupId}/users/${userId}`);
                return { output: { removed: true } };
            }

            // ── Apps ──────────────────────────────────────────────────────────
            case 'listApps': {
                const q = buildQuery({ limit: inputs.limit });
                const data = await okta('GET', `/apps${q}`);
                const apps = Array.isArray(data) ? data : [];
                return {
                    output: {
                        apps: apps.map((a: any) => ({ id: a.id, label: a.label, status: a.status })),
                    },
                };
            }

            case 'assignUserToApp': {
                const appId = String(inputs.appId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!appId) throw new Error('"appId" is required.');
                if (!userId) throw new Error('"userId" is required.');
                const profile =
                    typeof inputs.profile === 'string'
                        ? JSON.parse(inputs.profile)
                        : inputs.profile;
                const body: any = { id: userId, scope: 'USER' };
                if (profile) body.profile = profile;
                const data = await okta('POST', `/apps/${appId}/users`, body);
                return { output: { id: data.id } };
            }

            default:
                return { error: `Okta action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'Okta action failed.';
        logger?.log(`[Okta] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
