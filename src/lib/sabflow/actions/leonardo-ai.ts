'use server';

const LEONARDO_BASE = 'https://cloud.leonardo.ai/api/rest/v1';

async function leoGet(apiKey: string, path: string, logger: any) {
    logger.log(`[LeonardoAI] GET ${path}`);
    const res = await fetch(`${LEONARDO_BASE}${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || `Leonardo AI error: ${res.status}`);
    return data;
}

async function leoPost(apiKey: string, path: string, body: any, logger: any) {
    logger.log(`[LeonardoAI] POST ${path}`);
    const res = await fetch(`${LEONARDO_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || `Leonardo AI error: ${res.status}`);
    return data;
}

async function leoDelete(apiKey: string, path: string, logger: any) {
    logger.log(`[LeonardoAI] DELETE ${path}`);
    const res = await fetch(`${LEONARDO_BASE}${path}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
    });
    if (res.status === 204) return { success: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || `Leonardo AI error: ${res.status}`);
    return data;
}

export async function executeLeonardoAiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        if (!apiKey) throw new Error('Leonardo AI apiKey is required');

        switch (actionName) {
            case 'createGeneration': {
                const { prompt, modelId, width, height, numImages, negativePrompt, guidanceScale, inferenceSteps, seed, scheduler, presetStyle, isPublic, photoRealStrength, highResolution, alchemy } = inputs;
                if (!prompt) throw new Error('prompt is required');
                const body: any = { prompt };
                if (modelId) body.modelId = modelId;
                if (width) body.width = width;
                if (height) body.height = height;
                if (numImages) body.num_images = numImages;
                if (negativePrompt) body.negative_prompt = negativePrompt;
                if (guidanceScale !== undefined) body.guidance_scale = guidanceScale;
                if (inferenceSteps) body.num_inference_steps = inferenceSteps;
                if (seed !== undefined) body.seed = seed;
                if (scheduler) body.scheduler = scheduler;
                if (presetStyle) body.presetStyle = presetStyle;
                if (isPublic !== undefined) body.public = isPublic;
                if (photoRealStrength !== undefined) body.photoRealStrength = photoRealStrength;
                if (highResolution !== undefined) body.highResolution = highResolution;
                if (alchemy !== undefined) body.alchemy = alchemy;
                const data = await leoPost(apiKey, '/generations', body, logger);
                return { output: data };
            }
            case 'getGeneration': {
                const { generationId } = inputs;
                if (!generationId) throw new Error('generationId is required');
                const data = await leoGet(apiKey, `/generations/${generationId}`, logger);
                return { output: data };
            }
            case 'deleteGeneration': {
                const { generationId } = inputs;
                if (!generationId) throw new Error('generationId is required');
                const data = await leoDelete(apiKey, `/generations/${generationId}`, logger);
                return { output: data };
            }
            case 'listGenerations': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params}` : '';
                const data = await leoGet(apiKey, `/generations/user/me${qs}`, logger);
                return { output: data };
            }
            case 'upscaleImage': {
                const { generatedImageId } = inputs;
                if (!generatedImageId) throw new Error('generatedImageId is required');
                const body: any = { generatedImageId };
                const data = await leoPost(apiKey, '/variations/upscale', body, logger);
                return { output: data };
            }
            case 'createVariation': {
                const { generatedImageId, variationType } = inputs;
                if (!generatedImageId) throw new Error('generatedImageId is required');
                const body: any = { generatedImageId };
                if (variationType) body.variationType = variationType;
                const data = await leoPost(apiKey, '/variations', body, logger);
                return { output: data };
            }
            case 'createOutpaintingVariation': {
                const { generatedImageId } = inputs;
                if (!generatedImageId) throw new Error('generatedImageId is required');
                const data = await leoPost(apiKey, '/variations/outpainting', { generatedImageId }, logger);
                return { output: data };
            }
            case 'createUnzoomVariation': {
                const { generatedImageId } = inputs;
                if (!generatedImageId) throw new Error('generatedImageId is required');
                const data = await leoPost(apiKey, '/variations/unzoom', { generatedImageId }, logger);
                return { output: data };
            }
            case 'listModels': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params}` : '';
                const data = await leoGet(apiKey, `/platformModels${qs}`, logger);
                return { output: data };
            }
            case 'getModel': {
                const { modelId } = inputs;
                if (!modelId) throw new Error('modelId is required');
                const data = await leoGet(apiKey, `/models/${modelId}`, logger);
                return { output: data };
            }
            case 'createDataset': {
                const { name, description } = inputs;
                if (!name) throw new Error('name is required');
                const body: any = { name };
                if (description) body.description = description;
                const data = await leoPost(apiKey, '/datasets', body, logger);
                return { output: data };
            }
            case 'addImageToDataset': {
                const { datasetId, imageBase64, b64 } = inputs;
                if (!datasetId) throw new Error('datasetId is required');
                const body: any = {};
                if (imageBase64) body.imageBase64 = imageBase64;
                if (b64) body.b64 = b64;
                const data = await leoPost(apiKey, `/datasets/${datasetId}/upload/init`, body, logger);
                return { output: data };
            }
            case 'trainModel': {
                const { datasetId, instancePrompt, modelType, name, description, strength, resolution, sd_version } = inputs;
                if (!datasetId || !instancePrompt) throw new Error('datasetId and instancePrompt are required');
                const body: any = { datasetId, instancePrompt };
                if (modelType) body.modelType = modelType;
                if (name) body.name = name;
                if (description) body.description = description;
                if (strength) body.strength = strength;
                if (resolution) body.resolution = resolution;
                if (sd_version) body.sd_Version = sd_version;
                const data = await leoPost(apiKey, '/models', body, logger);
                return { output: data };
            }
            case 'listElements': {
                const data = await leoGet(apiKey, '/elements', logger);
                return { output: data };
            }
            case 'getUserInfo': {
                const data = await leoGet(apiKey, '/me', logger);
                return { output: data };
            }
            default:
                return { error: `Leonardo AI action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`[LeonardoAI] Error: ${err.message}`);
        return { error: err.message };
    }
}
