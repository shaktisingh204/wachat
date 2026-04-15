'use server';

import { createHmac } from 'crypto';

function buildGhostAdminJwt(adminApiKey: string): string {
    const parts = adminApiKey.split(':');
    if (parts.length < 2) throw new Error('adminApiKey must be in format id:hexSecret');
    const keyId = parts[0];
    const hexSecret = parts[1];

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: keyId, typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
    const signingInput = `${header}.${payload}`;
    const secret = Buffer.from(hexSecret, 'hex');
    const sig = createHmac('sha256', secret).update(signingInput).digest('base64url');
    return `${signingInput}.${sig}`;
}

async function ghostContentFetch(
    url: string,
    contentApiKey: string,
    method: string,
    path: string,
    params?: Record<string, string>,
    logger?: any
): Promise<any> {
    const base = `${url.replace(/\/$/, '')}/ghost/api/content`;
    const searchParams = new URLSearchParams({ key: contentApiKey, ...(params ?? {}) });
    const fullUrl = `${base}${path}?${searchParams.toString()}`;
    logger?.log(`[GhostCMS Content] ${method} ${path}`);
    const res = await fetch(fullUrl, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Ghost Content API error: ${res.status}`);
    return data;
}

async function ghostAdminFetch(
    url: string,
    adminApiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = `${url.replace(/\/$/, '')}/ghost/api/admin`;
    const fullUrl = `${base}${path}`;
    logger?.log(`[GhostCMS Admin] ${method} ${path}`);
    const jwt = buildGhostAdminJwt(adminApiKey);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Ghost ${jwt}`,
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
    if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Ghost Admin API error: ${res.status}`);
    return data;
}

export async function executeGhostCmsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const siteUrl = String(inputs.url ?? inputs.siteUrl ?? '').trim();
        if (!siteUrl) throw new Error('url (site URL) is required.');

        const contentKey = String(inputs.contentApiKey ?? '').trim();
        const adminKey = String(inputs.adminApiKey ?? '').trim();

        const content = (path: string, params?: Record<string, string>) =>
            ghostContentFetch(siteUrl, contentKey, 'GET', path, params, logger);
        const adminGet = (path: string) =>
            ghostAdminFetch(siteUrl, adminKey, 'GET', path, undefined, logger);
        const adminPost = (path: string, body: any) =>
            ghostAdminFetch(siteUrl, adminKey, 'POST', path, body, logger);
        const adminPut = (path: string, body: any) =>
            ghostAdminFetch(siteUrl, adminKey, 'PUT', path, body, logger);
        const adminDelete = (path: string) =>
            ghostAdminFetch(siteUrl, adminKey, 'DELETE', path, undefined, logger);

        switch (actionName) {
            case 'listPosts': {
                if (!contentKey) throw new Error('contentApiKey is required.');
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.filter) params.filter = inputs.filter;
                const data = await content('/posts/', params);
                return { output: { posts: data.posts ?? [], meta: data.meta ?? {} } };
            }

            case 'getPost': {
                if (!contentKey) throw new Error('contentApiKey is required.');
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const data = await content(`/posts/${postId}/`);
                return { output: { post: (data.posts ?? [])[0] ?? data } };
            }

            case 'createPost': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const post: any = { title: inputs.title };
                if (inputs.html !== undefined) post.html = inputs.html;
                if (inputs.lexical !== undefined) post.lexical = inputs.lexical;
                if (inputs.status !== undefined) post.status = inputs.status;
                if (inputs.tags !== undefined) post.tags = inputs.tags;
                if (inputs.slug !== undefined) post.slug = inputs.slug;
                if (inputs.featured !== undefined) post.featured = inputs.featured;
                const data = await adminPost('/posts/', { posts: [post] });
                return { output: { post: (data.posts ?? [])[0] ?? data } };
            }

            case 'updatePost': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                // Ghost requires updated_at for optimistic locking
                const existing = await adminGet(`/posts/${postId}/`);
                const existingPost = (existing.posts ?? [])[0] ?? {};
                const updates: any = { updated_at: existingPost.updated_at };
                if (inputs.title !== undefined) updates.title = inputs.title;
                if (inputs.html !== undefined) updates.html = inputs.html;
                if (inputs.status !== undefined) updates.status = inputs.status;
                if (inputs.tags !== undefined) updates.tags = inputs.tags;
                if (inputs.featured !== undefined) updates.featured = inputs.featured;
                const data = await adminPut(`/posts/${postId}/`, { posts: [updates] });
                return { output: { post: (data.posts ?? [])[0] ?? data } };
            }

            case 'deletePost': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                await adminDelete(`/posts/${postId}/`);
                return { output: { deleted: true, postId } };
            }

            case 'listPages': {
                if (!contentKey) throw new Error('contentApiKey is required.');
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                if (inputs.page) params.page = String(inputs.page);
                const data = await content('/pages/', params);
                return { output: { pages: data.pages ?? [], meta: data.meta ?? {} } };
            }

            case 'getPage': {
                if (!contentKey) throw new Error('contentApiKey is required.');
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const data = await content(`/pages/${pageId}/`);
                return { output: { page: (data.pages ?? [])[0] ?? data } };
            }

            case 'createPage': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const page: any = { title: inputs.title };
                if (inputs.html !== undefined) page.html = inputs.html;
                if (inputs.status !== undefined) page.status = inputs.status;
                if (inputs.slug !== undefined) page.slug = inputs.slug;
                const data = await adminPost('/pages/', { pages: [page] });
                return { output: { page: (data.pages ?? [])[0] ?? data } };
            }

            case 'updatePage': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const existing = await adminGet(`/pages/${pageId}/`);
                const existingPage = (existing.pages ?? [])[0] ?? {};
                const updates: any = { updated_at: existingPage.updated_at };
                if (inputs.title !== undefined) updates.title = inputs.title;
                if (inputs.html !== undefined) updates.html = inputs.html;
                if (inputs.status !== undefined) updates.status = inputs.status;
                const data = await adminPut(`/pages/${pageId}/`, { pages: [updates] });
                return { output: { page: (data.pages ?? [])[0] ?? data } };
            }

            case 'deletePage': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                await adminDelete(`/pages/${pageId}/`);
                return { output: { deleted: true, pageId } };
            }

            case 'listTags': {
                if (!contentKey) throw new Error('contentApiKey is required.');
                const params: Record<string, string> = {};
                if (inputs.limit) params.limit = String(inputs.limit);
                const data = await content('/tags/', params);
                return { output: { tags: data.tags ?? [], meta: data.meta ?? {} } };
            }

            case 'createTag': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const tag: any = { name: inputs.name };
                if (inputs.description !== undefined) tag.description = inputs.description;
                if (inputs.slug !== undefined) tag.slug = inputs.slug;
                const data = await adminPost('/tags/', { tags: [tag] });
                return { output: { tag: (data.tags ?? [])[0] ?? data } };
            }

            case 'listMembers': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const data = await adminGet('/members/?limit=' + (inputs.limit ?? 15));
                return { output: { members: data.members ?? [], meta: data.meta ?? {} } };
            }

            case 'createMember': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const member: any = { email: inputs.email };
                if (inputs.name !== undefined) member.name = inputs.name;
                if (inputs.note !== undefined) member.note = inputs.note;
                if (inputs.labels !== undefined) member.labels = inputs.labels;
                if (inputs.subscribed !== undefined) member.subscribed = inputs.subscribed;
                const data = await adminPost('/members/', { members: [member] });
                return { output: { member: (data.members ?? [])[0] ?? data } };
            }

            case 'updateMember': {
                if (!adminKey) throw new Error('adminApiKey is required.');
                const memberId = String(inputs.memberId ?? '').trim();
                if (!memberId) throw new Error('memberId is required.');
                const updates: any = {};
                if (inputs.name !== undefined) updates.name = inputs.name;
                if (inputs.email !== undefined) updates.email = inputs.email;
                if (inputs.note !== undefined) updates.note = inputs.note;
                if (inputs.labels !== undefined) updates.labels = inputs.labels;
                if (inputs.subscribed !== undefined) updates.subscribed = inputs.subscribed;
                const data = await adminPut(`/members/${memberId}/`, { members: [updates] });
                return { output: { member: (data.members ?? [])[0] ?? data } };
            }

            default:
                throw new Error(`Unknown Ghost CMS action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[GhostCMS] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
