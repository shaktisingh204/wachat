
'use server';

async function supabaseFetch(projectUrl: string, anonKey: string, method: string, path: string, body?: any, headers?: Record<string, string>, logger?: any) {
    logger?.log(`[Supabase] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Prefer: 'return=representation',
            ...headers,
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const base = projectUrl.replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, options);
    if (res.status === 204) return [];
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.hint || `Supabase API error: ${res.status}`);
    }
    return data;
}

export async function executeSupabaseAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const projectUrl = String(inputs.projectUrl ?? '').trim();
        const anonKey = String(inputs.anonKey ?? '').trim();
        if (!projectUrl || !anonKey) throw new Error('projectUrl and anonKey are required.');
        const sb = (method: string, path: string, body?: any, headers?: Record<string, string>) =>
            supabaseFetch(projectUrl, anonKey, method, path, body, headers, logger);

        switch (actionName) {
            case 'select': {
                const table = String(inputs.table ?? '').trim();
                const columns = String(inputs.columns ?? '*').trim();
                const filter = String(inputs.filter ?? '').trim();
                const limit = inputs.limit ? Number(inputs.limit) : undefined;
                const orderBy = String(inputs.orderBy ?? '').trim();
                if (!table) throw new Error('table is required.');
                let path = `/rest/v1/${table}?select=${encodeURIComponent(columns)}`;
                if (filter) path += `&${filter}`;
                if (orderBy) path += `&order=${encodeURIComponent(orderBy)}`;
                if (limit) path += `&limit=${limit}`;
                const data = await sb('GET', path);
                return { output: { rows: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 } };
            }

            case 'insert': {
                const table = String(inputs.table ?? '').trim();
                const data_input = inputs.data;
                if (!table || !data_input) throw new Error('table and data are required.');
                const dataObj = typeof data_input === 'string' ? JSON.parse(data_input) : data_input;
                const result = await sb('POST', `/rest/v1/${table}`, dataObj);
                return { output: { inserted: Array.isArray(result) ? result : [result], count: String(Array.isArray(result) ? result.length : 1) } };
            }

            case 'update': {
                const table = String(inputs.table ?? '').trim();
                const data_input = inputs.data;
                const filter = String(inputs.filter ?? '').trim();
                if (!table || !data_input || !filter) throw new Error('table, data, and filter are required.');
                const dataObj = typeof data_input === 'string' ? JSON.parse(data_input) : data_input;
                const result = await sb('PATCH', `/rest/v1/${table}?${filter}`, dataObj);
                return { output: { updated: Array.isArray(result) ? result : [], count: String(Array.isArray(result) ? result.length : 0) } };
            }

            case 'upsert': {
                const table = String(inputs.table ?? '').trim();
                const data_input = inputs.data;
                if (!table || !data_input) throw new Error('table and data are required.');
                const dataObj = typeof data_input === 'string' ? JSON.parse(data_input) : data_input;
                const result = await sb('POST', `/rest/v1/${table}`, dataObj, { Prefer: 'return=representation,resolution=merge-duplicates' });
                return { output: { upserted: Array.isArray(result) ? result : [result] } };
            }

            case 'delete': {
                const table = String(inputs.table ?? '').trim();
                const filter = String(inputs.filter ?? '').trim();
                if (!table || !filter) throw new Error('table and filter are required.');
                const result = await sb('DELETE', `/rest/v1/${table}?${filter}`);
                return { output: { deleted: Array.isArray(result) ? result : [], count: String(Array.isArray(result) ? result.length : 0) } };
            }

            case 'rpc': {
                const functionName = String(inputs.functionName ?? '').trim();
                const params = inputs.params;
                if (!functionName) throw new Error('functionName is required.');
                const paramsObj = params ? (typeof params === 'string' ? JSON.parse(params) : params) : {};
                const result = await sb('POST', `/rest/v1/rpc/${functionName}`, paramsObj);
                return { output: { result } };
            }

            case 'signUpUser': {
                const email = String(inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!email || !password) throw new Error('email and password are required.');
                const data = await sb('POST', '/auth/v1/signup', { email, password });
                return { output: { userId: data.user?.id ?? '', email: data.user?.email ?? '', accessToken: data.access_token ?? '' } };
            }

            case 'signInUser': {
                const email = String(inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!email || !password) throw new Error('email and password are required.');
                const data = await sb('POST', '/auth/v1/token?grant_type=password', { email, password });
                return { output: { userId: data.user?.id ?? '', accessToken: data.access_token ?? '', refreshToken: data.refresh_token ?? '' } };
            }

            case 'getUser': {
                const accessToken = String(inputs.accessToken ?? '').trim();
                if (!accessToken) throw new Error('accessToken is required.');
                const res = await fetch(`${projectUrl.replace(/\/$/, '')}/auth/v1/user`, {
                    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
                });
                const data = await res.json();
                return { output: { id: data.id ?? '', email: data.email ?? '', role: data.role ?? '' } };
            }

            case 'uploadFile': {
                const bucket = String(inputs.bucket ?? '').trim();
                const filePath = String(inputs.filePath ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!bucket || !filePath || !fileUrl) throw new Error('bucket, filePath, and fileUrl are required.');
                const fileRes = await fetch(fileUrl);
                const fileBlob = await fileRes.blob();
                const formData = new FormData();
                formData.append('', fileBlob, filePath.split('/').pop());
                const uploadRes = await fetch(`${projectUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${filePath}`, {
                    method: 'POST',
                    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData?.message || 'Upload failed');
                return { output: { key: uploadData.Key ?? filePath, publicUrl: `${projectUrl}/storage/v1/object/public/${bucket}/${filePath}` } };
            }

            default:
                return { error: `Supabase action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Supabase action failed.' };
    }
}
