'use server';

const CIRCLE_BASE = 'https://app.circle.so/api/v1';

async function circleFetch(apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Circle] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CIRCLE_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Circle API error: ${res.status}`);
    }
    return data;
}

export async function executeCircleCommunityAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');
        const circle = (method: string, path: string, body?: any) => circleFetch(apiToken, method, path, body, logger);

        switch (actionName) {
            case 'listCommunities': {
                const data = await circle('GET', '/communities');
                return { output: { communities: data.communities ?? data } };
            }

            case 'getCommunity': {
                const communityId = String(inputs.communityId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                const data = await circle('GET', `/communities/${communityId}`);
                return { output: data };
            }

            case 'listSpaces': {
                const communityId = String(inputs.communityId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await circle('GET', `/communities/${communityId}/spaces${query}`);
                return { output: { spaces: data.spaces ?? data } };
            }

            case 'getSpace': {
                const communityId = String(inputs.communityId ?? '').trim();
                const spaceId = String(inputs.spaceId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                if (!spaceId) throw new Error('spaceId is required.');
                const data = await circle('GET', `/communities/${communityId}/spaces/${spaceId}`);
                return { output: data };
            }

            case 'listMembers': {
                const communityId = String(inputs.communityId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.search) params.set('search', String(inputs.search));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await circle('GET', `/communities/${communityId}/members${query}`);
                return { output: { members: data.members ?? data } };
            }

            case 'getMember': {
                const communityId = String(inputs.communityId ?? '').trim();
                const memberId = String(inputs.memberId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                if (!memberId) throw new Error('memberId is required.');
                const data = await circle('GET', `/communities/${communityId}/members/${memberId}`);
                return { output: data };
            }

            case 'inviteMember': {
                const communityId = String(inputs.communityId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.name) body.name = inputs.name;
                if (inputs.spaceIds) body.space_ids = inputs.spaceIds;
                const data = await circle('POST', `/communities/${communityId}/members/invite`, body);
                return { output: data };
            }

            case 'listPosts': {
                const communityId = String(inputs.communityId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.spaceId) params.set('space_id', String(inputs.spaceId));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await circle('GET', `/communities/${communityId}/posts${query}`);
                return { output: { posts: data.posts ?? data } };
            }

            case 'getPost': {
                const communityId = String(inputs.communityId ?? '').trim();
                const postId = String(inputs.postId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                if (!postId) throw new Error('postId is required.');
                const data = await circle('GET', `/communities/${communityId}/posts/${postId}`);
                return { output: data };
            }

            case 'createPost': {
                const communityId = String(inputs.communityId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                const body: any = {};
                if (inputs.spaceId) body.space_id = inputs.spaceId;
                if (inputs.name) body.name = inputs.name;
                if (inputs.body) body.body = inputs.body;
                if (inputs.isPublished !== undefined) body.is_published = inputs.isPublished;
                const data = await circle('POST', `/communities/${communityId}/posts`, body);
                return { output: data };
            }

            case 'updatePost': {
                const communityId = String(inputs.communityId ?? '').trim();
                const postId = String(inputs.postId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                if (!postId) throw new Error('postId is required.');
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.body) body.body = inputs.body;
                if (inputs.isPublished !== undefined) body.is_published = inputs.isPublished;
                const data = await circle('PUT', `/communities/${communityId}/posts/${postId}`, body);
                return { output: data };
            }

            case 'deletePost': {
                const communityId = String(inputs.communityId ?? '').trim();
                const postId = String(inputs.postId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                if (!postId) throw new Error('postId is required.');
                await circle('DELETE', `/communities/${communityId}/posts/${postId}`);
                return { output: { success: true, postId } };
            }

            case 'listComments': {
                const communityId = String(inputs.communityId ?? '').trim();
                const postId = String(inputs.postId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                if (!postId) throw new Error('postId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await circle('GET', `/communities/${communityId}/posts/${postId}/comments${query}`);
                return { output: { comments: data.comments ?? data } };
            }

            case 'createComment': {
                const communityId = String(inputs.communityId ?? '').trim();
                const postId = String(inputs.postId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                if (!postId) throw new Error('postId is required.');
                const body: any = {};
                if (inputs.body) body.body = inputs.body;
                const data = await circle('POST', `/communities/${communityId}/posts/${postId}/comments`, body);
                return { output: data };
            }

            case 'listEvents': {
                const communityId = String(inputs.communityId ?? '').trim();
                if (!communityId) throw new Error('communityId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await circle('GET', `/communities/${communityId}/events${query}`);
                return { output: { events: data.events ?? data } };
            }

            default:
                throw new Error(`Unknown Circle Community action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Circle] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
