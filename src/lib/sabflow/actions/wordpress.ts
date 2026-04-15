
'use server';

async function wpFetch(
    auth: string,
    method: string,
    url: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[WordPress] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: auth,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!res.ok) {
        throw new Error(data?.message || data?.error?.message || `WordPress API error: ${res.status}`);
    }
    return data;
}

export async function executeWordpressAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const siteUrl = String(inputs.siteUrl ?? '').trim().replace(/\/$/, '');
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        if (!siteUrl) throw new Error('siteUrl is required.');
        if (!username || !password) throw new Error('username and password are required.');

        const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
        const base = `${siteUrl}/wp-json/wp/v2`;

        const wp = (method: string, path: string, body?: any) =>
            wpFetch(auth, method, `${base}${path}`, body, logger);

        switch (actionName) {
            case 'listPosts': {
                const perPage = Number(inputs.perPage ?? 10);
                const status = String(inputs.status ?? 'publish').trim();
                const search = String(inputs.search ?? '').trim();
                let path = `/posts?per_page=${perPage}&status=${status}`;
                if (search) path += `&search=${encodeURIComponent(search)}`;
                const data = await wp('GET', path);
                const posts = Array.isArray(data) ? data : [];
                return { output: { posts, count: String(posts.length) } };
            }

            case 'getPost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const data = await wp('GET', `/posts/${postId}`);
                return { output: { id: String(data.id ?? ''), title: data.title?.rendered ?? '', status: data.status ?? '', link: data.link ?? '' } };
            }

            case 'createPost': {
                const title = String(inputs.title ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                const status = String(inputs.status ?? 'draft').trim();
                if (!title || !content) throw new Error('title and content are required.');
                const body: any = { title, content, status };
                if (inputs.excerpt) body.excerpt = String(inputs.excerpt);
                if (inputs.categoryIds) {
                    try { body.categories = typeof inputs.categoryIds === 'string' ? JSON.parse(inputs.categoryIds) : inputs.categoryIds; } catch { /* ignore */ }
                }
                if (inputs.tagIds) {
                    try { body.tags = typeof inputs.tagIds === 'string' ? JSON.parse(inputs.tagIds) : inputs.tagIds; } catch { /* ignore */ }
                }
                const data = await wp('POST', '/posts', body);
                return { output: { id: String(data.id ?? ''), title: data.title?.rendered ?? title, status: data.status ?? status, link: data.link ?? '' } };
            }

            case 'updatePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const body: any = {};
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.content) body.content = String(inputs.content);
                if (inputs.status) body.status = String(inputs.status);
                const data = await wp('POST', `/posts/${postId}`, body);
                return { output: { id: String(data.id ?? postId), title: data.title?.rendered ?? '', status: data.status ?? '', updated: 'true' } };
            }

            case 'deletePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const force = inputs.force !== undefined ? Boolean(inputs.force) : false;
                await wp('DELETE', `/posts/${postId}?force=${force}`);
                return { output: { deleted: 'true', postId } };
            }

            case 'listPages': {
                const perPage = Number(inputs.perPage ?? 10);
                const status = String(inputs.status ?? 'publish').trim();
                const data = await wp('GET', `/pages?per_page=${perPage}&status=${status}`);
                const pages = Array.isArray(data) ? data : [];
                return { output: { pages, count: String(pages.length) } };
            }

            case 'createPage': {
                const title = String(inputs.title ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                const status = String(inputs.status ?? 'draft').trim();
                if (!title || !content) throw new Error('title and content are required.');
                const body: any = { title, content, status };
                if (inputs.parentId) body.parent = Number(inputs.parentId);
                const data = await wp('POST', '/pages', body);
                return { output: { id: String(data.id ?? ''), title: data.title?.rendered ?? title, status: data.status ?? status, link: data.link ?? '' } };
            }

            case 'listCategories': {
                const data = await wp('GET', '/categories?per_page=100');
                const categories = Array.isArray(data) ? data : [];
                return { output: { categories, count: String(categories.length) } };
            }

            case 'createCategory': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.parentId) body.parent = Number(inputs.parentId);
                const data = await wp('POST', '/categories', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name, slug: data.slug ?? '' } };
            }

            case 'listTags': {
                const data = await wp('GET', '/tags?per_page=100');
                const tags = Array.isArray(data) ? data : [];
                return { output: { tags, count: String(tags.length) } };
            }

            case 'createTag': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.description) body.description = String(inputs.description);
                const data = await wp('POST', '/tags', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name, slug: data.slug ?? '' } };
            }

            case 'getMedia': {
                const mediaId = String(inputs.mediaId ?? '').trim();
                if (!mediaId) throw new Error('mediaId is required.');
                const data = await wp('GET', `/media/${mediaId}`);
                return { output: { id: String(data.id ?? ''), title: data.title?.rendered ?? '', url: data.source_url ?? '', mimeType: data.mime_type ?? '' } };
            }

            case 'uploadMedia': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file from URL: ${fileUrl}`);
                const fileBuffer = await fileRes.arrayBuffer();
                const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
                const fileName = fileUrl.split('/').pop()?.split('?')[0] || 'upload';
                const uploadHeaders: Record<string, string> = {
                    Authorization: auth,
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                    'Content-Type': contentType,
                };
                if (inputs.title) uploadHeaders['X-WP-Media-Title'] = String(inputs.title);
                const uploadRes = await fetch(`${base}/media`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: fileBuffer,
                });
                const uploadText = await uploadRes.text();
                let data: any;
                try { data = JSON.parse(uploadText); } catch { data = { message: uploadText }; }
                if (!uploadRes.ok) throw new Error(data?.message || `WordPress media upload error: ${uploadRes.status}`);
                if (inputs.altText && data.id) {
                    await wp('POST', `/media/${data.id}`, { alt_text: String(inputs.altText) });
                }
                return { output: { id: String(data.id ?? ''), url: data.source_url ?? '', title: data.title?.rendered ?? fileName } };
            }

            case 'createUser': {
                const un = String(inputs.username ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const pw = String(inputs.password ?? '').trim();
                const role = String(inputs.role ?? 'subscriber').trim();
                if (!un || !email || !pw) throw new Error('username, email, and password are required.');
                const data = await wp('POST', '/users', { username: un, email, password: pw, roles: [role] });
                return { output: { id: String(data.id ?? ''), username: data.username ?? un, email: data.email ?? email, role } };
            }

            case 'listUsers': {
                const perPage = Number(inputs.perPage ?? 20);
                let path = `/users?per_page=${perPage}`;
                if (inputs.role) path += `&roles=${encodeURIComponent(String(inputs.role))}`;
                const data = await wp('GET', path);
                const users = Array.isArray(data) ? data : [];
                return { output: { users, count: String(users.length) } };
            }

            default:
                return { error: `WordPress action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'WordPress action failed.' };
    }
}
