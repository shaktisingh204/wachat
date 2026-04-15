'use server';

const VIMEO_BASE = 'https://api.vimeo.com';

async function vimeoEnhancedFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${VIMEO_BASE}${path}`;
    logger?.log(`[VimeoEnhanced] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.vimeo.*+json;version=3.4',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    return data;
}

export async function executeVimeoEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token: string = inputs.accessToken;

        switch (actionName) {
            case 'listVideos': {
                const userId = inputs.userId ?? 'me';
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 25;
                const data = await vimeoEnhancedFetch(token, 'GET', `/users/${userId}/videos?page=${page}&per_page=${perPage}`, undefined, logger);
                return { output: data };
            }

            case 'getVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const data = await vimeoEnhancedFetch(token, 'GET', `/videos/${videoId}`, undefined, logger);
                return { output: data };
            }

            case 'uploadVideo': {
                const userId = inputs.userId ?? 'me';
                const body: any = {
                    upload: { approach: inputs.approach ?? 'tus', size: inputs.size },
                    name: inputs.name,
                    description: inputs.description,
                };
                const data = await vimeoEnhancedFetch(token, 'POST', `/users/${userId}/videos`, body, logger);
                return { output: data };
            }

            case 'editVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const body: any = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.privacy !== undefined) body.privacy = inputs.privacy;
                const data = await vimeoEnhancedFetch(token, 'PATCH', `/videos/${videoId}`, body, logger);
                return { output: data };
            }

            case 'deleteVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                await vimeoEnhancedFetch(token, 'DELETE', `/videos/${videoId}`, undefined, logger);
                return { output: { success: true, videoId } };
            }

            case 'listFolders': {
                const userId = inputs.userId ?? 'me';
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 25;
                const data = await vimeoEnhancedFetch(token, 'GET', `/users/${userId}/projects?page=${page}&per_page=${perPage}`, undefined, logger);
                return { output: data };
            }

            case 'getFolder': {
                const userId = inputs.userId ?? 'me';
                const projectId = inputs.projectId;
                if (!projectId) throw new Error('projectId is required');
                const data = await vimeoEnhancedFetch(token, 'GET', `/users/${userId}/projects/${projectId}`, undefined, logger);
                return { output: data };
            }

            case 'createFolder': {
                const userId = inputs.userId ?? 'me';
                const body = { name: inputs.name };
                const data = await vimeoEnhancedFetch(token, 'POST', `/users/${userId}/projects`, body, logger);
                return { output: data };
            }

            case 'listChannels': {
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 25;
                const data = await vimeoEnhancedFetch(token, 'GET', `/channels?page=${page}&per_page=${perPage}`, undefined, logger);
                return { output: data };
            }

            case 'getChannel': {
                const channelId = inputs.channelId;
                if (!channelId) throw new Error('channelId is required');
                const data = await vimeoEnhancedFetch(token, 'GET', `/channels/${channelId}`, undefined, logger);
                return { output: data };
            }

            case 'listAlbums': {
                const userId = inputs.userId ?? 'me';
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 25;
                const data = await vimeoEnhancedFetch(token, 'GET', `/users/${userId}/albums?page=${page}&per_page=${perPage}`, undefined, logger);
                return { output: data };
            }

            case 'getAlbum': {
                const userId = inputs.userId ?? 'me';
                const albumId = inputs.albumId;
                if (!albumId) throw new Error('albumId is required');
                const data = await vimeoEnhancedFetch(token, 'GET', `/users/${userId}/albums/${albumId}`, undefined, logger);
                return { output: data };
            }

            case 'getVideoComments': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const page = inputs.page ?? 1;
                const perPage = inputs.perPage ?? 25;
                const data = await vimeoEnhancedFetch(token, 'GET', `/videos/${videoId}/comments?page=${page}&per_page=${perPage}`, undefined, logger);
                return { output: data };
            }

            case 'addVideoToFolder': {
                const userId = inputs.userId ?? 'me';
                const projectId = inputs.projectId;
                const videoId = inputs.videoId;
                if (!projectId) throw new Error('projectId is required');
                if (!videoId) throw new Error('videoId is required');
                await vimeoEnhancedFetch(token, 'PUT', `/users/${userId}/projects/${projectId}/videos/${videoId}`, undefined, logger);
                return { output: { success: true, videoId, projectId } };
            }

            case 'getVideoStatistics': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const data = await vimeoEnhancedFetch(token, 'GET', `/videos/${videoId}?fields=stats`, undefined, logger);
                return { output: data };
            }

            default:
                throw new Error(`Unknown vimeo_enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[VimeoEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
