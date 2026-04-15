
'use server';

async function strapiFetch(
    token: string,
    method: string,
    url: string,
    body?: any,
    isMultipart?: boolean,
    logger?: any
) {
    logger?.log(`[Strapi] ${method} ${url}`);
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
    };
    if (!isMultipart && body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const options: RequestInit = { method, headers };
    if (body !== undefined) {
        options.body = isMultipart ? body : JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: { message: text } }; }
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `Strapi API error: ${res.status}`);
    }
    return data;
}

function buildQS(obj: Record<string, any>, prefix = ''): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null || value === '') continue;
        const fullKey = prefix ? `${prefix}[${key}]` : key;
        if (typeof value === 'object' && !Array.isArray(value)) {
            const nested = buildQS(value, fullKey);
            if (nested) parts.push(nested);
        } else if (Array.isArray(value)) {
            value.forEach((v, i) => {
                parts.push(`${fullKey}[${i}]=${encodeURIComponent(String(v))}`);
            });
        } else {
            parts.push(`${fullKey}=${encodeURIComponent(String(value))}`);
        }
    }
    return parts.join('&');
}

export async function executeStrapiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required.');
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');

        const base = `${serverUrl}/api`;
        const st = (method: string, path: string, body?: any) =>
            strapiFetch(apiToken, method, `${base}${path}`, body, false, logger);

        switch (actionName) {
            case 'listEntries': {
                const contentType = String(inputs.contentType ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                const qsParts: string[] = ['populate=*'];
                const extraParams: Record<string, any> = {};
                if (inputs.filters) {
                    const f = typeof inputs.filters === 'string' ? JSON.parse(inputs.filters) : inputs.filters;
                    extraParams['filters'] = f;
                }
                if (inputs.sort) extraParams['sort'] = inputs.sort;
                if (inputs.pagination) {
                    const p = typeof inputs.pagination === 'string' ? JSON.parse(inputs.pagination) : inputs.pagination;
                    extraParams['pagination'] = p;
                }
                const extra = buildQS(extraParams);
                if (extra) qsParts.push(extra);
                const data = await st('GET', `/${contentType}?${qsParts.join('&')}`);
                return { output: { data: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'getEntry': {
                const contentType = String(inputs.contentType ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!id) throw new Error('id is required.');
                const data = await st('GET', `/${contentType}/${id}?populate=*`);
                return { output: { data: data.data ?? {} } };
            }

            case 'createEntry': {
                const contentType = String(inputs.contentType ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!inputs.data) throw new Error('data is required.');
                const entryData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await st('POST', `/${contentType}`, { data: entryData });
                return { output: { data: data.data ?? {} } };
            }

            case 'updateEntry': {
                const contentType = String(inputs.contentType ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!id) throw new Error('id is required.');
                if (!inputs.data) throw new Error('data is required.');
                const entryData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const data = await st('PUT', `/${contentType}/${id}`, { data: entryData });
                return { output: { data: data.data ?? {} } };
            }

            case 'deleteEntry': {
                const contentType = String(inputs.contentType ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!id) throw new Error('id is required.');
                const data = await st('DELETE', `/${contentType}/${id}`);
                return { output: { data: data.data ?? { id } } };
            }

            case 'listContentTypes': {
                // Return a placeholder — Strapi v4 content-type discovery requires admin token
                return { output: { contentTypes: [], note: 'Content type discovery requires an admin API token via /api/_meta/content-types' } };
            }

            case 'uploadMedia': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const filename = String(inputs.filename ?? '').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file from URL: ${fileUrl}`);
                const fileBuffer = await fileRes.arrayBuffer();
                const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
                const resolvedName = filename || fileUrl.split('/').pop()?.split('?')[0] || 'upload';
                const formData = new FormData();
                formData.append('files', new Blob([fileBuffer], { type: contentType }), resolvedName);
                if (inputs.caption) {
                    formData.append('fileInfo', JSON.stringify({ caption: String(inputs.caption) }));
                }
                const uploadRes = await fetch(`${base}/upload`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiToken}` },
                    body: formData,
                });
                const text = await uploadRes.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { error: { message: text } }; }
                if (!uploadRes.ok) throw new Error(data?.error?.message || `Strapi upload error: ${uploadRes.status}`);
                const file = Array.isArray(data) ? data[0] : data;
                return { output: { id: String(file?.id ?? ''), url: file?.url ?? '', name: file?.name ?? resolvedName } };
            }

            case 'listMedia': {
                const data = await st('GET', '/upload/files');
                const files = Array.isArray(data) ? data : (data.data ?? []);
                return { output: { files, count: String(files.length) } };
            }

            case 'deleteMedia': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await st('DELETE', `/upload/files/${id}`);
                return { output: { deleted: 'true', id } };
            }

            case 'searchEntries': {
                const contentType = String(inputs.contentType ?? '').trim();
                const query = String(inputs.query ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!query) throw new Error('query is required.');
                const qs = `filters[$or][0][title][$containsi]=${encodeURIComponent(query)}&populate=*`;
                const data = await st('GET', `/${contentType}?${qs}`);
                return { output: { data: data.data ?? [] } };
            }

            case 'publishEntry': {
                const contentType = String(inputs.contentType ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!id) throw new Error('id is required.');
                const data = await st('PUT', `/${contentType}/${id}`, { data: { publishedAt: new Date().toISOString() } });
                return { output: { data: data.data ?? { id } } };
            }

            case 'unpublishEntry': {
                const contentType = String(inputs.contentType ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!id) throw new Error('id is required.');
                const data = await st('PUT', `/${contentType}/${id}`, { data: { publishedAt: null } });
                return { output: { data: data.data ?? { id } } };
            }

            default:
                return { error: `Strapi action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Strapi action failed.' };
    }
}
