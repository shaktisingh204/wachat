
'use server';

const TOGETHER_BASE = 'https://api.together.xyz/v1';

async function togetherFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[TogetherAI] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${TOGETHER_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `Together AI API error: ${res.status}`);
    }
    return data;
}

export async function executeTogetherAIAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const ta = (method: string, path: string, body?: any) => togetherFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'chatCompletion': {
                const model = String(inputs.model ?? '').trim();
                const messages = inputs.messages;
                if (!model) throw new Error('model is required.');
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                const data = await ta('POST', '/chat/completions', body);
                return { output: data };
            }
            case 'textCompletion': {
                const model = String(inputs.model ?? '').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!model || !prompt) throw new Error('model and prompt are required.');
                const body: any = { model, prompt };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                const data = await ta('POST', '/completions', body);
                return { output: data };
            }
            case 'generateImage': {
                const model = String(inputs.model ?? '').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!model || !prompt) throw new Error('model and prompt are required.');
                const body: any = { model, prompt };
                if (inputs.n !== undefined) body.n = inputs.n;
                if (inputs.width !== undefined) body.width = inputs.width;
                if (inputs.height !== undefined) body.height = inputs.height;
                if (inputs.steps !== undefined) body.steps = inputs.steps;
                const data = await ta('POST', '/images/generations', body);
                return { output: data };
            }
            case 'generateEmbedding': {
                const model = String(inputs.model ?? '').trim();
                const input = inputs.input ?? inputs.text;
                if (!model || !input) throw new Error('model and input are required.');
                const data = await ta('POST', '/embeddings', { model, input });
                return { output: data };
            }
            case 'listModels': {
                const data = await ta('GET', '/models');
                return { output: { models: data } };
            }
            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await ta('GET', `/models/${encodeURIComponent(modelId)}`);
                return { output: data };
            }
            case 'listFineTuningJobs': {
                const data = await ta('GET', '/fine-tunes');
                return { output: { jobs: data } };
            }
            case 'createFineTuningJob': {
                const trainingFile = String(inputs.trainingFile ?? '').trim();
                const model = String(inputs.model ?? '').trim();
                if (!trainingFile || !model) throw new Error('trainingFile and model are required.');
                const body: any = { training_file: trainingFile, model };
                if (inputs.suffix) body.suffix = inputs.suffix;
                if (inputs.nEpochs !== undefined) body.n_epochs = inputs.nEpochs;
                if (inputs.learningRate !== undefined) body.learning_rate = inputs.learningRate;
                const data = await ta('POST', '/fine-tunes', body);
                return { output: data };
            }
            case 'getFineTuningJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await ta('GET', `/fine-tunes/${jobId}`);
                return { output: data };
            }
            case 'cancelFineTuningJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await ta('POST', `/fine-tunes/${jobId}/cancel`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown Together AI action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[TogetherAI] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
