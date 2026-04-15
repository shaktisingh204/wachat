'use server';

function cloudinaryAdminBase(cloudName: string) {
    return `https://api.cloudinary.com/v1_1/${cloudName}`;
}

async function cloudinaryFetch(
    cloudName: string,
    apiKey: string,
    apiSecret: string,
    method: string,
    path: string,
    body?: Record<string, any>,
    logger?: any
): Promise<any> {
    const base = cloudinaryAdminBase(cloudName);
    const url = `${base}${path}`;
    logger?.log(`[Cloudinary-Enhanced] ${method} ${path}`);

    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

    const isGet = method === 'GET' || method === 'DELETE';
    let finalUrl = url;
    let fetchBody: BodyInit | undefined;
    const headers: Record<string, string> = { Authorization: authHeader };

    if (isGet && body && Object.keys(body).length > 0) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(body)) {
            if (v !== undefined && v !== null) params.set(k, String(v));
        }
        finalUrl = `${url}?${params}`;
    } else if (!isGet && body) {
        headers['Content-Type'] = 'application/json';
        fetchBody = JSON.stringify(body);
    }

    const res = await fetch(finalUrl, { method, headers, body: fetchBody });

    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
    return data;
}

async function cloudinaryUpload(
    cloudName: string,
    apiKey: string,
    apiSecret: string,
    resourceType: string,
    params: Record<string, any>,
    logger?: any
): Promise<any> {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
    logger?.log(`[Cloudinary-Enhanced] POST /${resourceType}/upload`);

    const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

    const form = new FormData();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) form.append(k, String(v));
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: form,
    });

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
}

export async function executeCloudinaryEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const cloudName: string = inputs.cloudName;
        const apiKey: string = inputs.apiKey;
        const apiSecret: string = inputs.apiSecret;

        switch (actionName) {
            case 'uploadImage': {
                const data = await cloudinaryUpload(cloudName, apiKey, apiSecret, 'image', {
                    file: inputs.file,
                    public_id: inputs.publicId,
                    folder: inputs.folder,
                    tags: Array.isArray(inputs.tags) ? inputs.tags.join(',') : inputs.tags,
                    transformation: inputs.transformation,
                    overwrite: inputs.overwrite,
                    upload_preset: inputs.uploadPreset,
                }, logger);
                return { output: data };
            }

            case 'uploadVideo': {
                const data = await cloudinaryUpload(cloudName, apiKey, apiSecret, 'video', {
                    file: inputs.file,
                    public_id: inputs.publicId,
                    folder: inputs.folder,
                    tags: Array.isArray(inputs.tags) ? inputs.tags.join(',') : inputs.tags,
                    overwrite: inputs.overwrite,
                    upload_preset: inputs.uploadPreset,
                }, logger);
                return { output: data };
            }

            case 'uploadRaw': {
                const data = await cloudinaryUpload(cloudName, apiKey, apiSecret, 'raw', {
                    file: inputs.file,
                    public_id: inputs.publicId,
                    folder: inputs.folder,
                    overwrite: inputs.overwrite,
                }, logger);
                return { output: data };
            }

            case 'getResource': {
                const resourceType = inputs.resourceType ?? 'image';
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'GET', `/resources/${resourceType}/upload/${inputs.publicId}`, undefined, logger);
                return { output: data };
            }

            case 'listResources': {
                const resourceType = inputs.resourceType ?? 'image';
                const queryParams: Record<string, any> = {};
                if (inputs.maxResults) queryParams.max_results = inputs.maxResults;
                if (inputs.nextCursor) queryParams.next_cursor = inputs.nextCursor;
                if (inputs.prefix) queryParams.prefix = inputs.prefix;
                if (inputs.type) queryParams.type = inputs.type;
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'GET', `/resources/${resourceType}`, queryParams, logger);
                return { output: data };
            }

            case 'listResourcesByTag': {
                const resourceType = inputs.resourceType ?? 'image';
                const queryParams: Record<string, any> = {};
                if (inputs.maxResults) queryParams.max_results = inputs.maxResults;
                if (inputs.nextCursor) queryParams.next_cursor = inputs.nextCursor;
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'GET', `/resources/${resourceType}/tags/${inputs.tag}`, queryParams, logger);
                return { output: data };
            }

            case 'deleteResource': {
                const resourceType = inputs.resourceType ?? 'image';
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'DELETE', `/resources/${resourceType}/upload`, {
                    public_ids: Array.isArray(inputs.publicIds) ? inputs.publicIds.join(',') : inputs.publicIds,
                }, logger);
                return { output: data };
            }

            case 'renameResource': {
                const resourceType = inputs.resourceType ?? 'image';
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'POST', `/resources/${resourceType}/upload/${inputs.fromPublicId}/rename`, {
                    to_public_id: inputs.toPublicId,
                    overwrite: inputs.overwrite ?? false,
                }, logger);
                return { output: data };
            }

            case 'addTag': {
                const resourceType = inputs.resourceType ?? 'image';
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'POST', `/resources/${resourceType}/tags`, {
                    public_ids: inputs.publicIds,
                    tag: inputs.tag,
                    command: 'add',
                }, logger);
                return { output: data };
            }

            case 'removeTag': {
                const resourceType = inputs.resourceType ?? 'image';
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'POST', `/resources/${resourceType}/tags`, {
                    public_ids: inputs.publicIds,
                    tag: inputs.tag,
                    command: 'remove',
                }, logger);
                return { output: data };
            }

            case 'listTags': {
                const resourceType = inputs.resourceType ?? 'image';
                const queryParams: Record<string, any> = {};
                if (inputs.prefix) queryParams.prefix = inputs.prefix;
                if (inputs.maxResults) queryParams.max_results = inputs.maxResults;
                if (inputs.nextCursor) queryParams.next_cursor = inputs.nextCursor;
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'GET', `/tags/${resourceType}`, queryParams, logger);
                return { output: data };
            }

            case 'createTransformation': {
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'POST', `/transformations/${inputs.transformationName}`, {
                    transformation: inputs.transformation,
                    allowed_for_strict: inputs.allowedForStrict ?? false,
                }, logger);
                return { output: data };
            }

            case 'deleteTransformation': {
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'DELETE', `/transformations/${inputs.transformationName}`, undefined, logger);
                return { output: data };
            }

            case 'getUsage': {
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'GET', '/usage', undefined, logger);
                return { output: data };
            }

            case 'searchResources': {
                const data = await cloudinaryFetch(cloudName, apiKey, apiSecret, 'POST', '/resources/search', {
                    expression: inputs.expression,
                    max_results: inputs.maxResults ?? 10,
                    next_cursor: inputs.nextCursor,
                    sort_by: inputs.sortBy,
                    with_field: inputs.withField,
                }, logger);
                return { output: data };
            }

            default:
                return { error: `Cloudinary Enhanced action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger?.log(`[Cloudinary-Enhanced] Error: ${err.message}`);
        return { error: err.message || 'Unknown error from Cloudinary' };
    }
}
