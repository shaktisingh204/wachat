
'use server';

async function ghostFetch(
    authHeader: string,
    method: string,
    url: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Ghost] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Version': 'v5.0',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    let data: any;
    try { data = JSON.parse(text); } catch { data = { errors: [{ message: text }] }; }
    if (!res.ok) {
        const errMsg = data?.errors?.[0]?.message || data?.message || `Ghost API error: ${res.status}`;
        throw new Error(errMsg);
    }
    return data;
}

/**
 * Build a Ghost Admin API JWT token from an Admin API Key (id:secret format).
 * Uses the Web Crypto API (available in both Node.js 18+ and Edge runtimes).
 */
async function buildGhostJwt(adminApiKey: string): Promise<string> {
    const [id, secret] = adminApiKey.split(':');
    if (!id || !secret) throw new Error('adminApiKey must be in "id:secret" format.');
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT', kid: id };
    const payload = { iat: now, exp: now + 300, aud: '/admin/' };
    const encode = (obj: object) =>
        Buffer.from(JSON.stringify(obj)).toString('base64url');
    const headerB64 = encode(header);
    const payloadB64 = encode(payload);
    const signingInput = `${headerB64}.${payloadB64}`;
    const secretBytes = Buffer.from(secret, 'hex');
    const key = await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, Buffer.from(signingInput));
    const sigB64 = Buffer.from(signature).toString('base64url');
    return `${signingInput}.${sigB64}`;
}

async function buildAuthHeader(inputs: any): Promise<string> {
    if (inputs.staffToken) return `Ghost ${String(inputs.staffToken).trim()}`;
    if (inputs.adminApiKey) {
        const jwt = await buildGhostJwt(String(inputs.adminApiKey).trim());
        return `Ghost ${jwt}`;
    }
    throw new Error('staffToken or adminApiKey is required.');
}

export async function executeGhostAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const adminUrl = String(inputs.adminUrl ?? '').trim().replace(/\/$/, '');
        if (!adminUrl) throw new Error('adminUrl is required.');

        const authHeader = await buildAuthHeader(inputs);
        const base = `${adminUrl}/ghost/api/admin`;

        const gh = (method: string, path: string, body?: any) =>
            ghostFetch(authHeader, method, `${base}${path}`, body, logger);

        switch (actionName) {
            case 'listPosts': {
                const limit = Number(inputs.limit ?? 15);
                const page = Number(inputs.page ?? 1);
                let path = `/posts/?limit=${limit}&page=${page}`;
                if (inputs.status) path += `&status=${encodeURIComponent(String(inputs.status))}`;
                if (inputs.tag) path += `&filter=${encodeURIComponent(`tag:${String(inputs.tag)}`)}`;
                const data = await gh('GET', path);
                return { output: { posts: data.posts ?? [], meta: data.meta ?? {} } };
            }

            case 'getPost': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await gh('GET', `/posts/${id}/?formats=html,mobiledoc`);
                return { output: { post: data.posts?.[0] ?? data.post ?? {} } };
            }

            case 'createPost': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const post: any = { title };
                if (inputs.html) post.html = String(inputs.html);
                if (inputs.status) post.status = String(inputs.status);
                if (inputs.excerpt) post.custom_excerpt = String(inputs.excerpt);
                if (inputs.tags) {
                    const tagsRaw = typeof inputs.tags === 'string' ? JSON.parse(inputs.tags) : inputs.tags;
                    post.tags = Array.isArray(tagsRaw)
                        ? tagsRaw.map((t: any) => (typeof t === 'string' ? { name: t } : t))
                        : [];
                }
                const data = await gh('POST', '/posts/', { posts: [post] });
                const created = data.posts?.[0] ?? {};
                return { output: { post: { id: created.id ?? '', url: created.url ?? '', status: created.status ?? '' } } };
            }

            case 'updatePost': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                // Must fetch updated_at first
                const existing = await gh('GET', `/posts/${id}/`);
                const existingPost = existing.posts?.[0] ?? {};
                const updatedAt = existingPost.updated_at;
                if (!updatedAt) throw new Error('Could not retrieve updated_at for the post.');
                const update: any = { updated_at: updatedAt };
                if (inputs.title) update.title = String(inputs.title);
                if (inputs.html) update.html = String(inputs.html);
                if (inputs.status) update.status = String(inputs.status);
                if (inputs.tags) {
                    const tagsRaw = typeof inputs.tags === 'string' ? JSON.parse(inputs.tags) : inputs.tags;
                    update.tags = Array.isArray(tagsRaw)
                        ? tagsRaw.map((t: any) => (typeof t === 'string' ? { name: t } : t))
                        : [];
                }
                const data = await gh('PUT', `/posts/${id}/`, { posts: [update] });
                const updated = data.posts?.[0] ?? {};
                return { output: { post: { id: updated.id ?? id } } };
            }

            case 'deletePost': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await gh('DELETE', `/posts/${id}/`);
                return { output: { deleted: 'true', id } };
            }

            case 'listPages': {
                const limit = Number(inputs.limit ?? 15);
                const page = Number(inputs.page ?? 1);
                const data = await gh('GET', `/pages/?limit=${limit}&page=${page}`);
                return { output: { pages: data.pages ?? [], meta: data.meta ?? {} } };
            }

            case 'createPage': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const page: any = { title };
                if (inputs.html) page.html = String(inputs.html);
                if (inputs.status) page.status = String(inputs.status);
                const data = await gh('POST', '/pages/', { posts: [page] });
                const created = data.pages?.[0] ?? data.posts?.[0] ?? {};
                return { output: { page: { id: created.id ?? '', url: created.url ?? '' } } };
            }

            case 'listMembers': {
                const limit = Number(inputs.limit ?? 15);
                const page = Number(inputs.page ?? 1);
                let path = `/members/?limit=${limit}&page=${page}`;
                if (inputs.label) path += `&filter=${encodeURIComponent(`label:${String(inputs.label)}`)}`;
                const data = await gh('GET', path);
                return { output: { members: data.members ?? [], meta: data.meta ?? {} } };
            }

            case 'createMember': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const member: any = { email };
                if (inputs.name) member.name = String(inputs.name);
                if (inputs.note) member.note = String(inputs.note);
                const data = await gh('POST', '/members/', { members: [member] });
                const created = data.members?.[0] ?? {};
                return { output: { member: { id: created.id ?? '', email: created.email ?? email } } };
            }

            case 'updateMember': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const update: any = {};
                if (inputs.name) update.name = String(inputs.name);
                if (inputs.note) update.note = String(inputs.note);
                if (inputs.labels) {
                    const labelsRaw = typeof inputs.labels === 'string' ? JSON.parse(inputs.labels) : inputs.labels;
                    update.labels = Array.isArray(labelsRaw)
                        ? labelsRaw.map((l: any) => (typeof l === 'string' ? { name: l } : l))
                        : [];
                }
                const data = await gh('PUT', `/members/${id}/`, { members: [update] });
                const updated = data.members?.[0] ?? {};
                return { output: { member: { id: updated.id ?? id } } };
            }

            case 'deleteMember': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await gh('DELETE', `/members/${id}/`);
                return { output: { deleted: 'true', id } };
            }

            case 'listTags': {
                const data = await gh('GET', '/tags/?limit=all');
                return { output: { tags: data.tags ?? [], meta: data.meta ?? {} } };
            }

            case 'createTag': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const tag: any = { name };
                if (inputs.slug) tag.slug = String(inputs.slug);
                if (inputs.description) tag.description = String(inputs.description);
                const data = await gh('POST', '/tags/', { tags: [tag] });
                const created = data.tags?.[0] ?? {};
                return { output: { tag: { id: created.id ?? '', name: created.name ?? name } } };
            }

            default:
                return { error: `Ghost action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Ghost action failed.' };
    }
}
