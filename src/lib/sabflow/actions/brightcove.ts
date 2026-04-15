'use server';

export async function executeBrightcoveAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const clientId = inputs.clientId;
        const clientSecret = inputs.clientSecret;
        const accountId = inputs.accountId;

        if (!clientId || !clientSecret) {
            return { error: 'Missing required credentials: clientId and clientSecret' };
        }
        if (!accountId) {
            return { error: 'Missing required input: accountId' };
        }

        // Obtain OAuth2 access token
        const tokenRes = await fetch('https://oauth.brightcove.com/v4/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });
        if (!tokenRes.ok) {
            return { error: `Brightcove OAuth error: ${tokenRes.status} ${await tokenRes.text()}` };
        }
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const baseUrl = `https://cms.api.brightcove.com/v1/accounts/${accountId}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { headers });
            if (!res.ok) return { error: `Brightcove API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Brightcove API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const patch = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Brightcove API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const del = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (!res.ok) return { error: `Brightcove API error: ${res.status} ${await res.text()}` };
            return { output: { success: true } };
        };

        switch (actionName) {
            case 'listVideos': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.sort) params.set('sort', inputs.sort);
                if (inputs.q) params.set('q', inputs.q);
                return get(`/videos?${params}`);
            }

            case 'getVideo': {
                if (!inputs.videoId) return { error: 'Missing required input: videoId' };
                return get(`/videos/${inputs.videoId}`);
            }

            case 'createVideo': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.long_description) body.long_description = inputs.long_description;
                if (inputs.state) body.state = inputs.state;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.custom_fields) body.custom_fields = inputs.custom_fields;
                return post('/videos', body);
            }

            case 'updateVideo': {
                if (!inputs.videoId) return { error: 'Missing required input: videoId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.state) body.state = inputs.state;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.custom_fields) body.custom_fields = inputs.custom_fields;
                return patch(`/videos/${inputs.videoId}`, body);
            }

            case 'deleteVideo': {
                if (!inputs.videoId) return { error: 'Missing required input: videoId' };
                return del(`/videos/${inputs.videoId}`);
            }

            case 'listPlaylists': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.sort) params.set('sort', inputs.sort);
                return get(`/playlists?${params}`);
            }

            case 'getPlaylist': {
                if (!inputs.playlistId) return { error: 'Missing required input: playlistId' };
                return get(`/playlists/${inputs.playlistId}`);
            }

            case 'createPlaylist': {
                if (!inputs.name || !inputs.type) return { error: 'Missing required inputs: name and type' };
                const body: any = { name: inputs.name, type: inputs.type };
                if (inputs.description) body.description = inputs.description;
                if (inputs.video_ids) body.video_ids = inputs.video_ids;
                if (inputs.search) body.search = inputs.search;
                return post('/playlists', body);
            }

            case 'updatePlaylist': {
                if (!inputs.playlistId) return { error: 'Missing required input: playlistId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.type) body.type = inputs.type;
                if (inputs.description) body.description = inputs.description;
                if (inputs.video_ids) body.video_ids = inputs.video_ids;
                return patch(`/playlists/${inputs.playlistId}`, body);
            }

            case 'deletePlaylist': {
                if (!inputs.playlistId) return { error: 'Missing required input: playlistId' };
                return del(`/playlists/${inputs.playlistId}`);
            }

            case 'getVideoSources': {
                if (!inputs.videoId) return { error: 'Missing required input: videoId' };
                return get(`/videos/${inputs.videoId}/sources`);
            }

            case 'listFolders': {
                return get('/folders');
            }

            case 'getVideoCount': {
                const params = new URLSearchParams();
                if (inputs.q) params.set('q', inputs.q);
                return get(`/counts/videos?${params}`);
            }

            case 'listCustomFields': {
                return get('/video_fields');
            }

            case 'searchVideos': {
                if (!inputs.q) return { error: 'Missing required input: q (search query)' };
                const params = new URLSearchParams({ q: inputs.q });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.sort) params.set('sort', inputs.sort);
                return get(`/videos?${params}`);
            }

            default:
                return { error: `Unknown Brightcove action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeBrightcoveAction error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeBrightcoveAction' };
    }
}
