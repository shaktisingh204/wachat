'use server';

const LOOM_BASE = 'https://www.loom.com/v1';

async function loomFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${LOOM_BASE}${path}`;
    logger?.log(`[Loom] ${method} ${path}`);

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

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    return data;
}

export async function executeLoomAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token: string = inputs.accessToken;

        switch (actionName) {
            case 'getVideo': {
                const data = await loomFetch(token, 'GET', `/videos/${inputs.videoId}`, undefined, logger);
                return { output: data };
            }

            case 'listVideos': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.folderId) params.set('folder_id', inputs.folderId);
                const data = await loomFetch(token, 'GET', `/videos?${params}`, undefined, logger);
                return { output: data };
            }

            case 'deleteVideo': {
                const data = await loomFetch(token, 'DELETE', `/videos/${inputs.videoId}`, undefined, logger);
                return { output: data };
            }

            case 'updateVideo': {
                const body: any = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.privacy !== undefined) body.privacy = inputs.privacy;
                const data = await loomFetch(token, 'PUT', `/videos/${inputs.videoId}`, body, logger);
                return { output: data };
            }

            case 'generateThumbnail': {
                const data = await loomFetch(token, 'POST', `/videos/${inputs.videoId}/thumbnail`, {
                    timestamp: inputs.timestamp ?? 0,
                }, logger);
                return { output: data };
            }

            case 'getTranscript': {
                const data = await loomFetch(token, 'GET', `/videos/${inputs.videoId}/transcript`, undefined, logger);
                return { output: data };
            }

            case 'createFolder': {
                const data = await loomFetch(token, 'POST', '/folders', {
                    name: inputs.name,
                    parent_id: inputs.parentId,
                }, logger);
                return { output: data };
            }

            case 'listFolders': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const data = await loomFetch(token, 'GET', `/folders?${params}`, undefined, logger);
                return { output: data };
            }

            case 'moveVideo': {
                const data = await loomFetch(token, 'PUT', `/videos/${inputs.videoId}/move`, {
                    folder_id: inputs.folderId,
                }, logger);
                return { output: data };
            }

            case 'getSpace': {
                const data = await loomFetch(token, 'GET', `/spaces/${inputs.spaceId}`, undefined, logger);
                return { output: data };
            }

            case 'listSpaces': {
                const data = await loomFetch(token, 'GET', '/spaces', undefined, logger);
                return { output: data };
            }

            case 'shareVideo': {
                const data = await loomFetch(token, 'POST', `/videos/${inputs.videoId}/share`, {
                    emails: inputs.emails,
                    message: inputs.message,
                }, logger);
                return { output: data };
            }

            case 'createLink': {
                const data = await loomFetch(token, 'POST', `/videos/${inputs.videoId}/links`, {
                    type: inputs.type ?? 'view',
                    expires_at: inputs.expiresAt,
                }, logger);
                return { output: data };
            }

            case 'getViewerInsights': {
                const data = await loomFetch(token, 'GET', `/videos/${inputs.videoId}/insights`, undefined, logger);
                return { output: data };
            }

            case 'searchVideos': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const data = await loomFetch(token, 'GET', `/videos/search?${params}`, undefined, logger);
                return { output: data };
            }

            default:
                return { error: `Loom action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger?.log(`[Loom] Error: ${err.message}`);
        return { error: err.message || 'Unknown error from Loom' };
    }
}
