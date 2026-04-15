'use server';

const STABILITY_V1 = 'https://api.stability.ai/v1';
const STABILITY_V2BETA = 'https://api.stability.ai/v2beta';

async function stabGet(apiKey: string, url: string, logger: any) {
    logger.log(`[StabilityAI] GET ${url}`);
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || data?.name || `Stability AI error: ${res.status}`);
    return data;
}

async function stabPost(apiKey: string, url: string, body: any, logger: any) {
    logger.log(`[StabilityAI] POST ${url}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || data?.name || `Stability AI error: ${res.status}`);
    return data;
}

export async function executeStabilityAiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        if (!apiKey) throw new Error('Stability AI apiKey is required');

        switch (actionName) {
            case 'generateImage': {
                const { engineId, textPrompts, height, width, cfgScale, samples, steps, seed, stylePreset } = inputs;
                const engine = engineId || 'stable-diffusion-xl-1024-v1-0';
                if (!textPrompts || !Array.isArray(textPrompts) || textPrompts.length === 0) throw new Error('textPrompts array is required');
                const body: any = { text_prompts: textPrompts };
                if (height) body.height = height;
                if (width) body.width = width;
                if (cfgScale) body.cfg_scale = cfgScale;
                if (samples) body.samples = samples;
                if (steps) body.steps = steps;
                if (seed !== undefined) body.seed = seed;
                if (stylePreset) body.style_preset = stylePreset;
                const data = await stabPost(apiKey, `${STABILITY_V1}/generation/${engine}/text-to-image`, body, logger);
                return { output: { artifacts: data.artifacts } };
            }
            case 'generateImageFromImage': {
                const { engineId, textPrompts, initImage, imageStrength } = inputs;
                const engine = engineId || 'stable-diffusion-xl-1024-v1-0';
                if (!textPrompts || !initImage) throw new Error('textPrompts and initImage are required');
                const body: any = { text_prompts: textPrompts, init_image: initImage };
                if (imageStrength !== undefined) body.image_strength = imageStrength;
                const data = await stabPost(apiKey, `${STABILITY_V1}/generation/${engine}/image-to-image`, body, logger);
                return { output: { artifacts: data.artifacts } };
            }
            case 'inpaintImage': {
                const { engineId, textPrompts, initImage, maskImage, maskSource } = inputs;
                const engine = engineId || 'stable-inpainting-512-v2-0';
                if (!textPrompts || !initImage) throw new Error('textPrompts and initImage are required');
                const body: any = { text_prompts: textPrompts, init_image: initImage };
                if (maskImage) body.mask_image = maskImage;
                if (maskSource) body.mask_source = maskSource;
                const data = await stabPost(apiKey, `${STABILITY_V1}/generation/${engine}/image-to-image/masking`, body, logger);
                return { output: { artifacts: data.artifacts } };
            }
            case 'outpaintImage': {
                const { image, left, right, up, down, prompt, creativity, outputFormat } = inputs;
                if (!image) throw new Error('image is required');
                const body: any = { image };
                if (left !== undefined) body.left = left;
                if (right !== undefined) body.right = right;
                if (up !== undefined) body.up = up;
                if (down !== undefined) body.down = down;
                if (prompt) body.prompt = prompt;
                if (creativity !== undefined) body.creativity = creativity;
                if (outputFormat) body.output_format = outputFormat;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/edit/outpaint`, body, logger);
                return { output: data };
            }
            case 'upscaleImage': {
                const { image, prompt, outputFormat, creativity } = inputs;
                if (!image) throw new Error('image is required');
                const body: any = { image };
                if (prompt) body.prompt = prompt;
                if (outputFormat) body.output_format = outputFormat;
                if (creativity !== undefined) body.creativity = creativity;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/upscale/conservative`, body, logger);
                return { output: data };
            }
            case 'removeBackground': {
                const { image, outputFormat } = inputs;
                if (!image) throw new Error('image is required');
                const body: any = { image };
                if (outputFormat) body.output_format = outputFormat;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/edit/remove-background`, body, logger);
                return { output: data };
            }
            case 'searchAndReplace': {
                const { image, prompt, searchPrompt, negativePrompt, outputFormat, seed } = inputs;
                if (!image || !prompt || !searchPrompt) throw new Error('image, prompt, and searchPrompt are required');
                const body: any = { image, prompt, search_prompt: searchPrompt };
                if (negativePrompt) body.negative_prompt = negativePrompt;
                if (outputFormat) body.output_format = outputFormat;
                if (seed !== undefined) body.seed = seed;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/edit/search-and-replace`, body, logger);
                return { output: data };
            }
            case 'searchAndRecolor': {
                const { image, prompt, selectPrompt, negativePrompt, outputFormat, seed } = inputs;
                if (!image || !prompt || !selectPrompt) throw new Error('image, prompt, and selectPrompt are required');
                const body: any = { image, prompt, select_prompt: selectPrompt };
                if (negativePrompt) body.negative_prompt = negativePrompt;
                if (outputFormat) body.output_format = outputFormat;
                if (seed !== undefined) body.seed = seed;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/edit/search-and-recolor`, body, logger);
                return { output: data };
            }
            case 'replaceBackground': {
                const { subjectImage, backgroundPrompt, outputFormat, seed } = inputs;
                if (!subjectImage || !backgroundPrompt) throw new Error('subjectImage and backgroundPrompt are required');
                const body: any = { subject_image: subjectImage, background_prompt: backgroundPrompt };
                if (outputFormat) body.output_format = outputFormat;
                if (seed !== undefined) body.seed = seed;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/edit/replace-background-and-relight`, body, logger);
                return { output: data };
            }
            case 'recolorImage': {
                const { image, prompt, selectPrompt, outputFormat, seed } = inputs;
                if (!image || !prompt) throw new Error('image and prompt are required');
                const body: any = { image, prompt };
                if (selectPrompt) body.select_prompt = selectPrompt;
                if (outputFormat) body.output_format = outputFormat;
                if (seed !== undefined) body.seed = seed;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/edit/search-and-recolor`, body, logger);
                return { output: data };
            }
            case 'sketchToImage': {
                const { image, prompt, controlStrength, negativePrompt, outputFormat, seed } = inputs;
                if (!image || !prompt) throw new Error('image and prompt are required');
                const body: any = { image, prompt };
                if (controlStrength !== undefined) body.control_strength = controlStrength;
                if (negativePrompt) body.negative_prompt = negativePrompt;
                if (outputFormat) body.output_format = outputFormat;
                if (seed !== undefined) body.seed = seed;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/control/sketch`, body, logger);
                return { output: data };
            }
            case 'structureToImage': {
                const { image, prompt, controlStrength, negativePrompt, outputFormat, seed } = inputs;
                if (!image || !prompt) throw new Error('image and prompt are required');
                const body: any = { image, prompt };
                if (controlStrength !== undefined) body.control_strength = controlStrength;
                if (negativePrompt) body.negative_prompt = negativePrompt;
                if (outputFormat) body.output_format = outputFormat;
                if (seed !== undefined) body.seed = seed;
                const data = await stabPost(apiKey, `${STABILITY_V2BETA}/stable-image/control/structure`, body, logger);
                return { output: data };
            }
            case 'listEngines': {
                const data = await stabGet(apiKey, `${STABILITY_V1}/engines/list`, logger);
                return { output: { engines: data } };
            }
            case 'getUserBalance': {
                const data = await stabGet(apiKey, `${STABILITY_V1}/user/balance`, logger);
                return { output: data };
            }
            case 'getGenerationById': {
                const { engineId, generationId } = inputs;
                if (!engineId || !generationId) throw new Error('engineId and generationId are required');
                const data = await stabGet(apiKey, `${STABILITY_V1}/generation/${engineId}/${generationId}`, logger);
                return { output: data };
            }
            default:
                return { error: `Stability AI action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`[StabilityAI] Error: ${err.message}`);
        return { error: err.message };
    }
}
