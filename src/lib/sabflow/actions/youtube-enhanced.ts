'use server';

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';

async function youtubeFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${YOUTUBE_BASE}${path}`;
    logger?.log(`[YouTubeEnhanced] ${method} ${path}`);

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
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return data;
}

export async function executeYouTubeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token: string = inputs.accessToken;

        switch (actionName) {
            case 'listVideos': {
                const part = inputs.part ?? 'snippet,contentDetails,statistics';
                const chart = inputs.chart ?? 'mostPopular';
                const maxResults = inputs.maxResults ?? 10;
                const data = await youtubeFetch(token, 'GET', `/videos?part=${part}&chart=${chart}&maxResults=${maxResults}`, undefined, logger);
                return { output: data };
            }

            case 'getVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const part = inputs.part ?? 'snippet,contentDetails,statistics';
                const data = await youtubeFetch(token, 'GET', `/videos?part=${part}&id=${videoId}`, undefined, logger);
                return { output: data };
            }

            case 'uploadVideo': {
                const part = 'snippet,status';
                const body: any = {
                    snippet: {
                        title: inputs.title,
                        description: inputs.description,
                        tags: inputs.tags,
                        categoryId: inputs.categoryId ?? '22',
                    },
                    status: {
                        privacyStatus: inputs.privacyStatus ?? 'public',
                    },
                };
                const data = await youtubeFetch(token, 'POST', `/videos?part=${part}&uploadType=resumable`, body, logger);
                return { output: data };
            }

            case 'updateVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const part = inputs.part ?? 'snippet,status';
                const body: any = {
                    id: videoId,
                    snippet: {
                        title: inputs.title,
                        description: inputs.description,
                        categoryId: inputs.categoryId ?? '22',
                    },
                };
                if (inputs.privacyStatus) body.status = { privacyStatus: inputs.privacyStatus };
                const data = await youtubeFetch(token, 'PUT', `/videos?part=${part}`, body, logger);
                return { output: data };
            }

            case 'deleteVideo': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                await youtubeFetch(token, 'DELETE', `/videos?id=${videoId}`, undefined, logger);
                return { output: { success: true, videoId } };
            }

            case 'listChannels': {
                const part = inputs.part ?? 'snippet,contentDetails,statistics';
                const mine = inputs.mine !== undefined ? inputs.mine : true;
                const data = await youtubeFetch(token, 'GET', `/channels?part=${part}&mine=${mine}`, undefined, logger);
                return { output: data };
            }

            case 'getChannel': {
                const channelId = inputs.channelId;
                if (!channelId) throw new Error('channelId is required');
                const part = inputs.part ?? 'snippet,contentDetails,statistics';
                const data = await youtubeFetch(token, 'GET', `/channels?part=${part}&id=${channelId}`, undefined, logger);
                return { output: data };
            }

            case 'listPlaylists': {
                const part = inputs.part ?? 'snippet,contentDetails';
                const mine = inputs.mine !== undefined ? inputs.mine : true;
                const maxResults = inputs.maxResults ?? 25;
                const data = await youtubeFetch(token, 'GET', `/playlists?part=${part}&mine=${mine}&maxResults=${maxResults}`, undefined, logger);
                return { output: data };
            }

            case 'createPlaylist': {
                const part = 'snippet,status';
                const body: any = {
                    snippet: {
                        title: inputs.title,
                        description: inputs.description,
                    },
                    status: {
                        privacyStatus: inputs.privacyStatus ?? 'public',
                    },
                };
                const data = await youtubeFetch(token, 'POST', `/playlists?part=${part}`, body, logger);
                return { output: data };
            }

            case 'addVideoToPlaylist': {
                const playlistId = inputs.playlistId;
                const videoId = inputs.videoId;
                if (!playlistId) throw new Error('playlistId is required');
                if (!videoId) throw new Error('videoId is required');
                const body = {
                    snippet: {
                        playlistId,
                        resourceId: { kind: 'youtube#video', videoId },
                    },
                };
                const data = await youtubeFetch(token, 'POST', '/playlistItems?part=snippet', body, logger);
                return { output: data };
            }

            case 'listComments': {
                const videoId = inputs.videoId;
                if (!videoId) throw new Error('videoId is required');
                const part = inputs.part ?? 'snippet';
                const maxResults = inputs.maxResults ?? 20;
                const data = await youtubeFetch(token, 'GET', `/commentThreads?part=${part}&videoId=${videoId}&maxResults=${maxResults}`, undefined, logger);
                return { output: data };
            }

            case 'postComment': {
                const videoId = inputs.videoId;
                const commentText = inputs.commentText;
                if (!videoId) throw new Error('videoId is required');
                if (!commentText) throw new Error('commentText is required');
                const body = {
                    snippet: {
                        videoId,
                        topLevelComment: {
                            snippet: { textOriginal: commentText },
                        },
                    },
                };
                const data = await youtubeFetch(token, 'POST', '/commentThreads?part=snippet', body, logger);
                return { output: data };
            }

            case 'getAnalytics': {
                const channelId = inputs.channelId;
                const startDate = inputs.startDate ?? '2024-01-01';
                const endDate = inputs.endDate ?? new Date().toISOString().split('T')[0];
                const metrics = inputs.metrics ?? 'views,likes,comments,shares';
                const dimensions = inputs.dimensions ?? 'day';
                const analyticsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId ?? 'MINE'}&startDate=${startDate}&endDate=${endDate}&metrics=${metrics}&dimensions=${dimensions}`;
                logger?.log(`[YouTubeEnhanced] GET analytics`);
                const res = await fetch(analyticsUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'searchVideos': {
                const query = inputs.query;
                if (!query) throw new Error('query is required');
                const part = inputs.part ?? 'snippet';
                const maxResults = inputs.maxResults ?? 10;
                const type = inputs.type ?? 'video';
                const data = await youtubeFetch(token, 'GET', `/search?part=${part}&q=${encodeURIComponent(query)}&maxResults=${maxResults}&type=${type}`, undefined, logger);
                return { output: data };
            }

            case 'listSubscriptions': {
                const part = inputs.part ?? 'snippet,contentDetails';
                const mine = inputs.mine !== undefined ? inputs.mine : true;
                const maxResults = inputs.maxResults ?? 25;
                const data = await youtubeFetch(token, 'GET', `/subscriptions?part=${part}&mine=${mine}&maxResults=${maxResults}`, undefined, logger);
                return { output: data };
            }

            default:
                throw new Error(`Unknown youtube_enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[YouTubeEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
