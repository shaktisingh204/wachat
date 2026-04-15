'use server';

async function ollamaFetch(serverUrl: string, method: string, path: string, body?: any, authToken?: string, logger?: any) {
    logger?.log(`[Ollama] ${method} ${serverUrl}${path}`);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${serverUrl}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
        throw new Error(data?.error || `Ollama API error: ${res.status}`);
    }
    return data;
}

export async function executeOllamaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.ollamaUrl ?? inputs.serverUrl ?? 'http://localhost:11434').replace(/\/$/, '');
        const authToken = inputs.authToken ? String(inputs.authToken) : undefined;
        const ol = (method: string, path: string, body?: any) => ollamaFetch(serverUrl, method, path, body, authToken, logger);

        switch (actionName) {
            case 'chat': {
                const model = String(inputs.model ?? '').trim();
                const messages = inputs.messages;
                if (!model) throw new Error('model is required.');
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages, stream: false };
                if (inputs.options) body.options = inputs.options;
                if (inputs.format) body.format = inputs.format;
                const data = await ol('POST', '/api/chat', body);
                return { output: { ...data, message: data.message } };
            }
            case 'generate': {
                const model = String(inputs.model ?? '').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!model || !prompt) throw new Error('model and prompt are required.');
                const body: any = { model, prompt, stream: false };
                if (inputs.system) body.system = inputs.system;
                if (inputs.options) body.options = inputs.options;
                if (inputs.format) body.format = inputs.format;
                if (inputs.context) body.context = inputs.context;
                if (inputs.images) body.images = inputs.images;
                const data = await ol('POST', '/api/generate', body);
                return { output: data };
            }
            case 'listModels': {
                const data = await ol('GET', '/api/tags');
                return { output: { models: data.models ?? [] } };
            }
            case 'getModel':
            case 'showModel': {
                const name = String(inputs.name ?? inputs.model ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.verbose !== undefined) body.verbose = inputs.verbose;
                const data = await ol('POST', '/api/show', body);
                return { output: data };
            }
            case 'pullModel': {
                const name = String(inputs.name ?? inputs.model ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name, stream: false };
                if (inputs.insecure !== undefined) body.insecure = inputs.insecure;
                const data = await ol('POST', '/api/pull', body);
                return { output: data };
            }
            case 'pushModel': {
                const name = String(inputs.name ?? inputs.model ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name, stream: false };
                if (inputs.insecure !== undefined) body.insecure = inputs.insecure;
                const data = await ol('POST', '/api/push', body);
                return { output: data };
            }
            case 'deleteModel': {
                const name = String(inputs.name ?? inputs.model ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await ol('DELETE', '/api/delete', { name });
                return { output: { success: true, result: data } };
            }
            case 'copyModel': {
                const source = String(inputs.source ?? '').trim();
                const destination = String(inputs.destination ?? '').trim();
                if (!source || !destination) throw new Error('source and destination are required.');
                await ol('POST', '/api/copy', { source, destination });
                return { output: { success: true } };
            }
            case 'createModel': {
                const name = String(inputs.name ?? inputs.model ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name, stream: false };
                if (inputs.modelfile) body.modelfile = inputs.modelfile;
                if (inputs.path) body.path = inputs.path;
                if (inputs.quantize) body.quantize = inputs.quantize;
                const data = await ol('POST', '/api/create', body);
                return { output: data };
            }
            case 'embeddings': {
                const model = String(inputs.model ?? '').trim();
                const prompt = String(inputs.prompt ?? inputs.text ?? '').trim();
                if (!model || !prompt) throw new Error('model and prompt are required.');
                const body: any = { model, prompt };
                if (inputs.options) body.options = inputs.options;
                const data = await ol('POST', '/api/embeddings', body);
                return { output: { embedding: data.embedding, result: data } };
            }
            case 'listRunning': {
                const data = await ol('GET', '/api/ps');
                return { output: { models: data.models ?? [] } };
            }
            case 'getVersion': {
                const data = await ol('GET', '/api/version');
                return { output: { version: data.version, result: data } };
            }
            case 'streamGenerate': {
                const model = String(inputs.model ?? '').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!model || !prompt) throw new Error('model and prompt are required.');
                const body: any = { model, prompt, stream: true };
                if (inputs.system) body.system = inputs.system;
                if (inputs.options) body.options = inputs.options;
                const data = await ol('POST', '/api/generate', body);
                return { output: data };
            }
            case 'generateWithContext': {
                const model = String(inputs.model ?? '').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!model || !prompt) throw new Error('model and prompt are required.');
                const body: any = { model, prompt, stream: false };
                if (inputs.context) body.context = inputs.context;
                if (inputs.system) body.system = inputs.system;
                if (inputs.options) body.options = inputs.options;
                const data = await ol('POST', '/api/generate', body);
                return { output: { response: data.response, context: data.context, result: data } };
            }
            default:
                throw new Error(`Unknown Ollama action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Ollama] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
