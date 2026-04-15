
'use server';

const REDDIT_BASE = 'https://oauth.reddit.com';

async function redditFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: Record<string, string> | string,
    logger?: any
): Promise<any> {
    logger?.log(`[Reddit] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${REDDIT_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'SabFlow/1.0',
            ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
    };
    if (body) {
        options.body =
            typeof body === 'string'
                ? body
                : new URLSearchParams(body).toString();
    }
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            data?.message || data?.error || `Reddit API error: ${res.status}`
        );
    }
    return data;
}

export async function executeRedditAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const r = (method: string, path: string, body?: Record<string, string>) =>
            redditFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getSubredditInfo': {
                const subreddit = String(inputs.subreddit ?? '').trim();
                if (!subreddit) throw new Error('subreddit is required.');
                const data = await r('GET', `/r/${subreddit}/about.json`);
                const d = data?.data ?? {};
                return {
                    output: {
                        id: d.id ?? '',
                        displayName: d.display_name ?? '',
                        subscribers: d.subscribers ?? 0,
                        description: d.public_description ?? '',
                        title: d.title ?? '',
                    },
                };
            }

            case 'listPosts': {
                const subreddit = String(inputs.subreddit ?? '').trim();
                if (!subreddit) throw new Error('subreddit is required.');
                const sort = String(inputs.sort ?? 'hot');
                const limit = Number(inputs.limit ?? 25);
                let qs = `?limit=${limit}`;
                if (inputs.after) qs += `&after=${encodeURIComponent(String(inputs.after))}`;
                const data = await r('GET', `/r/${subreddit}/${sort}.json${qs}`);
                const children = data?.data?.children ?? [];
                const posts = children.map((c: any) => ({
                    id: c.data?.id ?? '',
                    title: c.data?.title ?? '',
                    author: c.data?.author ?? '',
                    score: c.data?.score ?? 0,
                    url: c.data?.url ?? '',
                    created: c.data?.created_utc ?? 0,
                }));
                return { output: { posts, after: data?.data?.after ?? null } };
            }

            case 'getPost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const data = await r('GET', `/comments/${postId}.json`);
                const pd = data?.[0]?.data?.children?.[0]?.data ?? {};
                return {
                    output: {
                        post: {
                            id: pd.id ?? '',
                            title: pd.title ?? '',
                            author: pd.author ?? '',
                            score: pd.score ?? 0,
                            selftext: pd.selftext ?? '',
                            url: pd.url ?? '',
                        },
                    },
                };
            }

            case 'createPost': {
                const subreddit = String(inputs.subreddit ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!subreddit) throw new Error('subreddit is required.');
                if (!title) throw new Error('title is required.');
                const kind = inputs.url ? 'link' : 'self';
                const body: Record<string, string> = {
                    api_type: 'json',
                    kind,
                    sr: subreddit,
                    title,
                };
                if (inputs.text) body.text = String(inputs.text);
                if (inputs.url) body.url = String(inputs.url);
                if (inputs.nsfw !== undefined) body.nsfw = inputs.nsfw ? 'true' : 'false';
                if (inputs.spoiler !== undefined) body.spoiler = inputs.spoiler ? 'true' : 'false';
                const data = await r('POST', '/api/submit', body);
                const jd = data?.json?.data ?? {};
                logger.log(`[Reddit] Post created: ${jd.name}`);
                return { output: { id: jd.id ?? '', name: jd.name ?? '', url: jd.url ?? '' } };
            }

            case 'deletePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                await r('POST', '/api/del', { id: `t3_${postId}` });
                return { output: { deleted: true } };
            }

            case 'commentOnPost': {
                const postId = String(inputs.postId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                if (!text) throw new Error('text is required.');
                const data = await r('POST', '/api/comment', {
                    api_type: 'json',
                    thing_id: `t3_${postId}`,
                    text,
                });
                const cd = data?.json?.data?.things?.[0]?.data ?? {};
                return { output: { id: cd.id ?? '', body: cd.body ?? '' } };
            }

            case 'listComments': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                const sort = String(inputs.sort ?? 'top');
                const limit = Number(inputs.limit ?? 25);
                const data = await r('GET', `/comments/${postId}.json?sort=${sort}&limit=${limit}`);
                const children = data?.[1]?.data?.children ?? [];
                const comments = children
                    .filter((c: any) => c.kind === 't1')
                    .map((c: any) => ({
                        id: c.data?.id ?? '',
                        author: c.data?.author ?? '',
                        body: c.data?.body ?? '',
                        score: c.data?.score ?? 0,
                    }));
                return { output: { comments } };
            }

            case 'votePost': {
                const postId = String(inputs.postId ?? '').trim();
                const direction = String(inputs.direction ?? '0');
                if (!postId) throw new Error('postId is required.');
                if (!['1', '-1', '0', 1, -1, 0].includes(inputs.direction)) {
                    throw new Error('direction must be 1 (upvote), -1 (downvote), or 0 (remove).');
                }
                await r('POST', '/api/vote', { id: `t3_${postId}`, dir: direction });
                return { output: { voted: true } };
            }

            case 'savePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                await r('POST', '/api/save', { id: `t3_${postId}` });
                return { output: { saved: true } };
            }

            case 'searchPosts': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const sort = String(inputs.sort ?? 'relevance');
                const limit = Number(inputs.limit ?? 25);
                let qs = `/search.json?q=${encodeURIComponent(query)}&sort=${sort}&limit=${limit}`;
                if (inputs.subreddit) {
                    qs += `&restrict_sr=true&subreddit=${encodeURIComponent(String(inputs.subreddit))}`;
                } else {
                    qs += `&restrict_sr=false`;
                }
                const data = await r('GET', qs);
                const children = data?.data?.children ?? [];
                const posts = children.map((c: any) => ({
                    id: c.data?.id ?? '',
                    title: c.data?.title ?? '',
                    author: c.data?.author ?? '',
                    score: c.data?.score ?? 0,
                    url: c.data?.url ?? '',
                    created: c.data?.created_utc ?? 0,
                }));
                return { output: { posts } };
            }

            case 'getUserInfo': {
                const username = String(inputs.username ?? '').trim();
                if (!username) throw new Error('username is required.');
                const data = await r('GET', `/user/${username}/about.json`);
                const d = data?.data ?? {};
                return {
                    output: {
                        id: d.id ?? '',
                        name: d.name ?? '',
                        linkKarma: d.link_karma ?? 0,
                        commentKarma: d.comment_karma ?? 0,
                        createdUtc: d.created_utc ?? 0,
                    },
                };
            }

            case 'getMe': {
                const data = await r('GET', '/api/v1/me');
                return {
                    output: {
                        id: data.id ?? '',
                        name: data.name ?? '',
                        linkKarma: data.link_karma ?? 0,
                        commentKarma: data.comment_karma ?? 0,
                    },
                };
            }

            default:
                return { error: `Reddit action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Reddit action failed.' };
    }
}
