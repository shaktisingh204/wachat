'use server';

const FIREWORKS_BASE = 'https://api.fireworks.ai/inference/v1';

async function fireworksFetch(
    apiKey: string,
    method: string,
    path: string,
    logger: any,
    body?: any,
    isFormData?: boolean,
): Promise<any> {
    logger.log(`[FireworksAI] ${method} ${path}`);
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
    };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = isFormData ? body : JSON.stringify(body);
    const res = await fetch(`${FIREWORKS_BASE}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `Fireworks AI API error: ${res.status}`);
    return data;
}

export async function executeFireworksAiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const api = (method: string, path: string, body?: any, isFormData?: boolean) =>
            fireworksFetch(apiKey, method, path, logger, body, isFormData);

        switch (actionName) {
            case 'chat':
            case 'createChatCompletion': {
                const model = String(inputs.model ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct').trim();
                const messages = inputs.messages ?? [{ role: 'user', content: String(inputs.message ?? inputs.prompt ?? '') }];
                const body: any = { model, messages };
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                if (inputs.topP !== undefined) body.top_p = Number(inputs.topP);
                if (inputs.topK !== undefined) body.top_k = Number(inputs.topK);
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                if (inputs.frequencyPenalty !== undefined) body.frequency_penalty = Number(inputs.frequencyPenalty);
                if (inputs.presencePenalty !== undefined) body.presence_penalty = Number(inputs.presencePenalty);
                logger.log(`[FireworksAI] chat: model=${model}`);
                const data = await api('POST', '/chat/completions', body);
                return { output: { id: data.id, model: data.model, content: data.choices?.[0]?.message?.content ?? '', choices: data.choices, usage: data.usage } };
            }

            case 'createCompletion': {
                const model = String(inputs.model ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.topP !== undefined) body.top_p = Number(inputs.topP);
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                const data = await api('POST', '/completions', body);
                return { output: { text: data.choices?.[0]?.text ?? '', choices: data.choices, usage: data.usage } };
            }

            case 'createEmbedding': {
                const model = String(inputs.model ?? 'nomic-ai/nomic-embed-text-v1.5').trim();
                const input = inputs.input ?? inputs.text ?? '';
                const body: any = { model, input };
                if (inputs.encodingFormat) body.encoding_format = String(inputs.encodingFormat);
                const data = await api('POST', '/embeddings', body);
                return { output: { embedding: data.data?.[0]?.embedding ?? [], data: data.data, usage: data.usage } };
            }

            case 'listModels': {
                const data = await api('GET', '/models');
                return { output: { models: data.data ?? data ?? [], total: (data.data ?? data)?.length ?? 0 } };
            }

            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await api('GET', `/models/${encodeURIComponent(modelId)}`);
                return { output: data };
            }

            case 'createImage': {
                const model = String(inputs.model ?? 'accounts/fireworks/models/stable-diffusion-xl-1024-v1-0').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.width !== undefined) body.width = Number(inputs.width);
                if (inputs.height !== undefined) body.height = Number(inputs.height);
                if (inputs.steps !== undefined) body.steps = Number(inputs.steps);
                if (inputs.guidanceScale !== undefined) body.guidance_scale = Number(inputs.guidanceScale);
                if (inputs.negativePrompt) body.negative_prompt = String(inputs.negativePrompt);
                if (inputs.seed !== undefined) body.seed = Number(inputs.seed);
                const data = await api('POST', '/image_generation/accounts/fireworks/models/stable-diffusion-xl-1024-v1-0', body);
                return { output: { images: data.output ?? data.data ?? [], url: data.output?.[0] ?? '' } };
            }

            case 'createAudio': {
                const model = String(inputs.model ?? 'accounts/fireworks/models/whisper-v3').trim();
                const audioBase64 = String(inputs.audioBase64 ?? '').trim();
                if (!audioBase64) throw new Error('audioBase64 is required.');
                const formData = new FormData();
                formData.append('model', model);
                const buffer = Buffer.from(audioBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'audio/mp3' });
                formData.append('file', blob, inputs.filename ?? 'audio.mp3');
                if (inputs.language) formData.append('language', String(inputs.language));
                if (inputs.prompt) formData.append('prompt', String(inputs.prompt));
                const data = await api('POST', '/audio/transcriptions', formData, true);
                return { output: { text: data.text ?? '', segments: data.segments ?? [] } };
            }

            case 'streamChat': {
                // Non-streaming fallback for server environment
                const model = String(inputs.model ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct').trim();
                const messages = inputs.messages ?? [{ role: 'user', content: String(inputs.message ?? inputs.prompt ?? '') }];
                const body: any = { model, messages, stream: false };
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                const data = await api('POST', '/chat/completions', body);
                return { output: { content: data.choices?.[0]?.message?.content ?? '', usage: data.usage } };
            }

            case 'batchChat': {
                const model = String(inputs.model ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct').trim();
                const batchMessages: any[] = inputs.batchMessages ?? [];
                if (!batchMessages.length) throw new Error('batchMessages array is required.');
                const results = await Promise.all(
                    batchMessages.map((msgs: any) =>
                        api('POST', '/chat/completions', {
                            model,
                            messages: Array.isArray(msgs) ? msgs : [{ role: 'user', content: String(msgs) }],
                        })
                    )
                );
                return { output: { results: results.map((d: any) => ({ content: d.choices?.[0]?.message?.content ?? '', usage: d.usage })) } };
            }

            case 'createFineTuningJob': {
                const trainingFile = String(inputs.trainingFile ?? '').trim();
                const model = String(inputs.model ?? '').trim();
                if (!trainingFile) throw new Error('trainingFile is required.');
                if (!model) throw new Error('model is required.');
                const body: any = { training_file: trainingFile, model };
                if (inputs.suffix) body.suffix = String(inputs.suffix);
                if (inputs.validationFile) body.validation_file = String(inputs.validationFile);
                if (inputs.hyperparameters) body.hyperparameters = inputs.hyperparameters;
                const data = await api('POST', '/fine_tuning/jobs', body);
                return { output: data };
            }

            case 'listFineTuningJobs': {
                const data = await api('GET', '/fine_tuning/jobs');
                return { output: { jobs: data.data ?? [], total: data.data?.length ?? 0 } };
            }

            case 'getFineTuningJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await api('GET', `/fine_tuning/jobs/${jobId}`);
                return { output: data };
            }

            case 'cancelFineTuningJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await api('POST', `/fine_tuning/jobs/${jobId}/cancel`);
                return { output: data };
            }

            case 'listDeployedModels': {
                const accountId = String(inputs.accountId ?? 'fireworks').trim();
                const data = await api('GET', `/accounts/${accountId}/deployedModels`);
                return { output: { deployedModels: data.deployedModels ?? data ?? [], total: (data.deployedModels ?? data)?.length ?? 0 } };
            }

            default:
                throw new Error(`Unknown Fireworks AI action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[FireworksAI] Error in action "${actionName}": ${err.message}`);
        return { error: err.message ?? 'Unknown Fireworks AI error' };
    }
}
