'use server';

const YT_V3 = 'https://www.googleapis.com/youtube/v3';
const YT_ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2';

export async function executeYoutubeAnalyticsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { accessToken } = inputs;
        const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        const ytFetch = async (baseUrl: string, method: string, path: string, body?: any) => {
            const url = `${baseUrl}${path}`;
            logger?.log(`[YouTubeAnalytics] ${method} ${url}`);
            const opts: RequestInit = { method, headers: authHeader };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(url, opts);
            const text = await res.text();
            let json: any;
            try { json = JSON.parse(text); } catch { json = { raw: text }; }
            if (!res.ok) throw new Error(json?.error?.message || json?.error || text);
            return json;
        };

        const v3 = (method: string, path: string, body?: any) => ytFetch(YT_V3, method, path, body);
        const analytics = (method: string, path: string, body?: any) => ytFetch(YT_ANALYTICS, method, path, body);

        switch (actionName) {
            case 'listChannels': {
                const part = inputs.part || 'snippet,contentDetails,statistics';
                const params = new URLSearchParams({ part });
                if (inputs.mine) params.set('mine', 'true');
                if (inputs.id) params.set('id', inputs.id);
                const data = await v3('GET', `/channels?${params}`);
                return { output: { channels: data.items, pageInfo: data.pageInfo, raw: data } };
            }
            case 'getChannel': {
                const part = inputs.part || 'snippet,contentDetails,statistics,brandingSettings';
                const params = new URLSearchParams({ part, id: inputs.channelId });
                const data = await v3('GET', `/channels?${params}`);
                return { output: { channel: data.items?.[0] ?? null, raw: data } };
            }
            case 'listVideos': {
                const part = inputs.part || 'snippet,contentDetails,statistics';
                const params = new URLSearchParams({ part });
                if (inputs.channelId) params.set('channelId', inputs.channelId);
                if (inputs.playlistId) params.set('playlistId', inputs.playlistId);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await v3('GET', `/videos?${params}`);
                return { output: { videos: data.items, nextPageToken: data.nextPageToken, pageInfo: data.pageInfo, raw: data } };
            }
            case 'getVideo': {
                const part = inputs.part || 'snippet,contentDetails,statistics,status';
                const params = new URLSearchParams({ part, id: inputs.videoId });
                const data = await v3('GET', `/videos?${params}`);
                return { output: { video: data.items?.[0] ?? null, raw: data } };
            }
            case 'uploadVideo': {
                // Metadata-only insert (actual binary upload requires resumable session)
                const data = await v3('POST', `/videos?part=snippet,status`, {
                    snippet: {
                        title: inputs.title,
                        description: inputs.description || '',
                        tags: inputs.tags || [],
                        categoryId: inputs.categoryId || '22',
                    },
                    status: {
                        privacyStatus: inputs.privacyStatus || 'private',
                    },
                });
                return { output: { video: data, raw: data } };
            }
            case 'updateVideo': {
                const part = inputs.part || 'snippet,status';
                const body: any = { id: inputs.videoId };
                if (inputs.snippet) body.snippet = inputs.snippet;
                if (inputs.status) body.status = inputs.status;
                const data = await v3('PUT', `/videos?part=${encodeURIComponent(part)}`, body);
                return { output: { video: data, raw: data } };
            }
            case 'deleteVideo': {
                const res = await fetch(`${YT_V3}/videos?id=${encodeURIComponent(inputs.videoId)}`, {
                    method: 'DELETE',
                    headers: authHeader,
                });
                return { output: { success: res.status === 204 || res.ok } };
            }
            case 'listPlaylists': {
                const part = inputs.part || 'snippet,contentDetails';
                const params = new URLSearchParams({ part });
                if (inputs.mine) params.set('mine', 'true');
                if (inputs.channelId) params.set('channelId', inputs.channelId);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                const data = await v3('GET', `/playlists?${params}`);
                return { output: { playlists: data.items, nextPageToken: data.nextPageToken, raw: data } };
            }
            case 'createPlaylist': {
                const data = await v3('POST', '/playlists?part=snippet,status', {
                    snippet: {
                        title: inputs.title,
                        description: inputs.description || '',
                    },
                    status: { privacyStatus: inputs.privacyStatus || 'private' },
                });
                return { output: { playlist: data, raw: data } };
            }
            case 'addToPlaylist': {
                const data = await v3('POST', '/playlistItems?part=snippet', {
                    snippet: {
                        playlistId: inputs.playlistId,
                        resourceId: {
                            kind: 'youtube#video',
                            videoId: inputs.videoId,
                        },
                        position: inputs.position,
                    },
                });
                return { output: { playlistItem: data, raw: data } };
            }
            case 'getAnalyticsReport': {
                const params = new URLSearchParams({
                    ids: inputs.ids || 'channel==MINE',
                    startDate: inputs.startDate,
                    endDate: inputs.endDate,
                    metrics: inputs.metrics || 'views,estimatedMinutesWatched,averageViewDuration',
                });
                if (inputs.dimensions) params.set('dimensions', inputs.dimensions);
                if (inputs.filters) params.set('filters', inputs.filters);
                if (inputs.sort) params.set('sort', inputs.sort);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                const data = await analytics('GET', `/reports?${params}`);
                return { output: { report: data, raw: data } };
            }
            case 'getRealtimeReport': {
                const params = new URLSearchParams({
                    ids: inputs.ids || 'channel==MINE',
                    metrics: inputs.metrics || 'views',
                });
                if (inputs.dimensions) params.set('dimensions', inputs.dimensions);
                if (inputs.filters) params.set('filters', inputs.filters);
                const data = await analytics('GET', `/realtimeReports?${params}`);
                return { output: { report: data, raw: data } };
            }
            case 'listComments': {
                const part = inputs.part || 'snippet';
                const params = new URLSearchParams({ part });
                if (inputs.videoId) params.set('videoId', inputs.videoId);
                if (inputs.parentId) params.set('parentId', inputs.parentId);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                const data = await v3('GET', `/comments?${params}`);
                return { output: { comments: data.items, nextPageToken: data.nextPageToken, raw: data } };
            }
            case 'replyToComment': {
                const data = await v3('POST', '/comments?part=snippet', {
                    snippet: {
                        parentId: inputs.parentId,
                        textOriginal: inputs.text,
                    },
                });
                return { output: { comment: data, raw: data } };
            }
            case 'searchVideos': {
                const params = new URLSearchParams({
                    part: inputs.part || 'snippet',
                    type: inputs.type || 'video',
                    q: inputs.query || '',
                });
                if (inputs.channelId) params.set('channelId', inputs.channelId);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.order) params.set('order', inputs.order);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const data = await v3('GET', `/search?${params}`);
                return { output: { results: data.items, nextPageToken: data.nextPageToken, pageInfo: data.pageInfo, raw: data } };
            }
            default:
                return { error: `YouTubeAnalytics: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger?.log(`[YouTubeAnalytics] Error: ${err.message}`);
        return { error: err.message ?? 'YouTubeAnalytics action failed' };
    }
}
