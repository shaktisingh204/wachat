'use server';

export async function executeTwitterEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken || inputs.bearerToken || inputs.bearer_token;
        if (!accessToken) throw new Error('Missing Twitter accessToken or bearerToken in inputs');

        const BASE = 'https://api.twitter.com/2';

        async function twReq(
            method: 'GET' | 'POST' | 'DELETE',
            path: string,
            body?: any,
            queryParams?: Record<string, string>
        ): Promise<any> {
            let url = path.startsWith('http') ? path : `${BASE}${path}`;
            if (queryParams && Object.keys(queryParams).length > 0) {
                url += `?${new URLSearchParams(queryParams).toString()}`;
            }
            const headers: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            };
            const options: RequestInit = { method, headers };
            if (body && method !== 'GET' && method !== 'DELETE') {
                options.body = JSON.stringify(body);
            }
            const res = await fetch(url, options);
            if (res.status === 204) return { success: true };
            const json = await res.json();
            if (!res.ok) {
                const errMsg = json?.detail || json?.errors?.[0]?.message || json?.title || `Twitter API error ${res.status}`;
                throw new Error(errMsg);
            }
            return json;
        }

        switch (actionName) {
            case 'getTweet': {
                const tweetId: string = inputs.tweetId || inputs.id;
                if (!tweetId) throw new Error('Missing tweetId');
                const fields = inputs.tweetFields || 'id,text,author_id,created_at,public_metrics';
                const result = await twReq('GET', `/tweets/${tweetId}`, undefined, { 'tweet.fields': fields });
                return { output: result };
            }

            case 'searchTweets': {
                const query: string = inputs.query || inputs.q;
                if (!query) throw new Error('Missing query');
                const params: Record<string, string> = { query };
                if (inputs.maxResults) params.max_results = String(inputs.maxResults);
                if (inputs.startTime) params.start_time = inputs.startTime;
                if (inputs.endTime) params.end_time = inputs.endTime;
                if (inputs.tweetFields) params['tweet.fields'] = inputs.tweetFields;
                const result = await twReq('GET', '/tweets/search/recent', undefined, params);
                return { output: result };
            }

            case 'createTweet': {
                const text: string = inputs.text;
                if (!text) throw new Error('Missing tweet text');
                const body: any = { text };
                if (inputs.replyToTweetId) body.reply = { in_reply_to_tweet_id: inputs.replyToTweetId };
                if (inputs.mediaIds) body.media = { media_ids: Array.isArray(inputs.mediaIds) ? inputs.mediaIds : [inputs.mediaIds] };
                const result = await twReq('POST', '/tweets', body);
                return { output: result };
            }

            case 'deleteTweet': {
                const tweetId: string = inputs.tweetId || inputs.id;
                if (!tweetId) throw new Error('Missing tweetId');
                const result = await twReq('DELETE', `/tweets/${tweetId}`);
                return { output: result };
            }

            case 'retweet': {
                const userId: string = inputs.userId;
                const tweetId: string = inputs.tweetId;
                if (!userId || !tweetId) throw new Error('Missing userId or tweetId');
                const result = await twReq('POST', `/users/${userId}/retweets`, { tweet_id: tweetId });
                return { output: result };
            }

            case 'like': {
                const userId: string = inputs.userId;
                const tweetId: string = inputs.tweetId;
                if (!userId || !tweetId) throw new Error('Missing userId or tweetId');
                const result = await twReq('POST', `/users/${userId}/likes`, { tweet_id: tweetId });
                return { output: result };
            }

            case 'unlikeTweet': {
                const userId: string = inputs.userId;
                const tweetId: string = inputs.tweetId;
                if (!userId || !tweetId) throw new Error('Missing userId or tweetId');
                const result = await twReq('DELETE', `/users/${userId}/likes/${tweetId}`);
                return { output: result };
            }

            case 'getUser': {
                const userId: string = inputs.userId || inputs.id;
                if (!userId) throw new Error('Missing userId');
                const fields = inputs.userFields || 'id,name,username,description,public_metrics,profile_image_url';
                const result = await twReq('GET', `/users/${userId}`, undefined, { 'user.fields': fields });
                return { output: result };
            }

            case 'getUserByUsername': {
                const username: string = inputs.username;
                if (!username) throw new Error('Missing username');
                const fields = inputs.userFields || 'id,name,username,description,public_metrics,profile_image_url';
                const result = await twReq('GET', `/users/by/username/${username}`, undefined, { 'user.fields': fields });
                return { output: result };
            }

            case 'getUserTimeline': {
                const userId: string = inputs.userId;
                if (!userId) throw new Error('Missing userId');
                const params: Record<string, string> = {};
                if (inputs.maxResults) params.max_results = String(inputs.maxResults);
                if (inputs.paginationToken) params.pagination_token = inputs.paginationToken;
                if (inputs.tweetFields) params['tweet.fields'] = inputs.tweetFields;
                const result = await twReq('GET', `/users/${userId}/tweets`, undefined, params);
                return { output: result };
            }

            case 'getUserMentions': {
                const userId: string = inputs.userId;
                if (!userId) throw new Error('Missing userId');
                const params: Record<string, string> = {};
                if (inputs.maxResults) params.max_results = String(inputs.maxResults);
                if (inputs.paginationToken) params.pagination_token = inputs.paginationToken;
                if (inputs.tweetFields) params['tweet.fields'] = inputs.tweetFields;
                const result = await twReq('GET', `/users/${userId}/mentions`, undefined, params);
                return { output: result };
            }

            case 'followUser': {
                const userId: string = inputs.userId;
                const targetUserId: string = inputs.targetUserId;
                if (!userId || !targetUserId) throw new Error('Missing userId or targetUserId');
                const result = await twReq('POST', `/users/${userId}/following`, { target_user_id: targetUserId });
                return { output: result };
            }

            case 'unfollowUser': {
                const userId: string = inputs.userId;
                const targetUserId: string = inputs.targetUserId;
                if (!userId || !targetUserId) throw new Error('Missing userId or targetUserId');
                const result = await twReq('DELETE', `/users/${userId}/following/${targetUserId}`);
                return { output: result };
            }

            case 'getFollowers': {
                const userId: string = inputs.userId;
                if (!userId) throw new Error('Missing userId');
                const params: Record<string, string> = {};
                if (inputs.maxResults) params.max_results = String(inputs.maxResults);
                if (inputs.paginationToken) params.pagination_token = inputs.paginationToken;
                if (inputs.userFields) params['user.fields'] = inputs.userFields;
                const result = await twReq('GET', `/users/${userId}/followers`, undefined, params);
                return { output: result };
            }

            case 'getFollowing': {
                const userId: string = inputs.userId;
                if (!userId) throw new Error('Missing userId');
                const params: Record<string, string> = {};
                if (inputs.maxResults) params.max_results = String(inputs.maxResults);
                if (inputs.paginationToken) params.pagination_token = inputs.paginationToken;
                if (inputs.userFields) params['user.fields'] = inputs.userFields;
                const result = await twReq('GET', `/users/${userId}/following`, undefined, params);
                return { output: result };
            }

            default:
                return { error: `Twitter Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Twitter Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Twitter Enhanced action failed' };
    }
}
