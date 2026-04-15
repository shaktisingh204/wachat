'use server';

async function strapiFetch(
    baseUrl: string,
    apiToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = `${baseUrl.replace(/\/$/, '')}/api`;
    const fullUrl = `${base}${path}`;
    logger?.log(`[StrapiEnhanced] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(fullUrl, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `Strapi API error: ${res.status}`);
    return data;
}

export async function executeStrapienHancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').trim();
        if (!baseUrl) throw new Error('baseUrl is required.');
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');

        const strapi = (method: string, path: string, body?: any) =>
            strapiFetch(baseUrl, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'findMany': {
                const contentType = String(inputs.contentType ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                const params = new URLSearchParams();
                if (inputs.pagination?.page) params.set('pagination[page]', String(inputs.pagination.page));
                if (inputs.pagination?.pageSize) params.set('pagination[pageSize]', String(inputs.pagination.pageSize));
                if (inputs.populate) params.set('populate', inputs.populate);
                if (inputs.sort) params.set('sort', inputs.sort);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await strapi('GET', `/${contentType}${query}`);
                return { output: { data: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'findOne': {
                const contentType = String(inputs.contentType ?? '').trim();
                const documentId = String(inputs.documentId ?? inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!documentId) throw new Error('documentId is required.');
                const populate = inputs.populate ? `?populate=${inputs.populate}` : '';
                const data = await strapi('GET', `/${contentType}/${documentId}${populate}`);
                return { output: { data: data.data ?? data } };
            }

            case 'create': {
                const contentType = String(inputs.contentType ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                const attributes = inputs.attributes ?? inputs.data ?? {};
                const data = await strapi('POST', `/${contentType}`, { data: attributes });
                return { output: { data: data.data ?? data } };
            }

            case 'update': {
                const contentType = String(inputs.contentType ?? '').trim();
                const documentId = String(inputs.documentId ?? inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!documentId) throw new Error('documentId is required.');
                const attributes = inputs.attributes ?? inputs.data ?? {};
                const data = await strapi('PUT', `/${contentType}/${documentId}`, { data: attributes });
                return { output: { data: data.data ?? data } };
            }

            case 'delete': {
                const contentType = String(inputs.contentType ?? '').trim();
                const documentId = String(inputs.documentId ?? inputs.id ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                if (!documentId) throw new Error('documentId is required.');
                await strapi('DELETE', `/${contentType}/${documentId}`);
                return { output: { deleted: true, documentId } };
            }

            case 'findWithFilters': {
                const contentType = String(inputs.contentType ?? '').trim();
                if (!contentType) throw new Error('contentType is required.');
                const filters = inputs.filters ?? {};
                const params = new URLSearchParams();
                // Encode flat filters as filters[field][$eq]=value
                for (const [key, val] of Object.entries(filters)) {
                    params.set(`filters[${key}][$eq]`, String(val));
                }
                if (inputs.pagination?.page) params.set('pagination[page]', String(inputs.pagination.page));
                if (inputs.pagination?.pageSize) params.set('pagination[pageSize]', String(inputs.pagination.pageSize));
                if (inputs.populate) params.set('populate', inputs.populate);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await strapi('GET', `/${contentType}${query}`);
                return { output: { data: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'uploadMedia': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const fileName = String(inputs.fileName ?? 'upload').trim();
                const mimeType = String(inputs.mimeType ?? 'application/octet-stream').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file from fileUrl: ${fileRes.status}`);
                const fileBuffer = await fileRes.arrayBuffer();
                const boundary = `----SabFlowBoundary${Date.now()}`;
                const bodyParts: Uint8Array[] = [];
                const enc = new TextEncoder();
                bodyParts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
                bodyParts.push(new Uint8Array(fileBuffer));
                bodyParts.push(enc.encode(`\r\n--${boundary}--\r\n`));
                const totalLength = bodyParts.reduce((s, b) => s + b.length, 0);
                const combined = new Uint8Array(totalLength);
                let offset = 0;
                for (const part of bodyParts) { combined.set(part, offset); offset += part.length; }
                const uploadRes = await fetch(`${baseUrl.replace(/\/$/, '')}/api/upload`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiToken}`,
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    },
                    body: combined,
                });
                const uploadData = await uploadRes.json().catch(() => ({}));
                if (!uploadRes.ok) throw new Error(uploadData?.error?.message || `Strapi upload error: ${uploadRes.status}`);
                return { output: { files: Array.isArray(uploadData) ? uploadData : [uploadData] } };
            }

            case 'listMedia': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pagination[pageSize]', String(inputs.pageSize));
                if (inputs.page) params.set('pagination[page]', String(inputs.page));
                if (inputs.mimeType) params.set('filters[mime][$containsi]', inputs.mimeType);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await strapi('GET', `/upload/files${query}`);
                return { output: { files: Array.isArray(data) ? data : data.results ?? [], count: String(Array.isArray(data) ? data.length : (data.pagination?.total ?? 0)) } };
            }

            case 'deleteMedia': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                await strapi('DELETE', `/upload/files/${fileId}`);
                return { output: { deleted: true, fileId } };
            }

            case 'getSettings': {
                const data = await strapi('GET', '/config/application');
                return { output: data };
            }

            case 'listContentTypes': {
                const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/content-type-builder/content-types`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = {}; }
                return { output: { contentTypes: data.data ?? [] } };
            }

            case 'createUser': {
                const body: any = {
                    username: inputs.username,
                    email: inputs.email,
                    password: inputs.password,
                };
                if (inputs.role !== undefined) body.role = inputs.role;
                if (inputs.confirmed !== undefined) body.confirmed = inputs.confirmed;
                if (inputs.blocked !== undefined) body.blocked = inputs.blocked;
                const data = await strapi('POST', '/users', body);
                return { output: data };
            }

            case 'updateUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const body: any = {};
                if (inputs.username !== undefined) body.username = inputs.username;
                if (inputs.email !== undefined) body.email = inputs.email;
                if (inputs.password !== undefined) body.password = inputs.password;
                if (inputs.role !== undefined) body.role = inputs.role;
                if (inputs.confirmed !== undefined) body.confirmed = inputs.confirmed;
                if (inputs.blocked !== undefined) body.blocked = inputs.blocked;
                const data = await strapi('PUT', `/users/${userId}`, body);
                return { output: data };
            }

            case 'deleteUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                await strapi('DELETE', `/users/${userId}`);
                return { output: { deleted: true, userId } };
            }

            case 'listRoles': {
                const data = await strapi('GET', '/users-permissions/roles');
                return { output: { roles: data.roles ?? [] } };
            }

            default:
                throw new Error(`Unknown Strapi Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[StrapiEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
