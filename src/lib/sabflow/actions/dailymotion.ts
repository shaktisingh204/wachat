'use server';

const DAILYMOTION_BASE = 'https://api.dailymotion.com';

async function dailymotionFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: Record<string, any>,
    logger?: any
): Promise<any> {
    const url = `${DAILYMOTION_BASE}${path}`;
    logger?.log(`[Dailymotion] ${method} ${path}`);

    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
    };

    let fetchBody: BodyInit | undefined;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        fetchBody = new URLSearchParams(
            Object.fromEntries(
                Object.entries(body).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
            )
        ).toString();
    }

    const res = await fetch(url, { method, headers, body: fetchBody });
    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
    return data;
}

export async function executeDailymotionAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token: string = inputs.accessToken;

        switch (actionName) {
            case 'listVideos': {
                const fields = inputs.fields ?? 'id,title,description,created_time';
                const limit = inputs.limit ?? 20;
                const page = inputs.page ?? 1;
                const data = await dailymotionFetch(token, 'GET', `/videos?fields=${fields}&limit=${limit}&page=${page}`, undefined, logger);
                return { output: data };
            }

            case 'getVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const fields = inputs.fields ?? 'id,title,description,created_time,duration,status';
                const data = await dailymotionFetch(token, 'GET', `/video/${videoId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'createVideo': {
                const body: Record<string, any> = {};
                if (inputs.url) body.url = inputs.url;
                if (inputs.title) body.title = inputs.title;
                if (inputs.description) body.description = inputs.description;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.channel) body.channel = inputs.channel;
                if (inputs.published !== undefined) body.published = inputs.published;
                const data = await dailymotionFetch(token, 'POST', '/videos', body, logger);
                return { output: data };
            }

            case 'updateVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const body: Record<string, any> = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.tags !== undefined) body.tags = inputs.tags;
                if (inputs.published !== undefined) body.published = inputs.published;
                const data = await dailymotionFetch(token, 'POST', `/video/${videoId}`, body, logger);
                return { output: data };
            }

            case 'deleteVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                await dailymotionFetch(token, 'DELETE', `/video/${videoId}`, undefined, logger);
                return { output: { success: true, videoId } };
            }

            case 'listChannels': {
                const fields = inputs.fields ?? 'id,name,description';
                const limit = inputs.limit ?? 20;
                const data = await dailymotionFetch(token, 'GET', `/channels?fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            case 'getChannel': {
                const channelId = inputs.channelId;
                if (!channelId) throw new Error('channelId is required');
                const fields = inputs.fields ?? 'id,name,description';
                const data = await dailymotionFetch(token, 'GET', `/channel/${channelId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'listPlaylists': {
                const userId = inputs.userId ?? 'me';
                const fields = inputs.fields ?? 'id,name,description';
                const limit = inputs.limit ?? 20;
                const data = await dailymotionFetch(token, 'GET', `/user/${userId}/playlists?fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            case 'getPlaylist': {
                const playlistId = inputs.playlistId;
                if (!playlistId) throw new Error('playlistId is required');
                const fields = inputs.fields ?? 'id,name,description';
                const data = await dailymotionFetch(token, 'GET', `/playlist/${playlistId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'createPlaylist': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                const data = await dailymotionFetch(token, 'POST', '/me/playlists', body, logger);
                return { output: data };
            }

            case 'addVideoToPlaylist': {
                const playlistId = inputs.playlistId;
                const videoId = inputs.videoId;
                if (!playlistId) throw new Error('playlistId is required');
                if (!videoId) throw new Error('videoId is required');
                const data = await dailymotionFetch(token, 'POST', `/playlist/${playlistId}/videos`, { id: videoId }, logger);
                return { output: data };
            }

            case 'getUserInfo': {
                const userId = inputs.userId ?? 'me';
                const fields = inputs.fields ?? 'id,screenname,username,description,avatar_720_url';
                const data = await dailymotionFetch(token, 'GET', `/user/${userId}?fields=${fields}`, undefined, logger);
                return { output: data };
            }

            case 'listComments': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const fields = inputs.fields ?? 'id,message,created_time';
                const limit = inputs.limit ?? 20;
                const data = await dailymotionFetch(token, 'GET', `/video/${videoId}/comments?fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            case 'getStats': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const data = await dailymotionFetch(token, 'GET', `/video/${videoId}?fields=views_total,likes_total,comments_total`, undefined, logger);
                return { output: data };
            }

            case 'searchVideos': {
                const query = inputs.query;
                if (!query) throw new Error('query is required');
                const fields = inputs.fields ?? 'id,title,description,created_time';
                const limit = inputs.limit ?? 20;
                const data = await dailymotionFetch(token, 'GET', `/videos?search=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}`, undefined, logger);
                return { output: data };
            }

            default:
                throw new Error(`Unknown dailymotion action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Dailymotion] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
