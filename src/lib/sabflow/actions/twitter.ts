
'use server';

const TWITTER_BASE = 'https://api.twitter.com/2';

async function twitterFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Twitter] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${TWITTER_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const errMsg =
            data?.errors?.[0]?.message ||
            data?.detail ||
            data?.title ||
            `Twitter API error: ${res.status}`;
        throw new Error(errMsg);
    }
    return data;
}

export async function executeTwitterAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const accessToken = String(inputs.accessToken ?? inputs.bearerToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken or bearerToken is required.');

        const tw = (method: string, path: string, body?: any) =>
            twitterFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getTweet': {
                const tweetId = String(inputs.tweetId ?? '').trim();
                if (!tweetId) throw new Error('tweetId is required.');
                const fields = inputs.fields ?? 'created_at,author_id,public_metrics,text';
                const data = await tw('GET', `/tweets/${tweetId}?tweet.fields=${fields}`);
                const d = data?.data ?? {};
                return {
                    output: {
                        id: d.id ?? '',
                        text: d.text ?? '',
                        authorId: d.author_id ?? '',
                        createdAt: d.created_at ?? '',
                        metrics: {
                            retweets: d.public_metrics?.retweet_count ?? 0,
                            likes: d.public_metrics?.like_count ?? 0,
                            replies: d.public_metrics?.reply_count ?? 0,
                            quotes: d.public_metrics?.quote_count ?? 0,
                        },
                    },
                };
            }

            case 'searchTweets': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const maxResults = Number(inputs.maxResults ?? 10);
                let qs = `/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}`;
                if (inputs.startTime) qs += `&start_time=${encodeURIComponent(String(inputs.startTime))}`;
                if (inputs.endTime) qs += `&end_time=${encodeURIComponent(String(inputs.endTime))}`;
                if (inputs.nextToken) qs += `&next_token=${encodeURIComponent(String(inputs.nextToken))}`;
                const data = await tw('GET', qs);
                const tweets = (data?.data ?? []).map((t: any) => ({
                    id: t.id ?? '',
                    text: t.text ?? '',
                    authorId: t.author_id ?? '',
                }));
                return {
                    output: {
                        tweets,
                        nextToken: data?.meta?.next_token ?? null,
                        resultCount: data?.meta?.result_count ?? tweets.length,
                    },
                };
            }

            case 'createTweet': {
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');
                const body: any = { text };
                if (inputs.replyToId) body.reply = { in_reply_to_tweet_id: String(inputs.replyToId) };
                if (inputs.mediaIds) body.media = { media_ids: inputs.mediaIds };
                if (inputs.poll) body.poll = inputs.poll;
                const data = await tw('POST', '/tweets', body);
                logger.log(`[Twitter] Tweet created: ${data?.data?.id}`);
                return { output: { id: data?.data?.id ?? '', text: data?.data?.text ?? '' } };
            }

            case 'deleteTweet': {
                const tweetId = String(inputs.tweetId ?? '').trim();
                if (!tweetId) throw new Error('tweetId is required.');
                await tw('DELETE', `/tweets/${tweetId}`);
                return { output: { deleted: true } };
            }

            case 'getUserByUsername': {
                const username = String(inputs.username ?? '').trim();
                if (!username) throw new Error('username is required.');
                const fields = 'created_at,description,public_metrics,profile_image_url';
                const data = await tw('GET', `/users/by/username/${username}?user.fields=${fields}`);
                const d = data?.data ?? {};
                return {
                    output: {
                        id: d.id ?? '',
                        name: d.name ?? '',
                        username: d.username ?? '',
                        description: d.description ?? '',
                        metrics: {
                            followersCount: d.public_metrics?.followers_count ?? 0,
                            followingCount: d.public_metrics?.following_count ?? 0,
                            tweetCount: d.public_metrics?.tweet_count ?? 0,
                        },
                    },
                };
            }

            case 'getUserById': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await tw('GET', `/users/${userId}?user.fields=created_at,description,public_metrics`);
                const d = data?.data ?? {};
                return {
                    output: { id: d.id ?? '', name: d.name ?? '', username: d.username ?? '' },
                };
            }

            case 'getMe': {
                const data = await tw('GET', '/users/me');
                const d = data?.data ?? {};
                return { output: { id: d.id ?? '', name: d.name ?? '', username: d.username ?? '' } };
            }

            case 'getFollowers': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const maxResults = Number(inputs.maxResults ?? 100);
                let qs = `/users/${userId}/followers?max_results=${maxResults}`;
                if (inputs.paginationToken) qs += `&pagination_token=${encodeURIComponent(String(inputs.paginationToken))}`;
                const data = await tw('GET', qs);
                return {
                    output: {
                        users: data?.data ?? [],
                        nextToken: data?.meta?.next_token ?? null,
                    },
                };
            }

            case 'getFollowing': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const maxResults = Number(inputs.maxResults ?? 100);
                const data = await tw('GET', `/users/${userId}/following?max_results=${maxResults}`);
                return {
                    output: {
                        users: data?.data ?? [],
                        nextToken: data?.meta?.next_token ?? null,
                    },
                };
            }

            case 'likeTweet': {
                const userId = String(inputs.userId ?? '').trim();
                const tweetId = String(inputs.tweetId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                if (!tweetId) throw new Error('tweetId is required.');
                await tw('POST', `/users/${userId}/likes`, { tweet_id: tweetId });
                return { output: { liked: true } };
            }

            case 'unlikeTweet': {
                const userId = String(inputs.userId ?? '').trim();
                const tweetId = String(inputs.tweetId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                if (!tweetId) throw new Error('tweetId is required.');
                await tw('DELETE', `/users/${userId}/likes/${tweetId}`);
                return { output: { liked: false } };
            }

            case 'retweet': {
                const userId = String(inputs.userId ?? '').trim();
                const tweetId = String(inputs.tweetId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                if (!tweetId) throw new Error('tweetId is required.');
                await tw('POST', `/users/${userId}/retweets`, { tweet_id: tweetId });
                return { output: { retweeted: true } };
            }

            case 'getUserTimeline': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const maxResults = Number(inputs.maxResults ?? 10);
                let qs = `/users/${userId}/tweets?max_results=${maxResults}`;
                if (inputs.paginationToken) qs += `&pagination_token=${encodeURIComponent(String(inputs.paginationToken))}`;
                const data = await tw('GET', qs);
                return {
                    output: {
                        tweets: data?.data ?? [],
                        nextToken: data?.meta?.next_token ?? null,
                    },
                };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name, private: inputs.private ?? false };
                const data = await tw('POST', '/lists', body);
                logger.log(`[Twitter] List created: ${data?.data?.id}`);
                return { output: { id: data?.data?.id ?? '', name: data?.data?.name ?? '' } };
            }

            default:
                return { error: `Twitter action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Twitter action failed.' };
    }
}
