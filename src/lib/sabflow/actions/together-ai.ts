'use server';

const TOGETHER_BASE = 'https://api.together.xyz/v1';

async function togetherFetch(
    apiKey: string,
    method: string,
    path: string,
    logger: any,
    body?: any,
    isFormData?: boolean,
): Promise<any> {
    logger.log(`[TogetherAI] ${method} ${path}`);
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
    };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = isFormData ? body : JSON.stringify(body);
    const res = await fetch(`${TOGETHER_BASE}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `Together AI API error: ${res.status}`);
    return data;
}

export async function executeTogetherAiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const api = (method: string, path: string, body?: any, isFormData?: boolean) =>
            togetherFetch(apiKey, method, path, logger, body, isFormData);

        switch (actionName) {
            case 'chat':
            case 'createChatCompletion': {
                const model = String(inputs.model ?? 'meta-llama/Llama-3-8b-chat-hf').trim();
                const messages = inputs.messages ?? [{ role: 'user', content: String(inputs.message ?? inputs.prompt ?? '') }];
                const body: any = { model, messages };
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                if (inputs.topP !== undefined) body.top_p = Number(inputs.topP);
                if (inputs.topK !== undefined) body.top_k = Number(inputs.topK);
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                if (inputs.repetitionPenalty !== undefined) body.repetition_penalty = Number(inputs.repetitionPenalty);
                logger.log(`[TogetherAI] chat: model=${model}`);
                const data = await api('POST', '/chat/completions', body);
                return { output: { id: data.id, model: data.model, content: data.choices?.[0]?.message?.content ?? '', choices: data.choices, usage: data.usage } };
            }

            case 'createCompletion': {
                const model = String(inputs.model ?? 'meta-llama/Llama-3-8b-hf').trim();
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
                const model = String(inputs.model ?? 'togethercomputer/m2-bert-80M-8k-retrieval').trim();
                const input = inputs.input ?? inputs.text ?? '';
                const body: any = { model, input };
                const data = await api('POST', '/embeddings', body);
                return { output: { embedding: data.data?.[0]?.embedding ?? [], data: data.data, usage: data.usage } };
            }

            case 'listModels': {
                const data = await api('GET', '/models');
                return { output: { models: data ?? [], total: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await api('GET', `/models/${encodeURIComponent(modelId)}`);
                return { output: data };
            }

            case 'createImage': {
                const model = String(inputs.model ?? 'stabilityai/stable-diffusion-xl-base-1.0').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.width !== undefined) body.width = Number(inputs.width);
                if (inputs.height !== undefined) body.height = Number(inputs.height);
                if (inputs.steps !== undefined) body.steps = Number(inputs.steps);
                if (inputs.n !== undefined) body.n = Number(inputs.n);
                if (inputs.negativePrompt) body.negative_prompt = String(inputs.negativePrompt);
                const data = await api('POST', '/images/generations', body);
                return { output: { images: data.data ?? [], url: data.data?.[0]?.url ?? '' } };
            }

            case 'listFiles': {
                const data = await api('GET', '/files');
                return { output: { files: data.data ?? [], total: data.data?.length ?? 0 } };
            }

            case 'uploadFile': {
                const fileBase64 = String(inputs.fileBase64 ?? '').trim();
                const purpose = String(inputs.purpose ?? 'fine-tune').trim();
                if (!fileBase64) throw new Error('fileBase64 is required.');
                const formData = new FormData();
                const buffer = Buffer.from(fileBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'application/jsonl' });
                formData.append('file', blob, inputs.filename ?? 'data.jsonl');
                formData.append('purpose', purpose);
                const data = await api('POST', '/files', formData, true);
                return { output: data };
            }

            case 'deleteFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await api('DELETE', `/files/${fileId}`);
                return { output: { deleted: true, id: fileId, result: data } };
            }

            case 'createFineTuningJob': {
                const trainingFile = String(inputs.trainingFile ?? '').trim();
                const model = String(inputs.model ?? '').trim();
                if (!trainingFile) throw new Error('trainingFile is required.');
                if (!model) throw new Error('model is required.');
                const body: any = { training_file: trainingFile, model };
                if (inputs.suffix) body.suffix = String(inputs.suffix);
                if (inputs.validationFile) body.validation_file = String(inputs.validationFile);
                if (inputs.nEpochs) body.n_epochs = Number(inputs.nEpochs);
                if (inputs.learningRateMultiplier) body.learning_rate_multiplier = Number(inputs.learningRateMultiplier);
                const data = await api('POST', '/fine-tunes', body);
                return { output: data };
            }

            case 'listFineTuningJobs': {
                const data = await api('GET', '/fine-tunes');
                return { output: { jobs: data.data ?? data ?? [], total: (data.data ?? data)?.length ?? 0 } };
            }

            case 'getFineTuningJob': {
                const jobId = String(inputs.jobId ?? inputs.fineTuneId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await api('GET', `/fine-tunes/${jobId}`);
                return { output: data };
            }

            case 'cancelFineTuningJob': {
                const jobId = String(inputs.jobId ?? inputs.fineTuneId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await api('POST', `/fine-tunes/${jobId}/cancel`);
                return { output: data };
            }

            case 'listInstances': {
                const data = await api('GET', '/instances');
                return { output: { instances: data ?? [], total: Array.isArray(data) ? data.length : 0 } };
            }

            default:
                throw new Error(`Unknown Together AI action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[TogetherAI] Error in action "${actionName}": ${err.message}`);
        return { error: err.message ?? 'Unknown Together AI error' };
    }
}
