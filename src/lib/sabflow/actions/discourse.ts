'use server';

async function discourseFetch(
    siteUrl: string,
    apiKey: string,
    username: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Discourse] ${method} ${path}`);
    const url = `${siteUrl}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Api-Key': apiKey,
            'Api-Username': username,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!res.ok) throw new Error(`Discourse API error ${res.status}: ${text}`);
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

export async function executeDiscourseAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const siteUrl = String(inputs.siteUrl ?? '').trim().replace(/\/$/, '');
        const apiKey = String(inputs.apiKey ?? '').trim();
        const username = String(inputs.username ?? '').trim();
        if (!siteUrl) throw new Error('siteUrl is required.');
        if (!apiKey) throw new Error('apiKey is required.');
        if (!username) throw new Error('username is required.');

        const df = (method: string, path: string, body?: any) =>
            discourseFetch(siteUrl, apiKey, username, method, path, body, logger);

        switch (actionName) {
            case 'createTopic': {
                const title = String(inputs.title ?? '').trim();
                const raw = String(inputs.raw ?? '').trim();
                if (!title || !raw) throw new Error('title and raw are required.');
                const body: Record<string, any> = { title, raw };
                if (inputs.categoryId !== undefined) body.category = Number(inputs.categoryId);
                const data = await df('POST', '/posts.json', body);
                return {
                    output: {
                        id: String(data.topic_id ?? data.id ?? ''),
                        slug: data.topic_slug ?? '',
                        postId: String(data.id ?? ''),
                    },
                };
            }

            case 'getTopic': {
                const topicId = String(inputs.topicId ?? '').trim();
                if (!topicId) throw new Error('topicId is required.');
                const data = await df('GET', `/t/${topicId}.json`);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        title: data.title ?? '',
                        postsCount: String(data.posts_count ?? ''),
                        views: String(data.views ?? ''),
                    },
                };
            }

            case 'replyToTopic': {
                const topicId = String(inputs.topicId ?? '').trim();
                const raw = String(inputs.raw ?? '').trim();
                if (!topicId || !raw) throw new Error('topicId and raw are required.');
                const data = await df('POST', '/posts.json', { topic_id: Number(topicId), raw });
                return {
                    output: {
                        id: String(data.id ?? ''),
                        postNumber: String(data.post_number ?? ''),
                    },
                };
            }

            case 'getPost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const data = await df('GET', `/posts/${postId}.json`);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        raw: data.raw ?? '',
                        topicId: String(data.topic_id ?? ''),
                    },
                };
            }

            case 'updatePost': {
                const postId = String(inputs.postId ?? '').trim();
                const raw = String(inputs.raw ?? '').trim();
                if (!postId || !raw) throw new Error('postId and raw are required.');
                const data = await df('PUT', `/posts/${postId}.json`, { post: { raw } });
                return { output: { id: String(data.post?.id ?? postId) } };
            }

            case 'deletePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                await df('DELETE', `/posts/${postId}.json`);
                return { output: { deleted: true } };
            }

            case 'listTopics': {
                const params = new URLSearchParams();
                if (inputs.categoryId !== undefined) params.set('category', String(inputs.categoryId));
                const path = inputs.categoryId
                    ? `/c/${inputs.categoryId}/l/latest.json`
                    : `/latest.json?${params.toString()}`;
                const data = await df('GET', path);
                const topics = data.topic_list?.topics ?? [];
                return { output: { topics } };
            }

            case 'searchTopics': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const data = await df('GET', `/search.json?q=${encodeURIComponent(query)}`);
                const topics = data.topics ?? [];
                return { output: { topics } };
            }

            case 'createCategory': {
                const name = String(inputs.name ?? '').trim();
                const color = String(inputs.color ?? '0088CC').trim().replace(/^#/, '');
                if (!name) throw new Error('name is required.');
                const data = await df('POST', '/categories.json', {
                    name,
                    color,
                    text_color: 'FFFFFF',
                });
                const category = data.category ?? data;
                return { output: { id: String(category.id ?? ''), name: category.name ?? name } };
            }

            case 'listCategories': {
                const data = await df('GET', '/categories.json');
                const categories = data.category_list?.categories ?? [];
                return { output: { categories } };
            }

            case 'getUser': {
                const uname = String(inputs.username ?? '').trim();
                if (!uname) throw new Error('username is required.');
                const data = await df('GET', `/users/${uname}.json`);
                const u = data.user ?? data;
                return {
                    output: {
                        id: String(u.id ?? ''),
                        username: u.username ?? '',
                        email: u.email ?? '',
                    },
                };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                params.set('period', String(inputs.period ?? 'daily'));
                params.set('order', String(inputs.order ?? 'likes_received'));
                params.set('page', String(Number(inputs.page ?? 0)));
                const data = await df('GET', `/directory_items.json?${params.toString()}`);
                const users = data.directory_items ?? [];
                return { output: { users } };
            }

            case 'grantBadge': {
                const badgeUsername = String(inputs.username ?? '').trim();
                const badgeId = inputs.badgeId;
                if (!badgeUsername || !badgeId) throw new Error('username and badgeId are required.');
                await df('POST', `/user_badges.json`, {
                    username: badgeUsername,
                    badge_id: Number(badgeId),
                });
                return { output: { granted: true } };
            }

            default:
                return { error: `Discourse action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Discourse action failed.' };
    }
}
