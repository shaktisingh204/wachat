'use server';

// ---------------------------------------------------------------------------
// Auth0 Management API v2
// Docs: https://auth0.com/docs/api/management/v2
// ---------------------------------------------------------------------------

async function auth0Fetch(
    managementToken: string,
    domain: string,
    method: string,
    path: string,
    body?: any,
    logger?: any,
    absoluteUrl?: string
): Promise<any> {
    const base = `https://${domain}/api/v2`;
    const url = absoluteUrl ?? `${base}${path}`;
    logger?.log(`[Auth0] ${method} ${absoluteUrl ? path : url}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    // 204 No Content
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

function buildQuery(params: Record<string, any>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

export async function executeAuth0Action(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const managementToken = String(inputs.managementToken ?? '').trim();
        const domain = String(inputs.domain ?? '').trim();
        if (!managementToken) throw new Error('"managementToken" is required.');
        if (!domain) throw new Error('"domain" is required (e.g. your-tenant.auth0.com).');

        const a0 = (method: string, path: string, body?: any) =>
            auth0Fetch(managementToken, domain, method, path, body, logger);

        switch (actionName) {
            // ── Users ─────────────────────────────────────────────────────────
            case 'getUsers': {
                const q = buildQuery({
                    q: encodeURIComponent(inputs.q ?? ''),
                    per_page: inputs.perPage ?? 50,
                    page: inputs.page,
                    include_totals: true,
                });
                const data = await a0('GET', `/users${q}`);
                return {
                    output: {
                        users: data.users ?? data ?? [],
                        total: data.total,
                        page: data.start,
                        perPage: data.limit,
                    },
                };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                const data = await a0('GET', `/users/${encodeURIComponent(userId)}`);
                return {
                    output: {
                        user_id: data.user_id,
                        email: data.email,
                        name: data.name,
                        app_metadata: data.app_metadata,
                        user_metadata: data.user_metadata,
                        created_at: data.created_at,
                    },
                };
            }

            case 'createUser': {
                const email = String(inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                const connection = String(inputs.connection ?? '').trim();
                if (!email) throw new Error('"email" is required.');
                if (!password) throw new Error('"password" is required.');
                if (!connection) throw new Error('"connection" is required.');
                const body: any = { email, password, connection };
                if (inputs.name) body.name = String(inputs.name).trim();
                if (inputs.userMetadata !== undefined) {
                    body.user_metadata =
                        typeof inputs.userMetadata === 'string'
                            ? JSON.parse(inputs.userMetadata)
                            : inputs.userMetadata;
                }
                if (inputs.appMetadata !== undefined) {
                    body.app_metadata =
                        typeof inputs.appMetadata === 'string'
                            ? JSON.parse(inputs.appMetadata)
                            : inputs.appMetadata;
                }
                const data = await a0('POST', '/users', body);
                return { output: { user_id: data.user_id, email: data.email } };
            }

            case 'updateUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                const body: any = {};
                if (inputs.name !== undefined) body.name = String(inputs.name).trim();
                if (inputs.blocked !== undefined) body.blocked = inputs.blocked === true || inputs.blocked === 'true';
                if (inputs.userMetadata !== undefined) {
                    body.user_metadata =
                        typeof inputs.userMetadata === 'string'
                            ? JSON.parse(inputs.userMetadata)
                            : inputs.userMetadata;
                }
                if (inputs.appMetadata !== undefined) {
                    body.app_metadata =
                        typeof inputs.appMetadata === 'string'
                            ? JSON.parse(inputs.appMetadata)
                            : inputs.appMetadata;
                }
                const data = await a0('PATCH', `/users/${encodeURIComponent(userId)}`, body);
                return { output: { user_id: data.user_id } };
            }

            case 'deleteUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                await a0('DELETE', `/users/${encodeURIComponent(userId)}`);
                return { output: { deleted: true } };
            }

            case 'blockUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                await a0('PATCH', `/users/${encodeURIComponent(userId)}`, { blocked: true });
                return { output: { blocked: true } };
            }

            // ── Roles ─────────────────────────────────────────────────────────
            case 'getRoles': {
                const data = await a0('GET', '/roles?per_page=100');
                const roles = Array.isArray(data) ? data : data.roles ?? [];
                return {
                    output: {
                        roles: roles.map((r: any) => ({ id: r.id, name: r.name, description: r.description })),
                    },
                };
            }

            case 'createRole': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                const body: any = { name };
                if (inputs.description) body.description = String(inputs.description).trim();
                const data = await a0('POST', '/roles', body);
                return { output: { id: data.id, name: data.name } };
            }

            case 'assignUsersToRole': {
                const roleId = String(inputs.roleId ?? '').trim();
                if (!roleId) throw new Error('"roleId" is required.');
                const userIds =
                    typeof inputs.userIds === 'string'
                        ? JSON.parse(inputs.userIds)
                        : inputs.userIds;
                if (!Array.isArray(userIds) || userIds.length === 0) {
                    throw new Error('"userIds" must be a non-empty array.');
                }
                await a0('POST', `/roles/${roleId}/users`, { users: userIds });
                return { output: { assigned: true } };
            }

            case 'getUserRoles': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                const data = await a0('GET', `/users/${encodeURIComponent(userId)}/roles`);
                return { output: { roles: Array.isArray(data) ? data : [] } };
            }

            // ── Connections ───────────────────────────────────────────────────
            case 'getConnections': {
                const data = await a0('GET', '/connections?per_page=100');
                return { output: { connections: Array.isArray(data) ? data : [] } };
            }

            // ── Logs ──────────────────────────────────────────────────────────
            case 'getLogs': {
                const q = buildQuery({
                    q: encodeURIComponent(inputs.q ?? ''),
                    take: inputs.take ?? 50,
                    from: inputs.from,
                });
                const data = await a0('GET', `/logs${q}`);
                return { output: { logs: Array.isArray(data) ? data : [] } };
            }

            // ── Password Reset ────────────────────────────────────────────────
            case 'triggerPasswordReset': {
                const email = String(inputs.email ?? '').trim();
                const connection = String(inputs.connection ?? '').trim();
                const clientId = String(inputs.clientId ?? '').trim();
                if (!email) throw new Error('"email" is required.');
                if (!connection) throw new Error('"connection" is required.');
                const resetUrl = `https://${domain}/dbconnections/change_password`;
                const body = { client_id: clientId, email, connection };
                const res = await fetch(resetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                if (!res.ok) throw new Error(`Auth0 password reset failed (${res.status}): ${text}`);
                return { output: { message: text } };
            }

            // ── Stats ─────────────────────────────────────────────────────────
            case 'getStats': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                if (!from) throw new Error('"from" is required (YYYYMMDD).');
                if (!to) throw new Error('"to" is required (YYYYMMDD).');
                const data = await a0('GET', `/stats/daily?from=${from}&to=${to}`);
                return { output: { stats: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Auth0 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'Auth0 action failed.';
        logger?.log(`[Auth0] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
