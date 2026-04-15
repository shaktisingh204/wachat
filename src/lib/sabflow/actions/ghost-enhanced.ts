'use server';

import { createHmac } from 'crypto';

function buildGhostAdminJwt(adminApiKey: string): string {
    const [id, secret] = adminApiKey.split(':');
    if (!id || !secret) throw new Error('Invalid adminApiKey format. Expected id:secret');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
    const sig = createHmac('sha256', Buffer.from(secret, 'hex'))
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${sig}`;
}

export async function executeGhostEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const domain: string = inputs.domain;
        const adminApiKey: string = inputs.adminApiKey;
        if (!domain) return { error: 'inputs.domain is required' };
        if (!adminApiKey) return { error: 'inputs.adminApiKey is required' };

        const BASE = `https://${domain}/ghost/api/admin`;
        const token = buildGhostAdminJwt(adminApiKey);
        const headers: Record<string, string> = {
            'Authorization': `Ghost ${token}`,
            'Content-Type': 'application/json',
            'Accept-Version': 'v5.0',
        };

        async function req(method: string, path: string, body?: any) {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers,
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) return { error: data?.errors?.[0]?.message || `HTTP ${res.status}` };
            return { output: data };
        }

        switch (actionName) {
            case 'listPosts': {
                const limit = inputs.limit || 15;
                const page = inputs.page || 1;
                const status = inputs.status || 'all';
                return req('GET', `/posts/?limit=${limit}&page=${page}&status=${status}&formats=html,mobiledoc`);
            }
            case 'getPost': {
                if (!inputs.postId) return { error: 'inputs.postId is required' };
                return req('GET', `/posts/${inputs.postId}/?formats=html,mobiledoc`);
            }
            case 'createPost': {
                if (!inputs.title) return { error: 'inputs.title is required' };
                const body: any = { title: inputs.title };
                if (inputs.html) body.html = inputs.html;
                if (inputs.status) body.status = inputs.status;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.authors) body.authors = inputs.authors;
                if (inputs.slug) body.slug = inputs.slug;
                if (inputs.excerpt) body.custom_excerpt = inputs.excerpt;
                return req('POST', '/posts/', { posts: [body] });
            }
            case 'updatePost': {
                if (!inputs.postId) return { error: 'inputs.postId is required' };
                if (!inputs.updatedAt) return { error: 'inputs.updatedAt is required (ISO string from existing post)' };
                const body: any = { updated_at: inputs.updatedAt };
                if (inputs.title) body.title = inputs.title;
                if (inputs.html) body.html = inputs.html;
                if (inputs.status) body.status = inputs.status;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.slug) body.slug = inputs.slug;
                return req('PUT', `/posts/${inputs.postId}/`, { posts: [body] });
            }
            case 'deletePost': {
                if (!inputs.postId) return { error: 'inputs.postId is required' };
                return req('DELETE', `/posts/${inputs.postId}/`);
            }
            case 'publishPost': {
                if (!inputs.postId) return { error: 'inputs.postId is required' };
                if (!inputs.updatedAt) return { error: 'inputs.updatedAt is required' };
                return req('PUT', `/posts/${inputs.postId}/`, { posts: [{ status: 'published', updated_at: inputs.updatedAt }] });
            }
            case 'listPages': {
                const limit = inputs.limit || 15;
                const page = inputs.page || 1;
                return req('GET', `/pages/?limit=${limit}&page=${page}&formats=html,mobiledoc`);
            }
            case 'getPage': {
                if (!inputs.pageId) return { error: 'inputs.pageId is required' };
                return req('GET', `/pages/${inputs.pageId}/?formats=html,mobiledoc`);
            }
            case 'createPage': {
                if (!inputs.title) return { error: 'inputs.title is required' };
                const body: any = { title: inputs.title };
                if (inputs.html) body.html = inputs.html;
                if (inputs.status) body.status = inputs.status;
                if (inputs.slug) body.slug = inputs.slug;
                return req('POST', '/pages/', { pages: [body] });
            }
            case 'updatePage': {
                if (!inputs.pageId) return { error: 'inputs.pageId is required' };
                if (!inputs.updatedAt) return { error: 'inputs.updatedAt is required' };
                const body: any = { updated_at: inputs.updatedAt };
                if (inputs.title) body.title = inputs.title;
                if (inputs.html) body.html = inputs.html;
                if (inputs.status) body.status = inputs.status;
                return req('PUT', `/pages/${inputs.pageId}/`, { pages: [body] });
            }
            case 'listMembers': {
                const limit = inputs.limit || 15;
                const page = inputs.page || 1;
                const filter = inputs.filter || '';
                const qs = filter ? `?limit=${limit}&page=${page}&filter=${encodeURIComponent(filter)}` : `?limit=${limit}&page=${page}`;
                return req('GET', `/members/${qs}`);
            }
            case 'getMember': {
                if (!inputs.memberId) return { error: 'inputs.memberId is required' };
                return req('GET', `/members/${inputs.memberId}/`);
            }
            case 'createMember': {
                if (!inputs.email) return { error: 'inputs.email is required' };
                const body: any = { email: inputs.email };
                if (inputs.name) body.name = inputs.name;
                if (inputs.note) body.note = inputs.note;
                if (inputs.labels) body.labels = inputs.labels;
                if (inputs.newsletters) body.newsletters = inputs.newsletters;
                return req('POST', '/members/', { members: [body] });
            }
            case 'updateMember': {
                if (!inputs.memberId) return { error: 'inputs.memberId is required' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.note) body.note = inputs.note;
                if (inputs.labels) body.labels = inputs.labels;
                if (inputs.newsletters) body.newsletters = inputs.newsletters;
                return req('PUT', `/members/${inputs.memberId}/`, { members: [body] });
            }
            case 'listNewsletters': {
                return req('GET', '/newsletters/?limit=all');
            }
            case 'listTags': {
                const limit = inputs.limit || 50;
                const page = inputs.page || 1;
                return req('GET', `/tags/?limit=${limit}&page=${page}&include=count.posts`);
            }
            case 'createTag': {
                if (!inputs.name) return { error: 'inputs.name is required' };
                const body: any = { name: inputs.name };
                if (inputs.slug) body.slug = inputs.slug;
                if (inputs.description) body.description = inputs.description;
                return req('POST', '/tags/', { tags: [body] });
            }
            case 'getStats': {
                return req('GET', '/stats/');
            }
            case 'listTiers': {
                return req('GET', '/tiers/?limit=all&include=monthly_price,yearly_price,benefits');
            }
            case 'listOffers': {
                return req('GET', '/offers/?limit=all');
            }
            case 'listWebhooks': {
                return req('GET', '/webhooks/');
            }
            case 'createWebhook': {
                if (!inputs.event) return { error: 'inputs.event is required (e.g. post.published)' };
                if (!inputs.targetUrl) return { error: 'inputs.targetUrl is required' };
                const body: any = { event: inputs.event, target_url: inputs.targetUrl };
                if (inputs.name) body.name = inputs.name;
                return req('POST', '/webhooks/', { webhooks: [body] });
            }
            default:
                return { error: `Unknown Ghost action: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e?.message || 'Unknown error in executeGhostEnhancedAction' };
    }
}
