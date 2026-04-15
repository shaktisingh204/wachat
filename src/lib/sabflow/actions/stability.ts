
'use server';

const STABILITY_BASE = 'https://api.stability.ai';

async function stabilityGet(apiKey: string, path: string, logger: any) {
    logger.log(`[Stability] GET ${path}`);
    const res = await fetch(`${STABILITY_BASE}${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.name || `Stability AI error: ${res.status}`);
    }
    return data;
}

async function stabilityPost(apiKey: string, path: string, body: any, logger: any) {
    logger.log(`[Stability] POST ${path}`);
    const res = await fetch(`${STABILITY_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.name || `Stability AI error: ${res.status}`);
    }
    return data;
}

async function stabilityPostMultipart(apiKey: string, path: string, formData: FormData, logger: any) {
    logger.log(`[Stability] POST multipart ${path}`);
    const res = await fetch(`${STABILITY_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
        body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.name || `Stability AI error: ${res.status}`);
    }
    return data;
}

function base64ToBlob(base64: string, contentType = 'image/png'): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
}

export async function executeStabilityAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'textToImage': {
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const engineId = inputs.engineId ? String(inputs.engineId).trim() : 'stable-diffusion-v1-6';

                const body: any = {
                    text_prompts: [
                        { text: prompt, weight: 1 },
                        { text: inputs.negativePrompt ? String(inputs.negativePrompt).trim() : '', weight: -1 },
                    ],
                    cfg_scale: inputs.cfgScale !== undefined ? Number(inputs.cfgScale) : 7,
                    height: inputs.height !== undefined ? Number(inputs.height) : 512,
                    width: inputs.width !== undefined ? Number(inputs.width) : 512,
                    steps: inputs.steps !== undefined ? Number(inputs.steps) : 30,
                    samples: inputs.samples !== undefined ? Number(inputs.samples) : 1,
                    seed: inputs.seed !== undefined ? Number(inputs.seed) : 0,
                };
                if (inputs.stylePreset) body.style_preset = String(inputs.stylePreset).trim();

                logger.log(`[Stability] textToImage: engine=${engineId}, ${body.width}x${body.height}`);
                const data = await stabilityPost(apiKey, `/v1/generation/${engineId}/text-to-image`, body, logger);
                return { output: { artifacts: data.artifacts ?? [] } };
            }

            case 'imageToImage': {
                const prompt = String(inputs.prompt ?? '').trim();
                const initImageBase64 = String(inputs.initImageBase64 ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                if (!initImageBase64) throw new Error('initImageBase64 is required.');
                const engineId = inputs.engineId ? String(inputs.engineId).trim() : 'stable-diffusion-v1-6';

                const formData = new FormData();
                formData.append('init_image', base64ToBlob(initImageBase64), 'init_image.png');
                formData.append('text_prompts[0][text]', prompt);
                formData.append('text_prompts[0][weight]', '1');
                if (inputs.negativePrompt) {
                    formData.append('text_prompts[1][text]', String(inputs.negativePrompt).trim());
                    formData.append('text_prompts[1][weight]', '-1');
                }
                formData.append('image_strength', String(inputs.imageStrength !== undefined ? Number(inputs.imageStrength) : 0.35));
                formData.append('cfg_scale', String(inputs.cfgScale !== undefined ? Number(inputs.cfgScale) : 7));
                formData.append('steps', String(inputs.steps !== undefined ? Number(inputs.steps) : 30));
                formData.append('samples', String(inputs.samples !== undefined ? Number(inputs.samples) : 1));

                logger.log(`[Stability] imageToImage: engine=${engineId}`);
                const data = await stabilityPostMultipart(apiKey, `/v1/generation/${engineId}/image-to-image`, formData, logger);
                return { output: { artifacts: data.artifacts ?? [] } };
            }

            case 'upscale': {
                const imageBase64 = String(inputs.imageBase64 ?? '').trim();
                const width = Number(inputs.width ?? 1024);
                if (!imageBase64) throw new Error('imageBase64 is required.');

                const formData = new FormData();
                formData.append('image', base64ToBlob(imageBase64), 'image.png');
                formData.append('width', String(width));

                logger.log(`[Stability] upscale: width=${width}`);
                const data = await stabilityPostMultipart(apiKey, '/v1/generation/esrgan-v1-x2plus/image-to-image/upscale', formData, logger);
                return { output: { artifacts: data.artifacts ?? [] } };
            }

            case 'inpaint': {
                const prompt = String(inputs.prompt ?? '').trim();
                const initImageBase64 = String(inputs.initImageBase64 ?? '').trim();
                const maskImageBase64 = String(inputs.maskImageBase64 ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                if (!initImageBase64) throw new Error('initImageBase64 is required.');
                if (!maskImageBase64) throw new Error('maskImageBase64 is required.');
                const engineId = inputs.engineId ? String(inputs.engineId).trim() : 'stable-diffusion-v1-6';

                const formData = new FormData();
                formData.append('init_image', base64ToBlob(initImageBase64), 'init_image.png');
                formData.append('mask_image', base64ToBlob(maskImageBase64), 'mask_image.png');
                formData.append('text_prompts[0][text]', prompt);
                formData.append('text_prompts[0][weight]', '1');
                formData.append('mask_source', 'MASK_IMAGE_WHITE');

                logger.log(`[Stability] inpaint: engine=${engineId}`);
                const data = await stabilityPostMultipart(apiKey, `/v1/generation/${engineId}/image-to-image/masking`, formData, logger);
                return { output: { artifacts: data.artifacts ?? [] } };
            }

            case 'listEngines': {
                logger.log('[Stability] listEngines');
                const data = await stabilityGet(apiKey, '/v1/engines/list', logger);
                const engines = (Array.isArray(data) ? data : []).map((e: any) => ({
                    id: e.id,
                    name: e.name,
                    description: e.description,
                    type: e.type,
                }));
                return { output: { engines } };
            }

            case 'getBalance': {
                logger.log('[Stability] getBalance');
                const data = await stabilityGet(apiKey, '/v1/user/balance', logger);
                return { output: { credits: data.credits } };
            }

            case 'getAccount': {
                logger.log('[Stability] getAccount');
                const data = await stabilityGet(apiKey, '/v1/user/account', logger);
                return {
                    output: {
                        id: data.id,
                        email: data.email,
                        organizations: data.organizations ?? [],
                    },
                };
            }

            case 'sdxlTextToImage': {
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');

                const body: any = {
                    text_prompts: [
                        { text: prompt, weight: 1 },
                        { text: inputs.negativePrompt ? String(inputs.negativePrompt).trim() : '', weight: -1 },
                    ],
                    cfg_scale: inputs.cfgScale !== undefined ? Number(inputs.cfgScale) : 7,
                    height: inputs.height !== undefined ? Number(inputs.height) : 1024,
                    width: inputs.width !== undefined ? Number(inputs.width) : 1024,
                    steps: inputs.steps !== undefined ? Number(inputs.steps) : 30,
                    samples: inputs.samples !== undefined ? Number(inputs.samples) : 1,
                };
                if (inputs.stylePreset) body.style_preset = String(inputs.stylePreset).trim();

                logger.log('[Stability] sdxlTextToImage: 1024x1024');
                const data = await stabilityPost(apiKey, '/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', body, logger);
                return { output: { artifacts: data.artifacts ?? [] } };
            }

            case 'sd3TextToImage': {
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');

                const formData = new FormData();
                formData.append('prompt', prompt);
                formData.append('mode', 'text-to-image');
                formData.append('output_format', 'png');
                if (inputs.negativePrompt) formData.append('negative_prompt', String(inputs.negativePrompt).trim());
                if (inputs.aspectRatio) formData.append('aspect_ratio', String(inputs.aspectRatio).trim());
                if (inputs.model) formData.append('model', String(inputs.model).trim());

                logger.log('[Stability] sd3TextToImage');
                const data = await stabilityPostMultipart(apiKey, '/v2beta/stable-image/generate/sd3', formData, logger);
                return { output: { image: data.image, finishReason: data.finish_reason } };
            }

            case 'generateCore': {
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');

                const formData = new FormData();
                formData.append('prompt', prompt);
                formData.append('output_format', inputs.outputFormat ? String(inputs.outputFormat).trim() : 'png');
                if (inputs.negativePrompt) formData.append('negative_prompt', String(inputs.negativePrompt).trim());
                if (inputs.aspectRatio) formData.append('aspect_ratio', String(inputs.aspectRatio).trim());

                logger.log('[Stability] generateCore');
                const data = await stabilityPostMultipart(apiKey, '/v2beta/stable-image/generate/core', formData, logger);
                return { output: { image: data.image, seed: data.seed } };
            }

            default:
                return { error: `Unknown Stability AI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[Stability] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Stability AI action.' };
    }
}
