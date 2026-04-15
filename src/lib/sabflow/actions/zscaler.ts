
'use server';

import crypto from 'crypto';

function buildZscalerPassword(password: string, apiKey: string): { timestamp: string; obfuscatedApiKey: string } {
    const timestamp = String(Date.now());
    const high = timestamp.substring(timestamp.length - 6);
    const low = high.split('').map((c) => String(parseInt(c, 10) >> 1)).join('');
    const obfuscatedApiKey = high.split('').reduce((acc, _, i) => {
        acc += apiKey[parseInt(high[i], 10)];
        return acc;
    }, '') + low.split('').reduce((acc, _, i) => {
        acc += apiKey[parseInt(low[i], 10) + 2];
        return acc;
    }, '');
    return { timestamp, obfuscatedApiKey };
}

async function zscalerAuthenticate(cloudUrl: string, username: string, password: string, apiKey: string, logger?: any): Promise<string> {
    logger?.log('[Zscaler] Authenticating session');
    const { timestamp, obfuscatedApiKey } = buildZscalerPassword(password, apiKey);
    const url = `${cloudUrl}/api/v1/authenticatedSession`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ apiKey: obfuscatedApiKey, username, password, timestamp }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Zscaler authentication failed: ${res.status}`);
    }
    const cookies = res.headers.get('set-cookie') ?? '';
    const jSession = cookies.split(';').find((c) => c.trim().startsWith('JSESSIONID='));
    if (!jSession) throw new Error('Zscaler: JSESSIONID cookie not returned after authentication.');
    return jSession.trim();
}

async function zscalerFetch(cloudUrl: string, sessionCookie: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Zscaler] ${method} ${path}`);
    const url = `${cloudUrl}/api/v1${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Cookie: sessionCookie,
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Zscaler API error: ${res.status}`);
    }
    return data;
}

export async function executeZscalerAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const cloudUrl = String(inputs.cloudUrl ?? 'https://zsapi.zscaler.net').replace(/\/$/, '');
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();

        // authenticate action does not need session first
        if (actionName === 'authenticate') {
            if (!username || !password || !apiKey) throw new Error('username, password, and apiKey are required.');
            const sessionCookie = await zscalerAuthenticate(cloudUrl, username, password, apiKey, logger);
            return { output: { authenticated: 'true', session: sessionCookie } };
        }

        // All other actions need a session
        if (!username || !password || !apiKey) throw new Error('username, password, and apiKey are required for Zscaler API calls.');
        const sessionCookie = await zscalerAuthenticate(cloudUrl, username, password, apiKey, logger);
        const z = (method: string, path: string, body?: any) => zscalerFetch(cloudUrl, sessionCookie, method, path, body, logger);

        switch (actionName) {
            case 'getConfig': {
                const data = await z('GET', '/config');
                return { output: data };
            }

            case 'listUrlCategories': {
                const custom = inputs.customOnly === true || inputs.customOnly === 'true' ? '?customOnly=true' : '';
                const data = await z('GET', `/urlCategories${custom}`);
                return { output: { categories: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'addToUrlCategory': {
                const categoryId = String(inputs.categoryId ?? '').trim();
                const urls = Array.isArray(inputs.urls) ? inputs.urls : String(inputs.urls ?? '').split(',').map((u: string) => u.trim()).filter(Boolean);
                if (!categoryId || urls.length === 0) throw new Error('categoryId and urls are required.');
                const data = await z('PUT', `/urlCategories/${categoryId}?action=ADD_TO_LIST`, { configuredName: inputs.configuredName ?? categoryId, urls });
                return { output: { categoryId, urlsAdded: urls, id: data.id ?? categoryId } };
            }

            case 'removeFromUrlCategory': {
                const categoryId = String(inputs.categoryId ?? '').trim();
                const urls = Array.isArray(inputs.urls) ? inputs.urls : String(inputs.urls ?? '').split(',').map((u: string) => u.trim()).filter(Boolean);
                if (!categoryId || urls.length === 0) throw new Error('categoryId and urls are required.');
                const data = await z('PUT', `/urlCategories/${categoryId}?action=REMOVE_FROM_LIST`, { configuredName: inputs.configuredName ?? categoryId, urls });
                return { output: { categoryId, urlsRemoved: urls, id: data.id ?? categoryId } };
            }

            case 'listFirewallRules': {
                const data = await z('GET', '/firewallFilteringRules');
                return { output: { rules: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'createFirewallRule': {
                const name = String(inputs.name ?? '').trim();
                const action = String(inputs.action ?? 'ALLOW').trim();
                if (!name) throw new Error('name is required.');
                const body: any = {
                    name,
                    action,
                    order: Number(inputs.order ?? 1),
                    state: inputs.state ?? 'ENABLED',
                };
                if (inputs.description) body.description = String(inputs.description);
                const data = await z('POST', '/firewallFilteringRules', body);
                return { output: { id: String(data.id ?? ''), name: data.name, action: data.action } };
            }

            case 'updateFirewallRule': {
                const ruleId = String(inputs.ruleId ?? '').trim();
                if (!ruleId) throw new Error('ruleId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.action) body.action = String(inputs.action);
                if (inputs.state) body.state = String(inputs.state);
                if (inputs.order) body.order = Number(inputs.order);
                const data = await z('PUT', `/firewallFilteringRules/${ruleId}`, body);
                return { output: { id: String(data.id ?? ruleId), name: data.name, action: data.action } };
            }

            case 'deleteFirewallRule': {
                const ruleId = String(inputs.ruleId ?? '').trim();
                if (!ruleId) throw new Error('ruleId is required.');
                await z('DELETE', `/firewallFilteringRules/${ruleId}`);
                return { output: { deleted: 'true', ruleId } };
            }

            case 'getUserCount': {
                const data = await z('GET', '/users/count');
                return { output: { count: String(data.count ?? data) } };
            }

            case 'listUsers': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 100);
                const data = await z('GET', `/users?pageSize=${pageSize}&page=${page}`);
                return { output: { users: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await z('GET', `/users/${userId}`);
                return { output: { id: String(data.id), name: data.name, email: data.email ?? '', department: data.department?.name ?? '' } };
            }

            case 'addUser': {
                const name = String(inputs.name ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const userPassword = String(inputs.userPassword ?? '').trim();
                if (!name || !email || !userPassword) throw new Error('name, email, and userPassword are required.');
                const body: any = {
                    name,
                    email,
                    password: userPassword,
                    groups: inputs.groups ?? [],
                };
                if (inputs.department) body.department = { id: Number(inputs.department) };
                const data = await z('POST', '/users', body);
                return { output: { id: String(data.id ?? ''), name: data.name, email: data.email } };
            }

            case 'deleteUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                await z('DELETE', `/users/${userId}`);
                return { output: { deleted: 'true', userId } };
            }

            case 'listDepartments': {
                const data = await z('GET', '/departments');
                return { output: { departments: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getDepartments': {
                const deptId = String(inputs.departmentId ?? '').trim();
                if (!deptId) throw new Error('departmentId is required.');
                const data = await z('GET', `/departments/${deptId}`);
                return { output: { id: String(data.id), name: data.name, idpId: String(data.idpId ?? '') } };
            }

            case 'activateConfig': {
                // Activate config requires logout + re-auth cycle via /status endpoint
                await z('POST', '/status/activate', {});
                // Logout session
                await fetch(`${cloudUrl}/api/v1/authenticatedSession`, {
                    method: 'DELETE',
                    headers: { Cookie: sessionCookie },
                }).catch(() => {});
                return { output: { activated: 'true' } };
            }

            case 'listAppConnectors': {
                const data = await z('GET', '/appConnectors');
                return { output: { appConnectors: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            default:
                return { error: `Zscaler action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Zscaler action failed.' };
    }
}
