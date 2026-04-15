'use server';

function wpBasicAuth(username: string, appPassword: string): string {
    return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
}

async function wpFetch(
    siteUrl: string,
    authHeader: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
    const fullUrl = `${base}${path}`;
    logger?.log(`[WordpressEnhanced] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
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
    if (!res.ok) throw new Error(data?.message || `WordPress API error: ${res.status}`);
    return data;
}

export async function executeWordpressEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const siteUrl = String(inputs.siteUrl ?? '').trim();
        if (!siteUrl) throw new Error('siteUrl is required.');
        const username = String(inputs.username ?? '').trim();
        const appPassword = String(inputs.appPassword ?? '').trim();
        if (!username) throw new Error('username is required.');
        if (!appPassword) throw new Error('appPassword is required.');

        const authHeader = wpBasicAuth(username, appPassword);
        const wp = (method: string, path: string, body?: any) =>
            wpFetch(siteUrl, authHeader, method, path, body, logger);

        switch (actionName) {
            case 'listPosts': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.search) params.set('search', inputs.search);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await wp('GET', `/posts${query}`);
                return { output: { posts: Array.isArray(data) ? data : [], count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getPost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const data = await wp('GET', `/posts/${postId}`);
                return { output: data };
            }

            case 'createPost': {
                const body: any = { title: inputs.title };
                if (inputs.content !== undefined) body.content = inputs.content;
                if (inputs.status !== undefined) body.status = inputs.status;
                if (inputs.excerpt !== undefined) body.excerpt = inputs.excerpt;
                if (inputs.categories !== undefined) body.categories = inputs.categories;
                if (inputs.tags !== undefined) body.tags = inputs.tags;
                if (inputs.slug !== undefined) body.slug = inputs.slug;
                if (inputs.featuredMedia !== undefined) body.featured_media = inputs.featuredMedia;
                const data = await wp('POST', '/posts', body);
                return { output: data };
            }

            case 'updatePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const body: any = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.content !== undefined) body.content = inputs.content;
                if (inputs.status !== undefined) body.status = inputs.status;
                if (inputs.excerpt !== undefined) body.excerpt = inputs.excerpt;
                if (inputs.categories !== undefined) body.categories = inputs.categories;
                if (inputs.tags !== undefined) body.tags = inputs.tags;
                const data = await wp('POST', `/posts/${postId}`, body);
                return { output: data };
            }

            case 'deletePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const force = inputs.force ? '?force=true' : '';
                const data = await wp('DELETE', `/posts/${postId}${force}`);
                return { output: { deleted: true, postId, data } };
            }

            case 'listPages': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.status) params.set('status', inputs.status);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await wp('GET', `/pages${query}`);
                return { output: { pages: Array.isArray(data) ? data : [], count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getPage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await wp('GET', `/pages/${pageId}`);
                return { output: data };
            }

            case 'createPage': {
                const body: any = { title: inputs.title };
                if (inputs.content !== undefined) body.content = inputs.content;
                if (inputs.status !== undefined) body.status = inputs.status;
                if (inputs.slug !== undefined) body.slug = inputs.slug;
                if (inputs.parent !== undefined) body.parent = inputs.parent;
                const data = await wp('POST', '/pages', body);
                return { output: data };
            }

            case 'listMedia': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.mediaType) params.set('media_type', inputs.mediaType);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await wp('GET', `/media${query}`);
                return { output: { media: Array.isArray(data) ? data : [], count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'uploadMedia': {
                // Upload via raw binary requires multipart, but we support URL-based creation
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const fileName = String(inputs.fileName ?? 'upload').trim();
                const mimeType = String(inputs.mimeType ?? 'application/octet-stream').trim();
                if (!fileUrl) throw new Error('fileUrl is required for uploadMedia.');
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file from fileUrl: ${fileRes.status}`);
                const fileBuffer = await fileRes.arrayBuffer();
                const base = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
                const uploadRes = await fetch(`${base}/media`, {
                    method: 'POST',
                    headers: {
                        Authorization: authHeader,
                        'Content-Type': mimeType,
                        'Content-Disposition': `attachment; filename="${fileName}"`,
                    },
                    body: fileBuffer,
                });
                const uploadData = await uploadRes.json().catch(() => ({}));
                if (!uploadRes.ok) throw new Error(uploadData?.message || `WordPress media upload error: ${uploadRes.status}`);
                return { output: uploadData };
            }

            case 'listCategories': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.search) params.set('search', inputs.search);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await wp('GET', `/categories${query}`);
                return { output: { categories: Array.isArray(data) ? data : [], count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'createCategory': {
                const body: any = { name: inputs.name };
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.slug !== undefined) body.slug = inputs.slug;
                if (inputs.parent !== undefined) body.parent = inputs.parent;
                const data = await wp('POST', '/categories', body);
                return { output: data };
            }

            case 'listTags': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.search) params.set('search', inputs.search);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await wp('GET', `/tags${query}`);
                return { output: { tags: Array.isArray(data) ? data : [], count: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'createTag': {
                const body: any = { name: inputs.name };
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.slug !== undefined) body.slug = inputs.slug;
                const data = await wp('POST', '/tags', body);
                return { output: data };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.search) params.set('search', inputs.search);
                if (inputs.roles) params.set('roles', inputs.roles);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await wp('GET', `/users${query}`);
                return { output: { users: Array.isArray(data) ? data : [], count: String(Array.isArray(data) ? data.length : 0) } };
            }

            default:
                throw new Error(`Unknown WordPress Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[WordpressEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
