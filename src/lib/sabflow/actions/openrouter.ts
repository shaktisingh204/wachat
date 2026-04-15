'use server';

const OR_BASE = 'https://openrouter.ai/api/v1';

async function orFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[OpenRouter] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://sabnode.app',
            'X-Title': 'SabNode',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${OR_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `OpenRouter API error: ${res.status}`);
    }
    return data;
}

export async function executeOpenRouterAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const or = (method: string, path: string, body?: any) => orFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'chat':
            case 'createChatCompletion': {
                const model = String(inputs.model ?? '').trim();
                const messages = inputs.messages;
                if (!model) throw new Error('model is required.');
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                if (inputs.tools !== undefined) body.tools = inputs.tools;
                if (inputs.toolChoice !== undefined) body.tool_choice = inputs.toolChoice;
                if (inputs.responseFormat !== undefined) body.response_format = inputs.responseFormat;
                if (inputs.seed !== undefined) body.seed = inputs.seed;
                if (inputs.transforms !== undefined) body.transforms = inputs.transforms;
                if (inputs.models !== undefined) body.models = inputs.models;
                if (inputs.route) body.route = inputs.route;
                const data = await or('POST', '/chat/completions', body);
                return { output: { ...data, message: data.choices?.[0]?.message } };
            }
            case 'listModels': {
                const data = await or('GET', '/models');
                return { output: { models: data.data ?? [] } };
            }
            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await or('GET', `/models/${encodeURIComponent(modelId)}`);
                return { output: data };
            }
            case 'createCompletion': {
                const model = String(inputs.model ?? '').trim();
                const prompt = inputs.prompt;
                if (!model || !prompt) throw new Error('model and prompt are required.');
                const body: any = { model, prompt };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                const data = await or('POST', '/completions', body);
                return { output: { ...data, text: data.choices?.[0]?.text } };
            }
            case 'createEmbedding': {
                const model = String(inputs.model ?? '').trim();
                const input = inputs.input ?? inputs.text;
                if (!model || !input) throw new Error('model and input are required.');
                const data = await or('POST', '/embeddings', { model, input });
                return { output: { ...data, embedding: data.data?.[0]?.embedding } };
            }
            case 'streamChat': {
                const model = String(inputs.model ?? '').trim();
                const messages = inputs.messages;
                if (!model) throw new Error('model is required.');
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages, stream: true };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                const data = await or('POST', '/chat/completions', body);
                return { output: data };
            }
            case 'getGeneration': {
                const generationId = String(inputs.generationId ?? inputs.id ?? '').trim();
                if (!generationId) throw new Error('generationId is required.');
                const data = await or('GET', `/generation?id=${encodeURIComponent(generationId)}`);
                return { output: data };
            }
            case 'listGenerations': {
                const params = new URLSearchParams();
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.before) params.set('before', inputs.before);
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await or('GET', `/generations${qs}`);
                return { output: { generations: data.data ?? data } };
            }
            case 'getCredits': {
                const data = await or('GET', '/auth/key');
                return { output: { credits: data.data?.limit_remaining, data: data.data, result: data } };
            }
            case 'getStats': {
                const data = await or('GET', '/auth/key');
                return { output: data };
            }
            case 'getRateLimit': {
                const data = await or('GET', '/auth/key');
                return { output: { rateLimit: data.data?.rate_limit, data: data.data, result: data } };
            }
            case 'listProviders': {
                const data = await or('GET', '/providers');
                return { output: { providers: data.data ?? data } };
            }
            case 'getProviderStats': {
                const provider = String(inputs.provider ?? '').trim();
                if (!provider) throw new Error('provider is required.');
                const data = await or('GET', `/providers/${encodeURIComponent(provider)}`);
                return { output: data };
            }
            case 'createKey': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.label) body.label = inputs.label;
                if (inputs.limit !== undefined) body.limit = inputs.limit;
                if (inputs.disabled !== undefined) body.disabled = inputs.disabled;
                const data = await or('POST', '/keys', body);
                return { output: data };
            }
            default:
                throw new Error(`Unknown OpenRouter action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[OpenRouter] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
