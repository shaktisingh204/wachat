'use server';

export async function executeMuxAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const tokenId = inputs.tokenId;
        const tokenSecret = inputs.tokenSecret;

        if (!tokenId || !tokenSecret) {
            return { error: 'Missing required credentials: tokenId and tokenSecret' };
        }

        const baseUrl = 'https://api.mux.com';
        const authHeader = `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`;

        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { headers });
            if (!res.ok) return { error: `Mux API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Mux API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const put = async (path: string, body: any) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
            if (!res.ok) return { error: `Mux API error: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const del = async (path: string) => {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (!res.ok) return { error: `Mux API error: ${res.status} ${await res.text()}` };
            return { output: { success: true } };
        };

        switch (actionName) {
            case 'listAssets': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.live_stream_id) params.set('live_stream_id', inputs.live_stream_id);
                if (inputs.upload_id) params.set('upload_id', inputs.upload_id);
                return get(`/video/v1/assets?${params}`);
            }

            case 'getAsset': {
                if (!inputs.assetId) return { error: 'Missing required input: assetId' };
                return get(`/video/v1/assets/${inputs.assetId}`);
            }

            case 'createAsset': {
                const body: any = {};
                if (inputs.input) body.input = inputs.input;
                if (inputs.playback_policy) body.playback_policy = inputs.playback_policy;
                if (inputs.passthrough) body.passthrough = inputs.passthrough;
                if (inputs.mp4_support) body.mp4_support = inputs.mp4_support;
                if (inputs.normalize_audio !== undefined) body.normalize_audio = inputs.normalize_audio;
                return post('/video/v1/assets', body);
            }

            case 'deleteAsset': {
                if (!inputs.assetId) return { error: 'Missing required input: assetId' };
                return del(`/video/v1/assets/${inputs.assetId}`);
            }

            case 'getAssetInputInfo': {
                if (!inputs.assetId) return { error: 'Missing required input: assetId' };
                return get(`/video/v1/assets/${inputs.assetId}/input-info`);
            }

            case 'listLiveStreams': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.status) params.set('status', inputs.status);
                return get(`/video/v1/live-streams?${params}`);
            }

            case 'getLiveStream': {
                if (!inputs.liveStreamId) return { error: 'Missing required input: liveStreamId' };
                return get(`/video/v1/live-streams/${inputs.liveStreamId}`);
            }

            case 'createLiveStream': {
                const body: any = {};
                if (inputs.playback_policy) body.playback_policy = inputs.playback_policy;
                if (inputs.new_asset_settings) body.new_asset_settings = inputs.new_asset_settings;
                if (inputs.reconnect_window) body.reconnect_window = inputs.reconnect_window;
                if (inputs.reduced_latency !== undefined) body.reduced_latency = inputs.reduced_latency;
                if (inputs.passthrough) body.passthrough = inputs.passthrough;
                return post('/video/v1/live-streams', body);
            }

            case 'deleteLiveStream': {
                if (!inputs.liveStreamId) return { error: 'Missing required input: liveStreamId' };
                return del(`/video/v1/live-streams/${inputs.liveStreamId}`);
            }

            case 'signPlaybackId': {
                if (!inputs.playbackId || !inputs.keyId || !inputs.keySecret) {
                    return { error: 'Missing required inputs: playbackId, keyId, keySecret' };
                }
                // Build a signed URL token using the Mux signing key
                const now = Math.floor(Date.now() / 1000);
                const payload = {
                    sub: inputs.playbackId,
                    aud: inputs.audience || 'v',
                    exp: now + (inputs.expiry || 86400),
                    kid: inputs.keyId,
                };
                // Return the payload; actual JWT signing must be done with a proper JWT lib in production
                return { output: { note: 'Use a JWT library with keySecret to sign this payload', payload } };
            }

            case 'listPlaybackIds': {
                if (!inputs.assetId) return { error: 'Missing required input: assetId' };
                return get(`/video/v1/assets/${inputs.assetId}/playback-ids`);
            }

            case 'createPlaybackId': {
                if (!inputs.assetId) return { error: 'Missing required input: assetId' };
                const body: any = {};
                if (inputs.policy) body.policy = inputs.policy;
                return post(`/video/v1/assets/${inputs.assetId}/playback-ids`, body);
            }

            case 'deletePlaybackId': {
                if (!inputs.assetId || !inputs.playbackId) {
                    return { error: 'Missing required inputs: assetId and playbackId' };
                }
                return del(`/video/v1/assets/${inputs.assetId}/playback-ids/${inputs.playbackId}`);
            }

            case 'getUpload': {
                if (!inputs.uploadId) return { error: 'Missing required input: uploadId' };
                return get(`/video/v1/uploads/${inputs.uploadId}`);
            }

            case 'createUpload': {
                const body: any = {};
                if (inputs.cors_origin) body.cors_origin = inputs.cors_origin;
                if (inputs.new_asset_settings) body.new_asset_settings = inputs.new_asset_settings;
                if (inputs.timeout) body.timeout = inputs.timeout;
                if (inputs.test !== undefined) body.test = inputs.test;
                return post('/video/v1/uploads', body);
            }

            default:
                return { error: `Unknown Mux action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeMuxAction error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeMuxAction' };
    }
}
