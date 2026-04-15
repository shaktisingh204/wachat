'use server';

const FACEBOOK_BASE = 'https://graph.facebook.com/v18.0';

async function facebookPagesFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: Record<string, any>,
    logger?: any
): Promise<any> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${FACEBOOK_BASE}${path}${separator}access_token=${accessToken}`;
    logger?.log(`[FacebookPages] ${method} ${path}`);

    const options: RequestInit = { method };

    if (body !== undefined && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
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

export async function executeFacebookPagesAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token: string = inputs.accessToken;
        const pageId: string = inputs.pageId;

        switch (actionName) {
            case 'getPage': {
                const fields = inputs.fields ?? 'id,name,about,fan_count,category,website';
                if (!pageId) throw new Error('pageId is required');
                const data = await facebookPagesFetch(token, 'GET', `/${pageId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'updatePage': {
                if (!pageId) throw new Error('pageId is required');
                const body: Record<string, any> = {};
                if (inputs.about !== undefined) body.about = inputs.about;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.website !== undefined) body.website = inputs.website;
                const data = await facebookPagesFetch(token, 'POST', `/${pageId}`, body, logger);
                return { output: data };
            }

            case 'listPosts': {
                if (!pageId) throw new Error('pageId is required');
                const fields = inputs.fields ?? 'id,message,created_time,story';
                const limit = inputs.limit ?? 25;
                const data = await facebookPagesFetch(token, 'GET', `/${pageId}/posts?fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            case 'getPost': {
                const postId = inputs.postId;
                if (!postId) throw new Error('postId is required');
                const fields = inputs.fields ?? 'id,message,created_time,story,full_picture';
                const data = await facebookPagesFetch(token, 'GET', `/${postId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'createPost': {
                if (!pageId) throw new Error('pageId is required');
                const body: Record<string, any> = {};
                if (inputs.message) body.message = inputs.message;
                if (inputs.link) body.link = inputs.link;
                if (inputs.published !== undefined) body.published = inputs.published;
                if (inputs.scheduledPublishTime) body.scheduled_publish_time = inputs.scheduledPublishTime;
                const data = await facebookPagesFetch(token, 'POST', `/${pageId}/feed`, body, logger);
                return { output: data };
            }

            case 'updatePost': {
                const postId = inputs.postId;
                if (!postId) throw new Error('postId is required');
                const body: Record<string, any> = {};
                if (inputs.message !== undefined) body.message = inputs.message;
                const data = await facebookPagesFetch(token, 'POST', `/${postId}`, body, logger);
                return { output: data };
            }

            case 'deletePost': {
                const postId = inputs.postId;
                if (!postId) throw new Error('postId is required');
                const data = await facebookPagesFetch(token, 'DELETE', `/${postId}`, undefined, logger);
                return { output: { success: true, postId, result: data } };
            }

            case 'listPhotos': {
                if (!pageId) throw new Error('pageId is required');
                const fields = inputs.fields ?? 'id,name,created_time,images';
                const limit = inputs.limit ?? 25;
                const data = await facebookPagesFetch(token, 'GET', `/${pageId}/photos?fields=${fields}&limit=${limit}&type=uploaded`, undefined, logger);
                return { output: data };
            }

            case 'uploadPhoto': {
                if (!pageId) throw new Error('pageId is required');
                const body: Record<string, any> = {};
                if (inputs.url) body.url = inputs.url;
                if (inputs.caption) body.caption = inputs.caption;
                if (inputs.published !== undefined) body.published = inputs.published;
                const data = await facebookPagesFetch(token, 'POST', `/${pageId}/photos`, body, logger);
                return { output: data };
            }

            case 'listVideos': {
                if (!pageId) throw new Error('pageId is required');
                const fields = inputs.fields ?? 'id,title,description,created_time,length';
                const limit = inputs.limit ?? 25;
                const data = await facebookPagesFetch(token, 'GET', `/${pageId}/videos?fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            case 'uploadVideo': {
                if (!pageId) throw new Error('pageId is required');
                const body: Record<string, any> = {};
                if (inputs.fileUrl) body.file_url = inputs.fileUrl;
                if (inputs.title) body.title = inputs.title;
                if (inputs.description) body.description = inputs.description;
                if (inputs.published !== undefined) body.published = inputs.published;
                const data = await facebookPagesFetch(token, 'POST', `/${pageId}/videos`, body, logger);
                return { output: data };
            }

            case 'listEvents': {
                if (!pageId) throw new Error('pageId is required');
                const fields = inputs.fields ?? 'id,name,description,start_time,end_time,place';
                const limit = inputs.limit ?? 25;
                const data = await facebookPagesFetch(token, 'GET', `/${pageId}/events?fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            case 'createEvent': {
                if (!pageId) throw new Error('pageId is required');
                const body: Record<string, any> = {
                    name: inputs.name,
                    start_time: inputs.startTime,
                };
                if (inputs.endTime) body.end_time = inputs.endTime;
                if (inputs.description) body.description = inputs.description;
                if (inputs.location) body.location = inputs.location;
                if (inputs.privacyType) body.privacy_type = inputs.privacyType;
                const data = await facebookPagesFetch(token, 'POST', `/${pageId}/events`, body, logger);
                return { output: data };
            }

            case 'getInsights': {
                if (!pageId) throw new Error('pageId is required');
                const metric = inputs.metric ?? 'page_impressions,page_engaged_users,page_fans';
                const period = inputs.period ?? 'day';
                const data = await facebookPagesFetch(token, 'GET', `/${pageId}/insights?metric=${metric}&period=${period}`, undefined, logger);
                return { output: data };
            }

            case 'replyToComment': {
                const commentId = inputs.commentId;
                const message = inputs.message;
                if (!commentId) throw new Error('commentId is required');
                if (!message) throw new Error('message is required');
                const data = await facebookPagesFetch(token, 'POST', `/${commentId}/comments`, { message }, logger);
                return { output: data };
            }

            default:
                throw new Error(`Unknown facebook_pages action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[FacebookPages] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
