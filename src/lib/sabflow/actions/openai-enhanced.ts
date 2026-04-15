'use server';

const OAI_BASE = 'https://api.openai.com/v1';

async function oaiFetch(apiKey: string, method: string, path: string, body?: any, isFormData?: boolean, logger?: any) {
    logger?.log(`[OpenAI-Enhanced] ${method} ${path}`);
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = isFormData ? body : JSON.stringify(body);
    const res = await fetch(`${OAI_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `OpenAI API error: ${res.status}`);
    }
    return data;
}

export async function executeOpenAiEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const oai = (method: string, path: string, body?: any) => oaiFetch(apiKey, method, path, body, false, logger);

        switch (actionName) {
            case 'chat':
            case 'createChatCompletion': {
                const model = String(inputs.model ?? 'gpt-4o').trim();
                const messages = inputs.messages;
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                if (inputs.frequencyPenalty !== undefined) body.frequency_penalty = inputs.frequencyPenalty;
                if (inputs.presencePenalty !== undefined) body.presence_penalty = inputs.presencePenalty;
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                if (inputs.tools !== undefined) body.tools = inputs.tools;
                if (inputs.toolChoice !== undefined) body.tool_choice = inputs.toolChoice;
                if (inputs.responseFormat !== undefined) body.response_format = inputs.responseFormat;
                if (inputs.seed !== undefined) body.seed = inputs.seed;
                if (inputs.n !== undefined) body.n = inputs.n;
                const data = await oai('POST', '/chat/completions', body);
                return { output: { ...data, message: data.choices?.[0]?.message } };
            }
            case 'createCompletion': {
                const model = String(inputs.model ?? 'gpt-3.5-turbo-instruct').trim();
                const prompt = inputs.prompt;
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                if (inputs.n !== undefined) body.n = inputs.n;
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                const data = await oai('POST', '/completions', body);
                return { output: { ...data, text: data.choices?.[0]?.text } };
            }
            case 'createEmbedding': {
                const model = String(inputs.model ?? 'text-embedding-3-small').trim();
                const input = inputs.input ?? inputs.text;
                if (!input) throw new Error('input is required.');
                const body: any = { model, input };
                if (inputs.encodingFormat) body.encoding_format = inputs.encodingFormat;
                if (inputs.dimensions !== undefined) body.dimensions = inputs.dimensions;
                const data = await oai('POST', '/embeddings', body);
                return { output: { ...data, embedding: data.data?.[0]?.embedding } };
            }
            case 'createImage': {
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { prompt };
                if (inputs.model) body.model = inputs.model;
                if (inputs.n !== undefined) body.n = inputs.n;
                if (inputs.size) body.size = inputs.size;
                if (inputs.quality) body.quality = inputs.quality;
                if (inputs.style) body.style = inputs.style;
                if (inputs.responseFormat) body.response_format = inputs.responseFormat;
                const data = await oai('POST', '/images/generations', body);
                return { output: { ...data, url: data.data?.[0]?.url } };
            }
            case 'editImage': {
                throw new Error('editImage requires multipart/form-data; please use the API action with file upload support.');
            }
            case 'createImageVariation': {
                throw new Error('createImageVariation requires multipart/form-data; please use the API action with file upload support.');
            }
            case 'createTranscription': {
                throw new Error('createTranscription requires multipart/form-data with audio file; please use the API action with file upload support.');
            }
            case 'createTranslation': {
                throw new Error('createTranslation requires multipart/form-data with audio file; please use the API action with file upload support.');
            }
            case 'listModels': {
                const data = await oai('GET', '/models');
                return { output: { models: data.data ?? [] } };
            }
            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await oai('GET', `/models/${encodeURIComponent(modelId)}`);
                return { output: data };
            }
            case 'listFiles': {
                const params = new URLSearchParams();
                if (inputs.purpose) params.set('purpose', inputs.purpose);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await oai('GET', `/files${qs}`);
                return { output: { files: data.data ?? [] } };
            }
            case 'uploadFile': {
                throw new Error('uploadFile requires multipart/form-data; please use the API action with file upload support.');
            }
            case 'createFineTuningJob': {
                const trainingFile = String(inputs.trainingFile ?? inputs.training_file ?? '').trim();
                const model = String(inputs.model ?? '').trim();
                if (!trainingFile || !model) throw new Error('trainingFile and model are required.');
                const body: any = { training_file: trainingFile, model };
                if (inputs.validationFile) body.validation_file = inputs.validationFile;
                if (inputs.hyperparameters) body.hyperparameters = inputs.hyperparameters;
                if (inputs.suffix) body.suffix = inputs.suffix;
                const data = await oai('POST', '/fine_tuning/jobs', body);
                return { output: data };
            }
            case 'listFineTuningJobs': {
                const params = new URLSearchParams();
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await oai('GET', `/fine_tuning/jobs${qs}`);
                return { output: { jobs: data.data ?? [] } };
            }
            default:
                throw new Error(`Unknown OpenAI Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[OpenAI-Enhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
