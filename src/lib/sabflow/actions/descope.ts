'use server';

// ---------------------------------------------------------------------------
// Descope Authentication API – User, role, permission, tenant management
// Docs: https://docs.descope.com/api/
// ---------------------------------------------------------------------------

const DESCOPE_BASE = 'https://api.descope.com/v1';

async function descopeFetch(
    managementKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${DESCOPE_BASE}${path}`;
    logger?.log(`[Descope] ${method} ${url}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${managementKey}`,
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
            data?.errorDescription ??
            data?.message ??
            data?.error ??
            `Descope API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeDescopeAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { managementKey } = inputs;

        switch (actionName) {
            case 'listUsers': {
                const body: any = {};
                if (inputs.limit !== undefined) body.limit = inputs.limit;
                if (inputs.page !== undefined) body.page = inputs.page;
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/user/search`, body, logger);
                return { output: { users: data } };
            }

            case 'getUser': {
                const loginIds = Array.isArray(inputs.loginIds) ? inputs.loginIds : [inputs.loginId];
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/user`, { loginIds }, logger);
                return { output: { user: data } };
            }

            case 'createUser': {
                const body: any = {
                    loginIds: Array.isArray(inputs.loginIds) ? inputs.loginIds : [inputs.loginId],
                };
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.displayName) body.displayName = inputs.displayName;
                if (inputs.roles) body.roles = inputs.roles;
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/user/create`, body, logger);
                return { output: { user: data } };
            }

            case 'updateUser': {
                const body: any = {
                    loginIds: Array.isArray(inputs.loginIds) ? inputs.loginIds : [inputs.loginId],
                };
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.displayName) body.displayName = inputs.displayName;
                if (inputs.roles) body.roles = inputs.roles;
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/user/update`, body, logger);
                return { output: { user: data } };
            }

            case 'deleteUser': {
                const loginIds = Array.isArray(inputs.loginIds) ? inputs.loginIds : [inputs.loginId];
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/user/delete`, { loginIds }, logger);
                return { output: { result: data } };
            }

            case 'listRoles': {
                const data = await descopeFetch(managementKey, 'GET', `/mgmt/role`, undefined, logger);
                return { output: { roles: data } };
            }

            case 'createRole': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.permissionNames) body.permissionNames = inputs.permissionNames;
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/role/create`, body, logger);
                return { output: { role: data } };
            }

            case 'deleteRole': {
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/role/delete`, { name: inputs.name }, logger);
                return { output: { result: data } };
            }

            case 'listPermissions': {
                const data = await descopeFetch(managementKey, 'GET', `/mgmt/permission`, undefined, logger);
                return { output: { permissions: data } };
            }

            case 'createPermission': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/permission/create`, body, logger);
                return { output: { permission: data } };
            }

            case 'deletePermission': {
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/permission/delete`, { name: inputs.name }, logger);
                return { output: { result: data } };
            }

            case 'listTenants': {
                const data = await descopeFetch(managementKey, 'GET', `/mgmt/tenant`, undefined, logger);
                return { output: { tenants: data } };
            }

            case 'createTenant': {
                const body = { name: inputs.name };
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/tenant/create`, body, logger);
                return { output: { tenant: data } };
            }

            case 'deleteTenant': {
                const data = await descopeFetch(managementKey, 'POST', `/mgmt/tenant/delete`, { id: inputs.id }, logger);
                return { output: { result: data } };
            }

            case 'getProjectDetails': {
                const data = await descopeFetch(managementKey, 'GET', `/mgmt/project`, undefined, logger);
                return { output: { project: data } };
            }

            case 'validateSession': {
                const url = `${DESCOPE_BASE}/auth/validate`;
                logger?.log(`[Descope] POST ${url}`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${managementKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: inputs.token }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) {
                    throw new Error(data?.errorDescription ?? data?.message ?? `Descope validate error: ${res.status}`);
                }
                return { output: { validation: data } };
            }

            default:
                return { error: `Unknown Descope action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Descope] Error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in Descope action' };
    }
}
