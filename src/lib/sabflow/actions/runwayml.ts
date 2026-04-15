'use server';

export async function executeRunwayMLAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const baseUrl = 'https://api.dev.runwayml.com/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'X-Runway-Version': '2024-09-13',
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'createImageToVideoTask': {
                const body: any = {
                    model: inputs.model || 'gen3a_turbo',
                    promptImage: inputs.promptImage || inputs.imageUrl,
                    promptText: inputs.promptText || inputs.prompt || '',
                };
                if (inputs.duration) body.duration = inputs.duration;
                if (inputs.ratio) body.ratio = inputs.ratio;
                if (inputs.seed !== undefined) body.seed = inputs.seed;
                if (inputs.watermark !== undefined) body.watermark = inputs.watermark;
                const res = await fetch(`${baseUrl}/image_to_video`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'createImageToVideoTask failed' };
                return { output: data };
            }

            case 'createTextToVideoTask': {
                const body: any = {
                    model: inputs.model || 'gen3a_turbo',
                    promptText: inputs.promptText || inputs.prompt || '',
                };
                if (inputs.duration) body.duration = inputs.duration;
                if (inputs.ratio) body.ratio = inputs.ratio;
                if (inputs.seed !== undefined) body.seed = inputs.seed;
                if (inputs.watermark !== undefined) body.watermark = inputs.watermark;
                const res = await fetch(`${baseUrl}/text_to_video`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'createTextToVideoTask failed' };
                return { output: data };
            }

            case 'getTask': {
                const taskId = inputs.taskId || inputs.id;
                const res = await fetch(`${baseUrl}/tasks/${taskId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'getTask failed' };
                return { output: data };
            }

            case 'cancelTask': {
                const taskId = inputs.taskId || inputs.id;
                const res = await fetch(`${baseUrl}/tasks/${taskId}/cancel`, { method: 'POST', headers, body: JSON.stringify({}) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'cancelTask failed' };
                return { output: data };
            }

            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.status) params.set('status', inputs.status);
                const url = `${baseUrl}/tasks${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'listTasks failed' };
                return { output: data };
            }

            case 'getOrganization': {
                const res = await fetch(`${baseUrl}/organization`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'getOrganization failed' };
                return { output: data };
            }

            case 'listModels': {
                const res = await fetch(`${baseUrl}/models`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'listModels failed' };
                return { output: data };
            }

            case 'uploadAsset': {
                const body: any = {
                    filename: inputs.filename || 'asset',
                    contentType: inputs.contentType || 'image/png',
                };
                const res = await fetch(`${baseUrl}/assets`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'uploadAsset failed' };
                // If uploadUrl provided, upload the binary
                if (data.uploadUrl && inputs.assetBase64) {
                    const buf = Buffer.from(inputs.assetBase64, 'base64');
                    await fetch(data.uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': inputs.contentType || 'image/png' },
                        body: buf,
                    });
                }
                return { output: data };
            }

            case 'getAsset': {
                const assetId = inputs.assetId || inputs.id;
                const res = await fetch(`${baseUrl}/assets/${assetId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'getAsset failed' };
                return { output: data };
            }

            case 'deleteAsset': {
                const assetId = inputs.assetId || inputs.id;
                const res = await fetch(`${baseUrl}/assets/${assetId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, assetId } };
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'deleteAsset failed' };
                return { output: data };
            }

            case 'getTaskResult': {
                const taskId = inputs.taskId || inputs.id;
                const res = await fetch(`${baseUrl}/tasks/${taskId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'getTaskResult failed' };
                return { output: { status: data.status, output: data.output, progress: data.progress, taskData: data } };
            }

            case 'pollUntilComplete': {
                const taskId = inputs.taskId || inputs.id;
                const maxAttempts = inputs.maxAttempts || 30;
                const intervalMs = inputs.intervalMs || 5000;
                let attempts = 0;
                let lastData: any = null;
                while (attempts < maxAttempts) {
                    const res = await fetch(`${baseUrl}/tasks/${taskId}`, { method: 'GET', headers });
                    lastData = await res.json();
                    if (!res.ok) return { error: lastData.error || lastData.message || 'pollUntilComplete fetch failed' };
                    if (lastData.status === 'SUCCEEDED' || lastData.status === 'FAILED' || lastData.status === 'CANCELLED') {
                        break;
                    }
                    attempts++;
                    await new Promise((r) => setTimeout(r, intervalMs));
                }
                return { output: { status: lastData?.status, output: lastData?.output, attempts, taskData: lastData } };
            }

            case 'createMotionBrush': {
                const body: any = {
                    model: inputs.model || 'gen3a_turbo',
                    promptImage: inputs.promptImage || inputs.imageUrl,
                    motionBrush: inputs.motionBrush || [],
                };
                if (inputs.duration) body.duration = inputs.duration;
                if (inputs.ratio) body.ratio = inputs.ratio;
                if (inputs.seed !== undefined) body.seed = inputs.seed;
                const res = await fetch(`${baseUrl}/image_to_video`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'createMotionBrush failed' };
                return { output: data };
            }

            case 'upscaleVideo': {
                const body: any = {
                    videoUrl: inputs.videoUrl || inputs.url,
                };
                if (inputs.targetWidth) body.targetWidth = inputs.targetWidth;
                if (inputs.targetHeight) body.targetHeight = inputs.targetHeight;
                const res = await fetch(`${baseUrl}/video_upscale`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'upscaleVideo failed' };
                return { output: data };
            }

            case 'interpolateFrames': {
                const body: any = {
                    frames: inputs.frames || [],
                    model: inputs.model || 'gen3a_turbo',
                };
                if (inputs.fps) body.fps = inputs.fps;
                if (inputs.duration) body.duration = inputs.duration;
                const res = await fetch(`${baseUrl}/interpolation`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || data.message || 'interpolateFrames failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown RunwayML action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeRunwayMLAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeRunwayMLAction' };
    }
}
