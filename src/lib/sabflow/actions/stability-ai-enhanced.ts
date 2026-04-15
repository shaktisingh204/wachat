'use server';

export async function executeStabilityAIEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const baseUrl = 'https://api.stability.ai/v2beta';
        const authHeaders: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'generateImageFromText': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.negativePrompt) formData.append('negative_prompt', inputs.negativePrompt);
                if (inputs.aspectRatio) formData.append('aspect_ratio', inputs.aspectRatio);
                if (inputs.seed !== undefined) formData.append('seed', String(inputs.seed));
                if (inputs.stylePreset) formData.append('style_preset', inputs.stylePreset);
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/generate/sd3`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'generateImageFromText failed' };
                return { output: data };
            }

            case 'imageToImage': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: inputs.mediaType || 'image/png' }), 'image.png');
                }
                if (inputs.strength !== undefined) formData.append('strength', String(inputs.strength));
                if (inputs.negativePrompt) formData.append('negative_prompt', inputs.negativePrompt);
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/generate/sd3`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'imageToImage failed' };
                return { output: data };
            }

            case 'inpaintImage': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.maskBase64) {
                    const maskBuf = Buffer.from(inputs.maskBase64, 'base64');
                    formData.append('mask', new Blob([maskBuf], { type: 'image/png' }), 'mask.png');
                }
                if (inputs.negativePrompt) formData.append('negative_prompt', inputs.negativePrompt);
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/edit/inpaint`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'inpaintImage failed' };
                return { output: data };
            }

            case 'removeBackground': {
                const formData = new FormData();
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/edit/remove-background`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'removeBackground failed' };
                return { output: data };
            }

            case 'upscaleImage': {
                const formData = new FormData();
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.prompt) formData.append('prompt', inputs.prompt);
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const endpoint = inputs.creative ? `${baseUrl}/stable-image/upscale/creative` : `${baseUrl}/stable-image/upscale/conservative`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'upscaleImage failed' };
                return { output: data };
            }

            case 'controlNetDepth': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.controlStrength !== undefined) formData.append('control_strength', String(inputs.controlStrength));
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/control/structure`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'controlNetDepth failed' };
                return { output: data };
            }

            case 'controlNetCanny': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.controlStrength !== undefined) formData.append('control_strength', String(inputs.controlStrength));
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/control/style`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'controlNetCanny failed' };
                return { output: data };
            }

            case 'controlNetSketch': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.controlStrength !== undefined) formData.append('control_strength', String(inputs.controlStrength));
                if (inputs.negativePrompt) formData.append('negative_prompt', inputs.negativePrompt);
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/control/sketch`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'controlNetSketch failed' };
                return { output: data };
            }

            case 'generateCore': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.negativePrompt) formData.append('negative_prompt', inputs.negativePrompt);
                if (inputs.aspectRatio) formData.append('aspect_ratio', inputs.aspectRatio);
                if (inputs.seed !== undefined) formData.append('seed', String(inputs.seed));
                if (inputs.stylePreset) formData.append('style_preset', inputs.stylePreset);
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/generate/core`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'generateCore failed' };
                return { output: data };
            }

            case 'generateUltra': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                if (inputs.negativePrompt) formData.append('negative_prompt', inputs.negativePrompt);
                if (inputs.aspectRatio) formData.append('aspect_ratio', inputs.aspectRatio);
                if (inputs.seed !== undefined) formData.append('seed', String(inputs.seed));
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/generate/ultra`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'generateUltra failed' };
                return { output: data };
            }

            case 'getGenerationResult': {
                const generationId = inputs.generationId || inputs.id;
                const res = await fetch(`${baseUrl}/generation/${generationId}/result`, {
                    method: 'GET',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'getGenerationResult failed' };
                return { output: data };
            }

            case 'listEngines': {
                const res = await fetch(`https://api.stability.ai/v1/engines/list`, {
                    method: 'GET',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'listEngines failed' };
                return { output: { engines: data } };
            }

            case 'getBalance': {
                const res = await fetch(`https://api.stability.ai/v1/user/balance`, {
                    method: 'GET',
                    headers: authHeaders,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'getBalance failed' };
                return { output: data };
            }

            case 'searchAndReplace': {
                const formData = new FormData();
                formData.append('prompt', inputs.prompt || '');
                formData.append('search_prompt', inputs.searchPrompt || '');
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.negativePrompt) formData.append('negative_prompt', inputs.negativePrompt);
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/edit/search-and-replace`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'searchAndReplace failed' };
                return { output: data };
            }

            case 'outpaintImage': {
                const formData = new FormData();
                if (inputs.imageBase64) {
                    const buf = Buffer.from(inputs.imageBase64, 'base64');
                    formData.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
                }
                if (inputs.left !== undefined) formData.append('left', String(inputs.left));
                if (inputs.right !== undefined) formData.append('right', String(inputs.right));
                if (inputs.up !== undefined) formData.append('up', String(inputs.up));
                if (inputs.down !== undefined) formData.append('down', String(inputs.down));
                if (inputs.prompt) formData.append('prompt', inputs.prompt);
                if (inputs.creativity !== undefined) formData.append('creativity', String(inputs.creativity));
                if (inputs.outputFormat) formData.append('output_format', inputs.outputFormat);
                const res = await fetch(`${baseUrl}/stable-image/edit/outpaint`, {
                    method: 'POST',
                    headers: { ...authHeaders },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.join(', ') || data.message || 'outpaintImage failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown Stability AI Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeStabilityAIEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeStabilityAIEnhancedAction' };
    }
}
