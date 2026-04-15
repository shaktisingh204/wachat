
'use server';

export async function executePayloadCmsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required.');

        const getToken = async (): Promise<string> => {
            if (inputs.authToken) return String(inputs.authToken).trim();
            const email = String(inputs.email ?? '').trim();
            const password = String(inputs.password ?? '').trim();
            if (!email || !password) throw new Error('Either authToken or email/password is required.');
            logger?.log('[PayloadCMS] POST /api/users/login');
            const res = await fetch(`${serverUrl}/api/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `Login failed: ${res.status}`);
            if (!data.token) throw new Error('No token returned from login.');
            return data.token;
        };

        const payloadFetch = async (method: string, path: string, body?: any, isMultipart = false, token?: string) => {
            const authToken = token ?? await getToken();
            logger?.log(`[PayloadCMS] ${method} ${serverUrl}${path}`);
            const headers: Record<string, string> = {
                Authorization: authToken,
            };
            if (!isMultipart) headers['Content-Type'] = 'application/json';
            const opts: RequestInit = { method, headers };
            if (body !== undefined && !isMultipart) opts.body = JSON.stringify(body);
            if (body !== undefined && isMultipart) opts.body = body;
            const res = await fetch(`${serverUrl}${path}`, opts);
            if (res.status === 204) return {};
            const text = await res.text();
            if (!text) return {};
            let data: any;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `Payload CMS API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'login': {
                const email = String(inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!email) throw new Error('email is required.');
                if (!password) throw new Error('password is required.');
                logger?.log('[PayloadCMS] POST /api/users/login');
                const res = await fetch(`${serverUrl}/api/users/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { message: text }; }
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `Login failed: ${res.status}`);
                return { output: { token: data.token ?? '', user: data.user ?? {}, exp: String(data.exp ?? '') } };
            }

            case 'listDocuments': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const limit = Number(inputs.limit ?? 10);
                const page = Number(inputs.page ?? 1);
                let path = `/api/${collection}?limit=${limit}&page=${page}`;
                if (inputs.where) {
                    const where = typeof inputs.where === 'string' ? inputs.where : JSON.stringify(inputs.where);
                    path += `&where=${encodeURIComponent(where)}`;
                }
                if (inputs.sort) path += `&sort=${encodeURIComponent(String(inputs.sort))}`;
                const data = await payloadFetch('GET', path);
                return { output: { docs: data.docs ?? [], totalDocs: String(data.totalDocs ?? 0), totalPages: String(data.totalPages ?? 0), page: String(data.page ?? 1) } };
            }

            case 'getDocument': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await payloadFetch('GET', `/api/${collection}/${id}`);
                return { output: { document: data } };
            }

            case 'createDocument': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                if (!inputs.data) throw new Error('data is required.');
                const docData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await payloadFetch('POST', `/api/${collection}`, docData);
                return { output: { document: data.doc ?? data, id: String(data.doc?.id ?? data.id ?? '') } };
            }

            case 'updateDocument': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!inputs.data) throw new Error('data is required.');
                const docData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await payloadFetch('PATCH', `/api/${collection}/${id}`, docData);
                return { output: { document: data.doc ?? data } };
            }

            case 'deleteDocument': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await payloadFetch('DELETE', `/api/${collection}/${id}`);
                return { output: { deleted: 'true', id, document: data.doc ?? {} } };
            }

            case 'listGlobals': {
                const globalSlug = String(inputs.globalSlug ?? '').trim();
                if (!globalSlug) throw new Error('globalSlug is required.');
                const data = await payloadFetch('GET', `/api/globals/${globalSlug}`);
                return { output: { global: data } };
            }

            case 'updateGlobal': {
                const globalSlug = String(inputs.globalSlug ?? '').trim();
                if (!globalSlug) throw new Error('globalSlug is required.');
                if (!inputs.data) throw new Error('data is required.');
                const globalData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await payloadFetch('POST', `/api/globals/${globalSlug}`, globalData);
                return { output: { global: data } };
            }

            case 'uploadMedia': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                const filename = String(inputs.filename ?? 'upload').trim() || 'upload';
                const alt = String(inputs.alt ?? '').trim();
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);
                const blob = await fileRes.blob();
                const formData = new FormData();
                formData.append('file', blob, filename);
                if (alt) formData.append('alt', alt);
                const data = await payloadFetch('POST', '/api/media', formData, true);
                return { output: { media: data.doc ?? data, id: String(data.doc?.id ?? data.id ?? '') } };
            }

            case 'listMedia': {
                const limit = Number(inputs.limit ?? 10);
                const page = Number(inputs.page ?? 1);
                const data = await payloadFetch('GET', `/api/media?limit=${limit}&page=${page}`);
                return { output: { docs: data.docs ?? [], totalDocs: String(data.totalDocs ?? 0) } };
            }

            case 'getMedia': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await payloadFetch('GET', `/api/media/${id}`);
                return { output: { media: data } };
            }

            case 'listUsers': {
                const limit = Number(inputs.limit ?? 10);
                const page = Number(inputs.page ?? 1);
                const data = await payloadFetch('GET', `/api/users?limit=${limit}&page=${page}`);
                return { output: { docs: data.docs ?? [], totalDocs: String(data.totalDocs ?? 0) } };
            }

            case 'createUser': {
                if (!inputs.user) throw new Error('user is required.');
                const userData = typeof inputs.user === 'string' ? JSON.parse(inputs.user) : inputs.user;
                const data = await payloadFetch('POST', '/api/users', userData);
                return { output: { user: data.doc ?? data, id: String(data.doc?.id ?? data.id ?? '') } };
            }

            case 'updateUser': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!inputs.user) throw new Error('user is required.');
                const userData = typeof inputs.user === 'string' ? JSON.parse(inputs.user) : inputs.user;
                const data = await payloadFetch('PATCH', `/api/users/${id}`, userData);
                return { output: { user: data.doc ?? data } };
            }

            case 'deleteUser': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await payloadFetch('DELETE', `/api/users/${id}`);
                return { output: { deleted: 'true', id, user: data.doc ?? {} } };
            }

            default:
                return { error: `Payload CMS action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Payload CMS action failed.' };
    }
}
