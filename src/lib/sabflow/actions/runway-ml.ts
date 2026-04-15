'use server';

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_VERSION = '2024-11-06';

async function rwGet(apiKey: string, path: string, logger: any) {
    logger.log(`[RunwayML] GET ${path}`);
    const res = await fetch(`${RUNWAY_BASE}${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Runway-Version': RUNWAY_VERSION,
            'Content-Type': 'application/json',
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || `Runway ML API error: ${res.status}`);
    return data;
}

async function rwPost(apiKey: string, path: string, body: any, logger: any) {
    logger.log(`[RunwayML] POST ${path}`);
    const res = await fetch(`${RUNWAY_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Runway-Version': RUNWAY_VERSION,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || `Runway ML API error: ${res.status}`);
    return data;
}

async function rwDelete(apiKey: string, path: string, logger: any) {
    logger.log(`[RunwayML] DELETE ${path}`);
    const res = await fetch(`${RUNWAY_BASE}${path}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Runway-Version': RUNWAY_VERSION,
        },
    });
    if (res.status === 204) return { success: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || `Runway ML API error: ${res.status}`);
    return data;
}

export async function executeRunwayMlAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        if (!apiKey) throw new Error('Runway ML apiKey is required');

        switch (actionName) {
            case 'generateImageToVideo': {
                const { promptImage, promptText, model, duration, ratio, seed, watermark } = inputs;
                if (!promptImage) throw new Error('promptImage is required');
                const body: any = { promptImage };
                if (promptText) body.promptText = promptText;
                if (model) body.model = model;
                if (duration !== undefined) body.duration = duration;
                if (ratio) body.ratio = ratio;
                if (seed !== undefined) body.seed = seed;
                if (watermark !== undefined) body.watermark = watermark;
                const data = await rwPost(apiKey, '/image_to_video', body, logger);
                return { output: data };
            }
            case 'generateTextToVideo': {
                const { promptText, model, duration, ratio, seed, watermark } = inputs;
                if (!promptText) throw new Error('promptText is required');
                const body: any = { promptText };
                if (model) body.model = model;
                if (duration !== undefined) body.duration = duration;
                if (ratio) body.ratio = ratio;
                if (seed !== undefined) body.seed = seed;
                if (watermark !== undefined) body.watermark = watermark;
                const data = await rwPost(apiKey, '/text_to_video', body, logger);
                return { output: data };
            }
            case 'getTask': {
                const { taskId } = inputs;
                if (!taskId) throw new Error('taskId is required');
                const data = await rwGet(apiKey, `/tasks/${taskId}`, logger);
                return { output: data };
            }
            case 'cancelTask': {
                const { taskId } = inputs;
                if (!taskId) throw new Error('taskId is required');
                const data = await rwDelete(apiKey, `/tasks/${taskId}`, logger);
                return { output: data };
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.status) params.set('status', inputs.status);
                const qs = params.toString() ? `?${params}` : '';
                const data = await rwGet(apiKey, `/tasks${qs}`, logger);
                return { output: data };
            }
            case 'generateTextToImage': {
                const { promptText, model, width, height, seed, numOutputs } = inputs;
                if (!promptText) throw new Error('promptText is required');
                const body: any = { promptText };
                if (model) body.model = model;
                if (width) body.width = width;
                if (height) body.height = height;
                if (seed !== undefined) body.seed = seed;
                if (numOutputs) body.numOutputs = numOutputs;
                const data = await rwPost(apiKey, '/text_to_image', body, logger);
                return { output: data };
            }
            case 'generateImageVariation': {
                const { promptImage, promptText, model, numOutputs, seed } = inputs;
                if (!promptImage) throw new Error('promptImage is required');
                const body: any = { promptImage };
                if (promptText) body.promptText = promptText;
                if (model) body.model = model;
                if (numOutputs) body.numOutputs = numOutputs;
                if (seed !== undefined) body.seed = seed;
                const data = await rwPost(apiKey, '/image_variation', body, logger);
                return { output: data };
            }
            case 'upscaleVideo': {
                const { videoUrl, model } = inputs;
                if (!videoUrl) throw new Error('videoUrl is required');
                const body: any = { videoUrl };
                if (model) body.model = model;
                const data = await rwPost(apiKey, '/upscale_video', body, logger);
                return { output: data };
            }
            case 'interpolateFrames': {
                const { frames, model } = inputs;
                if (!frames || !Array.isArray(frames)) throw new Error('frames array is required');
                const body: any = { frames };
                if (model) body.model = model;
                const data = await rwPost(apiKey, '/interpolate', body, logger);
                return { output: data };
            }
            case 'removeBackground': {
                const { promptImage, returnMask } = inputs;
                if (!promptImage) throw new Error('promptImage is required');
                const body: any = { promptImage };
                if (returnMask !== undefined) body.returnMask = returnMask;
                const data = await rwPost(apiKey, '/remove_background', body, logger);
                return { output: data };
            }
            case 'trackObjects': {
                const { promptImage, objects } = inputs;
                if (!promptImage) throw new Error('promptImage is required');
                const body: any = { promptImage };
                if (objects) body.objects = objects;
                const data = await rwPost(apiKey, '/track_objects', body, logger);
                return { output: data };
            }
            case 'inpaintVideo': {
                const { videoUrl, maskUrl, promptText, model } = inputs;
                if (!videoUrl || !maskUrl) throw new Error('videoUrl and maskUrl are required');
                const body: any = { videoUrl, maskUrl };
                if (promptText) body.promptText = promptText;
                if (model) body.model = model;
                const data = await rwPost(apiKey, '/inpaint_video', body, logger);
                return { output: data };
            }
            case 'eraseObject': {
                const { promptImage, maskImage } = inputs;
                if (!promptImage || !maskImage) throw new Error('promptImage and maskImage are required');
                const body: any = { promptImage, maskImage };
                const data = await rwPost(apiKey, '/erase_object', body, logger);
                return { output: data };
            }
            case 'generateMotionBrush': {
                const { promptImage, motionVectors, model, duration, ratio } = inputs;
                if (!promptImage) throw new Error('promptImage is required');
                const body: any = { promptImage };
                if (motionVectors) body.motionVectors = motionVectors;
                if (model) body.model = model;
                if (duration !== undefined) body.duration = duration;
                if (ratio) body.ratio = ratio;
                const data = await rwPost(apiKey, '/motion_brush', body, logger);
                return { output: data };
            }
            case 'listModels': {
                const data = await rwGet(apiKey, '/models', logger);
                return { output: data };
            }
            default:
                return { error: `Runway ML action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`[RunwayML] Error: ${err.message}`);
        return { error: err.message };
    }
}
