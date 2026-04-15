
'use server';

export async function executeDirectusAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '');
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!accessToken) throw new Error('accessToken is required.');

        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const req = async (method: string, path: string, body?: any, isMultipart?: boolean) => {
            logger?.log(`[Directus] ${method} ${serverUrl}${path}`);
            const opts: RequestInit = { method, headers: isMultipart ? { Authorization: `Bearer ${accessToken}` } : { ...headers } };
            if (body !== undefined && !isMultipart) opts.body = JSON.stringify(body);
            if (isMultipart) opts.body = body;
            const res = await fetch(`${serverUrl}${path}`, opts);
            if (res.status === 204) return {};
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `Directus API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listItems': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.filter) params.set('filter', typeof inputs.filter === 'string' ? inputs.filter : JSON.stringify(inputs.filter));
                if (inputs.sort) params.set('sort', String(inputs.sort));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/items/${collection}${qs}`);
                return { output: { items: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'getItem': {
                const collection = String(inputs.collection ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/items/${collection}/${id}`);
                return { output: { item: data.data ?? {} } };
            }

            case 'createItem': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const payload = typeof inputs.payload === 'object' ? inputs.payload : JSON.parse(String(inputs.payload ?? '{}'));
                const data = await req('POST', `/items/${collection}`, payload);
                return { output: { item: data.data ?? {}, id: data.data?.id ?? '' } };
            }

            case 'updateItem': {
                const collection = String(inputs.collection ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                if (!id) throw new Error('id is required.');
                const payload = typeof inputs.payload === 'object' ? inputs.payload : JSON.parse(String(inputs.payload ?? '{}'));
                const data = await req('PATCH', `/items/${collection}/${id}`, payload);
                return { output: { item: data.data ?? {} } };
            }

            case 'deleteItem': {
                const collection = String(inputs.collection ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                if (!id) throw new Error('id is required.');
                await req('DELETE', `/items/${collection}/${id}`);
                return { output: { success: true, id } };
            }

            case 'listCollections': {
                const data = await req('GET', '/collections');
                return { output: { collections: data.data ?? [] } };
            }

            case 'createCollection': {
                const collectionName = String(inputs.collectionName ?? '').trim();
                if (!collectionName) throw new Error('collectionName is required.');
                const meta = typeof inputs.meta === 'object' ? inputs.meta : {};
                const fields = Array.isArray(inputs.fields) ? inputs.fields : [];
                const data = await req('POST', '/collections', { collection: collectionName, meta, fields });
                return { output: { collection: data.data ?? {} } };
            }

            case 'getSchema': {
                const data = await req('GET', '/schema/snapshot');
                return { output: { schema: data.data ?? {} } };
            }

            case 'applySchema': {
                const diff = typeof inputs.diff === 'object' ? inputs.diff : JSON.parse(String(inputs.diff ?? '{}'));
                const data = await req('POST', '/schema/apply', diff);
                return { output: { result: data } };
            }

            case 'listRelations': {
                const data = await req('GET', '/relations');
                return { output: { relations: data.data ?? [] } };
            }

            case 'listFiles': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/files${qs}`);
                return { output: { files: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'uploadFile': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const filename = String(inputs.filename ?? 'upload').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                const fileRes = await fetch(fileUrl);
                const blob = await fileRes.blob();
                const form = new FormData();
                form.append('file', blob, filename);
                if (inputs.title) form.append('title', String(inputs.title));
                if (inputs.folder) form.append('folder', String(inputs.folder));
                const data = await req('POST', '/files', form, true);
                return { output: { file: data.data ?? {}, id: data.data?.id ?? '' } };
            }

            case 'getFile': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/files/${id}`);
                return { output: { file: data.data ?? {} } };
            }

            case 'deleteFile': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await req('DELETE', `/files/${id}`);
                return { output: { success: true, id } };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/users${qs}`);
                return { output: { users: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'createUser': {
                const payload = typeof inputs.payload === 'object' ? inputs.payload : JSON.parse(String(inputs.payload ?? '{}'));
                const data = await req('POST', '/users', payload);
                return { output: { user: data.data ?? {}, id: data.data?.id ?? '' } };
            }

            case 'updateUser': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const payload = typeof inputs.payload === 'object' ? inputs.payload : JSON.parse(String(inputs.payload ?? '{}'));
                const data = await req('PATCH', `/users/${id}`, payload);
                return { output: { user: data.data ?? {} } };
            }

            case 'listRoles': {
                const data = await req('GET', '/roles');
                return { output: { roles: data.data ?? [] } };
            }

            default:
                return { error: `Directus action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Directus action failed.' };
    }
}
