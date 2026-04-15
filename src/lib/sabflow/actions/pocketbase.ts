
'use server';

async function pbRequest(
    method: string,
    url: string,
    token: string,
    body?: any
): Promise<any> {
    const res = await fetch(url, {
        method,
        headers: {
            'Authorization': token ? token : '',
            'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        const msg = data?.message || text || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

async function getAuthToken(serverUrl: string, inputs: any): Promise<string> {
    if (inputs.authToken) return String(inputs.authToken).trim();
    const identity = String(inputs.adminEmail ?? inputs.identity ?? '').trim();
    const password = String(inputs.adminPassword ?? inputs.password ?? '').trim();
    if (!identity || !password) throw new Error('"authToken" or "adminEmail"+"adminPassword" are required.');
    const res = await fetch(`${serverUrl}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, password }),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || text || `Auth failed HTTP ${res.status}`);
    return String(data.token);
}

export async function executePocketBaseAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '').trim();
        if (!serverUrl) throw new Error('"serverUrl" is required.');

        switch (actionName) {
            case 'authenticate': {
                logger.log('[PocketBase] authenticate');
                const token = await getAuthToken(serverUrl, inputs);
                return { output: { token } };
            }

            case 'listCollections': {
                const token = await getAuthToken(serverUrl, inputs);
                logger.log('[PocketBase] listCollections');
                const data = await pbRequest('GET', `${serverUrl}/api/collections`, token);
                return { output: data };
            }

            case 'getCollection': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                logger.log(`[PocketBase] getCollection: ${collection}`);
                const data = await pbRequest('GET', `${serverUrl}/api/collections/${encodeURIComponent(collection)}`, token);
                return { output: data };
            }

            case 'createCollection': {
                const token = await getAuthToken(serverUrl, inputs);
                const collectionDef = inputs.collectionDef ?? inputs.definition ?? {};
                if (!collectionDef.name) throw new Error('"collectionDef.name" is required.');
                logger.log(`[PocketBase] createCollection: ${collectionDef.name}`);
                const data = await pbRequest('POST', `${serverUrl}/api/collections`, token, collectionDef);
                return { output: data };
            }

            case 'updateCollection': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                const collectionDef = inputs.collectionDef ?? inputs.definition ?? {};
                if (!collection) throw new Error('"collection" is required.');
                logger.log(`[PocketBase] updateCollection: ${collection}`);
                const data = await pbRequest('PATCH', `${serverUrl}/api/collections/${encodeURIComponent(collection)}`, token, collectionDef);
                return { output: data };
            }

            case 'deleteCollection': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                logger.log(`[PocketBase] deleteCollection: ${collection}`);
                await pbRequest('DELETE', `${serverUrl}/api/collections/${encodeURIComponent(collection)}`, token);
                return { output: { success: true, deleted: collection } };
            }

            case 'listRecords': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', String(inputs.filter));
                if (inputs.sort) params.set('sort', String(inputs.sort));
                if (inputs.expand) params.set('expand', String(inputs.expand));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                logger.log(`[PocketBase] listRecords collection=${collection}`);
                const data = await pbRequest('GET', `${serverUrl}/api/collections/${encodeURIComponent(collection)}/records?${params}`, token);
                return { output: data };
            }

            case 'getRecord': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                if (!id) throw new Error('"id" is required.');
                logger.log(`[PocketBase] getRecord ${collection}/${id}`);
                const data = await pbRequest('GET', `${serverUrl}/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, token);
                return { output: data };
            }

            case 'createRecord': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                const record = inputs.record ?? inputs.data ?? {};
                if (!collection) throw new Error('"collection" is required.');
                logger.log(`[PocketBase] createRecord collection=${collection}`);
                const data = await pbRequest('POST', `${serverUrl}/api/collections/${encodeURIComponent(collection)}/records`, token, record);
                return { output: data };
            }

            case 'updateRecord': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                const record = inputs.record ?? inputs.data ?? {};
                if (!collection) throw new Error('"collection" is required.');
                if (!id) throw new Error('"id" is required.');
                logger.log(`[PocketBase] updateRecord ${collection}/${id}`);
                const data = await pbRequest('PATCH', `${serverUrl}/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, token, record);
                return { output: data };
            }

            case 'deleteRecord': {
                const token = await getAuthToken(serverUrl, inputs);
                const collection = String(inputs.collection ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                if (!id) throw new Error('"id" is required.');
                logger.log(`[PocketBase] deleteRecord ${collection}/${id}`);
                await pbRequest('DELETE', `${serverUrl}/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, token);
                return { output: { success: true, deleted: id } };
            }

            case 'authWithPassword': {
                const collection = String(inputs.collection ?? 'users').trim();
                const identity = String(inputs.identity ?? inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!identity || !password) throw new Error('"identity" and "password" are required.');
                logger.log(`[PocketBase] authWithPassword collection=${collection}`);
                const res = await fetch(`${serverUrl}/api/collections/${encodeURIComponent(collection)}/auth-with-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identity, password }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || text || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'createUser': {
                const token = await getAuthToken(serverUrl, inputs);
                const email = String(inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                const passwordConfirm = String(inputs.passwordConfirm ?? inputs.password ?? '').trim();
                if (!email || !password) throw new Error('"email" and "password" are required.');
                logger.log(`[PocketBase] createUser email=${email}`);
                const data = await pbRequest('POST', `${serverUrl}/api/collections/users/records`, token, { email, password, passwordConfirm, ...inputs.extra });
                return { output: data };
            }

            case 'listUsers': {
                const token = await getAuthToken(serverUrl, inputs);
                logger.log('[PocketBase] listUsers');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                const data = await pbRequest('GET', `${serverUrl}/api/collections/users/records?${params}`, token);
                return { output: data };
            }

            case 'healthCheck': {
                logger.log('[PocketBase] healthCheck');
                const res = await fetch(`${serverUrl}/api/health`);
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                return { output: data };
            }

            default:
                throw new Error(`Unknown PocketBase action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[PocketBase] Error in ${actionName}: ${err.message}`);
        return { error: err.message || 'Unknown PocketBase error' };
    }
}
