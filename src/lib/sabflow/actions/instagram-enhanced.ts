'use server';

const INSTAGRAM_BASE = 'https://graph.instagram.com/v18.0';

async function instagramFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: Record<string, any>,
    logger?: any
): Promise<any> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${INSTAGRAM_BASE}${path}${separator}access_token=${accessToken}`;
    logger?.log(`[InstagramEnhanced] ${method} ${path}`);

    const options: RequestInit = { method };
    if (body !== undefined && method !== 'GET') {
        (options as any).headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok || data?.error) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
}

export async function executeInstagramEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token: string = inputs.accessToken;

        switch (actionName) {
            case 'getProfile': {
                const userId = inputs.userId ?? 'me';
                const fields = inputs.fields ?? 'id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website';
                const data = await instagramFetch(token, 'GET', `/${userId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'getMedia': {
                const mediaId = inputs.mediaId;
                if (!mediaId) throw new Error('mediaId is required');
                const fields = inputs.fields ?? 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count';
                const data = await instagramFetch(token, 'GET', `/${mediaId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'listMedia': {
                const userId = inputs.userId ?? 'me';
                const fields = inputs.fields ?? 'id,caption,media_type,media_url,timestamp,like_count,comments_count';
                const limit = inputs.limit ?? 25;
                const data = await instagramFetch(token, 'GET', `/${userId}/media?fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            case 'createMediaContainer': {
                const userId = inputs.userId ?? 'me';
                if (!inputs.imageUrl && !inputs.videoUrl) throw new Error('imageUrl or videoUrl is required');
                const body: Record<string, any> = {
                    media_type: inputs.mediaType ?? 'IMAGE',
                };
                if (inputs.imageUrl) body.image_url = inputs.imageUrl;
                if (inputs.videoUrl) body.video_url = inputs.videoUrl;
                if (inputs.caption) body.caption = inputs.caption;
                if (inputs.locationId) body.location_id = inputs.locationId;
                if (inputs.isCarouselItem !== undefined) body.is_carousel_item = inputs.isCarouselItem;
                const data = await instagramFetch(token, 'POST', `/${userId}/media`, body, logger);
                return { output: data };
            }

            case 'publishMedia': {
                const userId = inputs.userId ?? 'me';
                const creationId = inputs.creationId;
                if (!creationId) throw new Error('creationId is required');
                const data = await instagramFetch(token, 'POST', `/${userId}/media_publish`, { creation_id: creationId }, logger);
                return { output: data };
            }

            case 'getMediaInsights': {
                const mediaId = inputs.mediaId;
                if (!mediaId) throw new Error('mediaId is required');
                const metric = inputs.metric ?? 'impressions,reach,likes,comments,shares,saves';
                const data = await instagramFetch(token, 'GET', `/${mediaId}/insights?metric=${metric}`, undefined, logger);
                return { output: data };
            }

            case 'listComments': {
                const mediaId = inputs.mediaId;
                if (!mediaId) throw new Error('mediaId is required');
                const fields = inputs.fields ?? 'id,text,timestamp,username';
                const data = await instagramFetch(token, 'GET', `/${mediaId}/comments?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'replyToComment': {
                const mediaId = inputs.mediaId;
                const message = inputs.message;
                if (!mediaId) throw new Error('mediaId is required');
                if (!message) throw new Error('message is required');
                const data = await instagramFetch(token, 'POST', `/${mediaId}/replies`, { message }, logger);
                return { output: data };
            }

            case 'deleteComment': {
                const commentId = inputs.commentId;
                if (!commentId) throw new Error('commentId is required');
                const data = await instagramFetch(token, 'DELETE', `/${commentId}`, undefined, logger);
                return { output: { success: true, commentId, result: data } };
            }

            case 'hideComment': {
                const commentId = inputs.commentId;
                const hide = inputs.hide !== undefined ? inputs.hide : true;
                if (!commentId) throw new Error('commentId is required');
                const data = await instagramFetch(token, 'POST', `/${commentId}`, { hide: hide }, logger);
                return { output: data };
            }

            case 'listStories': {
                const userId = inputs.userId ?? 'me';
                const fields = inputs.fields ?? 'id,media_type,media_url,timestamp';
                const data = await instagramFetch(token, 'GET', `/${userId}/stories?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'getStory': {
                const storyId = inputs.storyId;
                if (!storyId) throw new Error('storyId is required');
                const fields = inputs.fields ?? 'id,media_type,media_url,timestamp';
                const data = await instagramFetch(token, 'GET', `/${storyId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'getUserInsights': {
                const userId = inputs.userId ?? 'me';
                const metric = inputs.metric ?? 'impressions,reach,follower_count,profile_views';
                const period = inputs.period ?? 'day';
                const data = await instagramFetch(token, 'GET', `/${userId}/insights?metric=${metric}&period=${period}`, undefined, logger);
                return { output: data };
            }

            case 'searchHashtags': {
                const userId = inputs.userId ?? 'me';
                const hashtag = inputs.hashtag;
                if (!hashtag) throw new Error('hashtag is required');
                const data = await instagramFetch(token, 'GET', `/ig_hashtag_search?user_id=${userId}&q=${encodeURIComponent(hashtag)}`, undefined, logger);
                return { output: data };
            }

            case 'getHashtagMedia': {
                const hashtagId = inputs.hashtagId;
                const userId = inputs.userId ?? 'me';
                if (!hashtagId) throw new Error('hashtagId is required');
                const fields = inputs.fields ?? 'id,caption,media_type,media_url,timestamp';
                const edge = inputs.edge ?? 'top_media';
                const data = await instagramFetch(token, 'GET', `/${hashtagId}/${edge}?user_id=${userId}&fields=${fields}`, undefined, logger);
                return { output: data };
            }

            default:
                throw new Error(`Unknown instagram_enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[InstagramEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
