'use server';

const VIMEO_BASE = 'https://api.vimeo.com';

async function vimeoFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${VIMEO_BASE}${path}`;
    logger?.log(`[Vimeo] ${method} ${path}`);

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
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    return data;
}

export async function executeVimeoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token: string = inputs.accessToken;

        switch (actionName) {
            case 'getUser': {
                const userId = inputs.userId ?? 'me';
                const data = await vimeoFetch(token, 'GET', `/users/${userId}`, undefined, logger);
                return { output: data };
            }

            case 'listVideos': {
                const userId = inputs.userId ?? 'me';
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.sort) params.set('sort', inputs.sort);
                const data = await vimeoFetch(token, 'GET', `/users/${userId}/videos?${params}`, undefined, logger);
                return { output: data };
            }

            case 'getVideo': {
                const data = await vimeoFetch(token, 'GET', `/videos/${inputs.videoId}`, undefined, logger);
                return { output: data };
            }

            case 'uploadVideoFromUrl': {
                const data = await vimeoFetch(token, 'POST', '/me/videos', {
                    upload: {
                        approach: 'pull',
                        link: inputs.videoUrl,
                    },
                    name: inputs.name,
                    description: inputs.description,
                    privacy: inputs.privacy ? { view: inputs.privacy } : undefined,
                }, logger);
                return { output: data };
            }

            case 'updateVideo': {
                const body: any = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.privacy !== undefined) body.privacy = { view: inputs.privacy };
                if (inputs.password !== undefined) body.password = inputs.password;
                const data = await vimeoFetch(token, 'PATCH', `/videos/${inputs.videoId}`, body, logger);
                return { output: data };
            }

            case 'deleteVideo': {
                const data = await vimeoFetch(token, 'DELETE', `/videos/${inputs.videoId}`, undefined, logger);
                return { output: data };
            }

            case 'createFolder': {
                const userId = inputs.userId ?? 'me';
                const data = await vimeoFetch(token, 'POST', `/users/${userId}/projects`, {
                    name: inputs.name,
                }, logger);
                return { output: data };
            }

            case 'listFolders': {
                const userId = inputs.userId ?? 'me';
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await vimeoFetch(token, 'GET', `/users/${userId}/projects?${params}`, undefined, logger);
                return { output: data };
            }

            case 'addToFolder': {
                const userId = inputs.userId ?? 'me';
                const data = await vimeoFetch(token, 'PUT', `/users/${userId}/projects/${inputs.folderId}/videos/${inputs.videoId}`, undefined, logger);
                return { output: data };
            }

            case 'getVideoStatistics': {
                const data = await vimeoFetch(token, 'GET', `/videos/${inputs.videoId}/stats`, undefined, logger);
                return { output: data };
            }

            case 'listComments': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const data = await vimeoFetch(token, 'GET', `/videos/${inputs.videoId}/comments?${params}`, undefined, logger);
                return { output: data };
            }

            case 'addComment': {
                const data = await vimeoFetch(token, 'POST', `/videos/${inputs.videoId}/comments`, {
                    text: inputs.text,
                }, logger);
                return { output: data };
            }

            case 'searchVideos': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.filter) params.set('filter', inputs.filter);
                const data = await vimeoFetch(token, 'GET', `/videos?${params}`, undefined, logger);
                return { output: data };
            }

            case 'likeVideo': {
                const userId = inputs.userId ?? 'me';
                const data = await vimeoFetch(token, 'PUT', `/users/${userId}/likes/${inputs.videoId}`, undefined, logger);
                return { output: data };
            }

            case 'createShowcase': {
                const userId = inputs.userId ?? 'me';
                const data = await vimeoFetch(token, 'POST', `/users/${userId}/albums`, {
                    name: inputs.name,
                    description: inputs.description,
                    privacy: inputs.privacy ?? 'anybody',
                    sort: inputs.sort,
                    theme: inputs.theme,
                }, logger);
                return { output: data };
            }

            default:
                return { error: `Vimeo action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger?.log(`[Vimeo] Error: ${err.message}`);
        return { error: err.message || 'Unknown error from Vimeo' };
    }
}
