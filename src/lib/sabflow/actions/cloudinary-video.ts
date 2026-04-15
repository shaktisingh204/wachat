'use server';

export async function executeCloudinaryVideoAction(actionName: string, inputs: any, user: any, logger: any) {
    const cloudName = inputs.cloudName;
    const BASE_URL = `https://api.cloudinary.com/v1_1/${cloudName}`;
    const credentials = Buffer.from(`${inputs.apiKey}:${inputs.apiSecret}`).toString('base64');
    const authHeaders: Record<string, string> = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'uploadVideo': {
                const timestamp = Math.floor(Date.now() / 1000);
                const body: Record<string, any> = {
                    file: inputs.file,
                    timestamp,
                    api_key: inputs.apiKey,
                    resource_type: 'video',
                };
                if (inputs.public_id) body.public_id = inputs.public_id;
                if (inputs.folder) body.folder = inputs.folder;
                if (inputs.overwrite !== undefined) body.overwrite = inputs.overwrite;
                if (inputs.tags) body.tags = inputs.tags;
                if (inputs.eager) body.eager = inputs.eager;
                const formData = new URLSearchParams();
                for (const [k, v] of Object.entries(body)) formData.append(k, String(v));
                const res = await fetch(`${BASE_URL}/video/upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString(),
                });
                if (!res.ok) return { error: `Cloudinary uploadVideo failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getVideoDetails': {
                const res = await fetch(`${BASE_URL}/resources/video/${inputs.public_id}`, { headers: authHeaders });
                if (!res.ok) return { error: `Cloudinary getVideoDetails failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listVideos': {
                const params = new URLSearchParams({ resource_type: 'video' });
                if (inputs.type) params.append('type', inputs.type);
                if (inputs.prefix) params.append('prefix', inputs.prefix);
                if (inputs.max_results) params.append('max_results', String(inputs.max_results));
                if (inputs.next_cursor) params.append('next_cursor', inputs.next_cursor);
                if (inputs.tags !== undefined) params.append('tags', String(inputs.tags));
                if (inputs.context !== undefined) params.append('context', String(inputs.context));
                const res = await fetch(`${BASE_URL}/resources/video?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Cloudinary listVideos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteVideo': {
                const res = await fetch(`${BASE_URL}/resources/video/upload`, {
                    method: 'DELETE',
                    headers: authHeaders,
                    body: JSON.stringify({ public_ids: Array.isArray(inputs.public_ids) ? inputs.public_ids : [inputs.public_id] }),
                });
                if (!res.ok) return { error: `Cloudinary deleteVideo failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'transformVideo': {
                const transformations = inputs.transformation || inputs.transformations || [];
                const eagerList = Array.isArray(transformations) ? transformations.join('/') : transformations;
                const params = new URLSearchParams({ public_id: inputs.public_id });
                if (eagerList) params.append('eager', eagerList);
                if (inputs.eager_async !== undefined) params.append('eager_async', String(inputs.eager_async));
                const res = await fetch(`${BASE_URL}/resources/video/upload/${inputs.public_id}`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ eager: eagerList }),
                });
                if (!res.ok) return { error: `Cloudinary transformVideo failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'generateVideoThumbnail': {
                const publicId = inputs.public_id;
                const time = inputs.time || 'auto';
                const width = inputs.width || 400;
                const height = inputs.height || 300;
                const thumbnailUrl = `https://res.cloudinary.com/${cloudName}/video/upload/so_${time},w_${width},h_${height}/${publicId}.jpg`;
                return { output: { thumbnailUrl, public_id: publicId, time, width, height } };
            }

            case 'createVideoPlaylist': {
                const res = await fetch(`${BASE_URL}/video/playlists`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        title: inputs.title,
                        public_ids: inputs.public_ids,
                        description: inputs.description || '',
                    }),
                });
                if (!res.ok) return { error: `Cloudinary createVideoPlaylist failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'addCaptions': {
                const transformationString = `l_subtitles:${inputs.subtitle_public_id || inputs.captions_public_id}`;
                const captionedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${transformationString}/${inputs.public_id}.mp4`;
                return { output: { captionedUrl, public_id: inputs.public_id, transformation: transformationString } };
            }

            case 'transcodeVideo': {
                const body = {
                    public_id: inputs.public_id,
                    eager: inputs.format ? `f_${inputs.format}` : 'f_mp4',
                    eager_async: inputs.async !== false,
                    notification_url: inputs.notification_url || undefined,
                };
                const res = await fetch(`${BASE_URL}/resources/video/upload/${inputs.public_id}`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Cloudinary transcodeVideo failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'streamVideo': {
                const hlsUrl = `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${inputs.public_id}.m3u8`;
                const dashUrl = `https://res.cloudinary.com/${cloudName}/video/upload/sp_auto/${inputs.public_id}.mpd`;
                return { output: { hlsUrl, dashUrl, public_id: inputs.public_id } };
            }

            case 'getVideoAnalytics': {
                const params = new URLSearchParams({ resource_type: 'video', public_id: inputs.public_id });
                if (inputs.from_date) params.append('from_date', inputs.from_date);
                if (inputs.to_date) params.append('to_date', inputs.to_date);
                const res = await fetch(`${BASE_URL}/resources/video/upload/${inputs.public_id}?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Cloudinary getVideoAnalytics failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createAdaptiveStream': {
                const body = {
                    public_id: inputs.public_id,
                    streaming_profile: inputs.streaming_profile || 'auto',
                    eager_async: true,
                    eager_notification_url: inputs.notification_url || undefined,
                };
                const res = await fetch(`${BASE_URL}/video/upload`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Cloudinary createAdaptiveStream failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'downloadVideo': {
                const format = inputs.format || 'mp4';
                const transformation = inputs.transformation || '';
                const downloadUrl = transformation
                    ? `https://res.cloudinary.com/${cloudName}/video/upload/${transformation}/fl_attachment/${inputs.public_id}.${format}`
                    : `https://res.cloudinary.com/${cloudName}/video/upload/fl_attachment/${inputs.public_id}.${format}`;
                return { output: { downloadUrl, public_id: inputs.public_id, format } };
            }

            case 'listTransformations': {
                const params = new URLSearchParams({ resource_type: 'video' });
                if (inputs.named !== undefined) params.append('named', String(inputs.named));
                if (inputs.max_results) params.append('max_results', String(inputs.max_results));
                if (inputs.next_cursor) params.append('next_cursor', inputs.next_cursor);
                const res = await fetch(`${BASE_URL}/transformations?${params}`, { headers: authHeaders });
                if (!res.ok) return { error: `Cloudinary listTransformations failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getVideoUsage': {
                const res = await fetch(`${BASE_URL}/usage`, { headers: authHeaders });
                if (!res.ok) return { error: `Cloudinary getVideoUsage failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { usage: data, video_storage: data?.storage, transformations: data?.transformations } };
            }

            default:
                return { error: `Cloudinary Video action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Cloudinary Video action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Cloudinary Video action.' };
    }
}
