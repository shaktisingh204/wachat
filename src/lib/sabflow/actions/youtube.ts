
'use server';

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';

async function youtubeFetch(
    inputs: { accessToken?: string; apiKey?: string },
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[YouTube] ${method} ${path}`);
    const useBearer = !!inputs.accessToken;
    let url = path.startsWith('http') ? path : `${YOUTUBE_BASE}${path}`;

    // Append API key for public data requests when no Bearer token
    if (!useBearer && inputs.apiKey) {
        url += (url.includes('?') ? '&' : '?') + `key=${encodeURIComponent(inputs.apiKey)}`;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (useBearer) {
        headers['Authorization'] = `Bearer ${inputs.accessToken}`;
    }

    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const errMsg =
            data?.error?.message ||
            data?.error?.errors?.[0]?.message ||
            `YouTube API error: ${res.status}`;
        throw new Error(errMsg);
    }
    return data;
}

export async function executeYoutubeAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim() || undefined;
        const apiKey = String(inputs.apiKey ?? '').trim() || undefined;
        if (!accessToken && !apiKey) throw new Error('accessToken or apiKey is required.');

        const auth = { accessToken, apiKey };
        const yt = (method: string, path: string, body?: any) =>
            youtubeFetch(auth, method, path, body, logger);

        // Helper: append key param when no accessToken
        const withKey = (qs: string) =>
            !accessToken && apiKey ? `${qs}${qs.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}` : qs;

        switch (actionName) {
            case 'searchVideos': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const maxResults = Number(inputs.maxResults ?? 10);
                let qs = `/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
                if (inputs.channelId) qs += `&channelId=${encodeURIComponent(String(inputs.channelId))}`;
                if (inputs.order) qs += `&order=${encodeURIComponent(String(inputs.order))}`;
                if (inputs.publishedAfter) qs += `&publishedAfter=${encodeURIComponent(String(inputs.publishedAfter))}`;
                const data = await yt('GET', withKey(qs));
                return {
                    output: {
                        items: data?.items ?? [],
                        nextPageToken: data?.nextPageToken ?? null,
                    },
                };
            }

            case 'getVideo': {
                const videoId = String(inputs.videoId ?? '').trim();
                if (!videoId) throw new Error('videoId is required.');
                const data = await yt(
                    'GET',
                    withKey(`/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}`)
                );
                const item = data?.items?.[0] ?? {};
                return {
                    output: {
                        id: item.id ?? '',
                        title: item.snippet?.title ?? '',
                        description: item.snippet?.description ?? '',
                        viewCount: item.statistics?.viewCount ?? '0',
                        likeCount: item.statistics?.likeCount ?? '0',
                        commentCount: item.statistics?.commentCount ?? '0',
                        duration: item.contentDetails?.duration ?? '',
                    },
                };
            }

            case 'listChannelVideos': {
                const channelId = String(inputs.channelId ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                const maxResults = Number(inputs.maxResults ?? 10);
                let qs = `/search?part=snippet&channelId=${encodeURIComponent(channelId)}&type=video&maxResults=${maxResults}`;
                if (inputs.pageToken) qs += `&pageToken=${encodeURIComponent(String(inputs.pageToken))}`;
                const data = await yt('GET', withKey(qs));
                return {
                    output: {
                        items: data?.items ?? [],
                        nextPageToken: data?.nextPageToken ?? null,
                    },
                };
            }

            case 'getChannelInfo': {
                const channelId = String(inputs.channelId ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                const data = await yt(
                    'GET',
                    withKey(`/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}`)
                );
                const item = data?.items?.[0] ?? {};
                return {
                    output: {
                        id: item.id ?? '',
                        title: item.snippet?.title ?? '',
                        description: item.snippet?.description ?? '',
                        subscriberCount: item.statistics?.subscriberCount ?? '0',
                        videoCount: item.statistics?.videoCount ?? '0',
                        viewCount: item.statistics?.viewCount ?? '0',
                    },
                };
            }

            case 'getMyChannel': {
                if (!accessToken) throw new Error('accessToken is required for getMyChannel.');
                const data = await yt('GET', '/channels?part=snippet,statistics&mine=true');
                const item = data?.items?.[0] ?? {};
                return {
                    output: {
                        id: item.id ?? '',
                        title: item.snippet?.title ?? '',
                        subscriberCount: item.statistics?.subscriberCount ?? '0',
                    },
                };
            }

            case 'uploadVideo': {
                // Full multipart/resumable upload is not feasible in a single fetch call.
                return {
                    output: {
                        note: 'YouTube video upload requires multipart upload. Use YouTube Studio or initiate resumable upload session.',
                        uploadUrl: null,
                    },
                };
            }

            case 'updateVideo': {
                if (!accessToken) throw new Error('accessToken is required for updateVideo.');
                const videoId = String(inputs.videoId ?? '').trim();
                if (!videoId) throw new Error('videoId is required.');
                const snippet: any = {};
                if (inputs.title !== undefined) snippet.title = String(inputs.title);
                if (inputs.description !== undefined) snippet.description = String(inputs.description);
                if (inputs.tags !== undefined) snippet.tags = inputs.tags;
                if (inputs.categoryId !== undefined) snippet.categoryId = String(inputs.categoryId);
                const status: any = {};
                if (inputs.privacyStatus !== undefined) status.privacyStatus = String(inputs.privacyStatus);
                const parts = [
                    Object.keys(snippet).length > 0 ? 'snippet' : null,
                    Object.keys(status).length > 0 ? 'status' : null,
                ]
                    .filter(Boolean)
                    .join(',');
                if (!parts) throw new Error('At least one field to update (title, description, tags, categoryId, privacyStatus) is required.');
                const data = await yt('PUT', `/videos?part=${parts}`, {
                    id: videoId,
                    ...(Object.keys(snippet).length > 0 ? { snippet } : {}),
                    ...(Object.keys(status).length > 0 ? { status } : {}),
                });
                return { output: { id: data?.id ?? videoId } };
            }

            case 'deleteVideo': {
                if (!accessToken) throw new Error('accessToken is required for deleteVideo.');
                const videoId = String(inputs.videoId ?? '').trim();
                if (!videoId) throw new Error('videoId is required.');
                await yt('DELETE', `/videos?id=${encodeURIComponent(videoId)}`);
                return { output: { deleted: true } };
            }

            case 'listComments': {
                const videoId = String(inputs.videoId ?? '').trim();
                if (!videoId) throw new Error('videoId is required.');
                const maxResults = Number(inputs.maxResults ?? 20);
                const data = await yt(
                    'GET',
                    withKey(`/commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=${maxResults}`)
                );
                return { output: { items: data?.items ?? [] } };
            }

            case 'replyToComment': {
                if (!accessToken) throw new Error('accessToken is required for replyToComment.');
                const parentId = String(inputs.parentId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!parentId) throw new Error('parentId is required.');
                if (!text) throw new Error('text is required.');
                const data = await yt('POST', '/comments?part=snippet', {
                    snippet: { parentId, textOriginal: text },
                });
                return {
                    output: {
                        id: data?.id ?? '',
                        text: data?.snippet?.textOriginal ?? text,
                    },
                };
            }

            case 'likeVideo': {
                if (!accessToken) throw new Error('accessToken is required for likeVideo.');
                const videoId = String(inputs.videoId ?? '').trim();
                if (!videoId) throw new Error('videoId is required.');
                await yt('POST', `/videos/rate?id=${encodeURIComponent(videoId)}&rating=like`);
                return { output: { liked: true } };
            }

            case 'addToPlaylist': {
                if (!accessToken) throw new Error('accessToken is required for addToPlaylist.');
                const playlistId = String(inputs.playlistId ?? '').trim();
                const videoId = String(inputs.videoId ?? '').trim();
                if (!playlistId) throw new Error('playlistId is required.');
                if (!videoId) throw new Error('videoId is required.');
                const snippet: any = {
                    playlistId,
                    resourceId: { kind: 'youtube#video', videoId },
                };
                if (inputs.position !== undefined) snippet.position = Number(inputs.position);
                const data = await yt('POST', '/playlistItems?part=snippet', { snippet });
                return { output: { id: data?.id ?? '' } };
            }

            case 'listPlaylists': {
                let qs = '/playlists?part=snippet,contentDetails&maxResults=50';
                if (inputs.mine) qs += '&mine=true';
                if (inputs.channelId) qs += `&channelId=${encodeURIComponent(String(inputs.channelId))}`;
                const data = await yt('GET', withKey(qs));
                return {
                    output: {
                        items: (data?.items ?? []).map((p: any) => ({
                            id: p.id ?? '',
                            snippet: { title: p.snippet?.title ?? '' },
                        })),
                    },
                };
            }

            case 'createPlaylist': {
                if (!accessToken) throw new Error('accessToken is required for createPlaylist.');
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const privacyStatus = String(inputs.privacyStatus ?? 'public');
                const body: any = {
                    snippet: { title },
                    status: { privacyStatus },
                };
                if (inputs.description) body.snippet.description = String(inputs.description);
                const data = await yt('POST', '/playlists?part=snippet,status', body);
                logger.log(`[YouTube] Playlist created: ${data?.id}`);
                return {
                    output: {
                        id: data?.id ?? '',
                        title: data?.snippet?.title ?? title,
                    },
                };
            }

            default:
                return { error: `YouTube action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'YouTube action failed.' };
    }
}
