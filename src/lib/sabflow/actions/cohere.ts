
'use server';

const COHERE_BASE = 'https://api.cohere.com/v1';

async function cohereFetch(
    apiKey: string,
    method: string,
    path: string,
    logger: any,
    body?: any,
) {
    logger.log(`[Cohere] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${COHERE_BASE}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || data?.error || `Cohere API error: ${res.status}`);
    return data;
}

export async function executeCohereAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const api = (method: string, path: string, body?: any) => cohereFetch(apiKey, method, path, logger, body);

        switch (actionName) {
            case 'generate': {
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { prompt, max_tokens: Number(inputs.maxTokens ?? 300) };
                if (inputs.model) body.model = String(inputs.model).trim();
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.k !== undefined) body.k = Number(inputs.k);
                if (inputs.p !== undefined) body.p = Number(inputs.p);
                if (inputs.stopSequences) body.stop_sequences = inputs.stopSequences;
                if (inputs.presencePenalty !== undefined) body.presence_penalty = Number(inputs.presencePenalty);
                logger.log(`[Cohere] generate: model=${body.model ?? 'default'}`);
                const data = await api('POST', '/generate', body);
                return {
                    output: {
                        id: data.id ?? '',
                        text: data.generations?.[0]?.text ?? '',
                        generations: data.generations ?? [],
                    },
                };
            }

            case 'chat': {
                const message = String(inputs.message ?? '').trim();
                if (!message) throw new Error('message is required.');
                const body: any = { message };
                if (inputs.model) body.model = String(inputs.model).trim();
                if (inputs.chatHistory) body.chat_history = inputs.chatHistory;
                if (inputs.connectors) body.connectors = inputs.connectors;
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.preamble) body.preamble = String(inputs.preamble);
                logger.log(`[Cohere] chat`);
                const data = await api('POST', '/chat', body);
                return {
                    output: {
                        text: data.text ?? '',
                        chat_history: data.chat_history ?? [],
                        meta: data.meta ?? {},
                    },
                };
            }

            case 'embed': {
                const texts = inputs.texts;
                if (!Array.isArray(texts) || texts.length === 0) throw new Error('texts must be a non-empty array.');
                const body: any = {
                    texts,
                    input_type: String(inputs.inputType ?? 'search_document'),
                };
                if (inputs.model) body.model = String(inputs.model).trim();
                logger.log(`[Cohere] embed: texts.length=${texts.length}`);
                const data = await api('POST', '/embed', body);
                return {
                    output: {
                        id: data.id ?? '',
                        embeddings: data.embeddings ?? [],
                        texts: data.texts ?? texts,
                    },
                };
            }

            case 'rerank': {
                const query = String(inputs.query ?? '').trim();
                const documents = inputs.documents;
                if (!query) throw new Error('query is required.');
                if (!Array.isArray(documents) || documents.length === 0) throw new Error('documents must be a non-empty array.');
                const body: any = { query, documents };
                if (inputs.model) body.model = String(inputs.model).trim();
                if (inputs.topN !== undefined) body.top_n = Number(inputs.topN);
                logger.log(`[Cohere] rerank: query="${query.substring(0, 60)}"`);
                const data = await api('POST', '/rerank', body);
                return {
                    output: {
                        id: data.id ?? '',
                        results: data.results ?? [],
                    },
                };
            }

            case 'classify': {
                const classInputs = inputs.inputs;
                const examples = inputs.examples;
                if (!Array.isArray(classInputs) || classInputs.length === 0) throw new Error('inputs must be a non-empty array.');
                if (!Array.isArray(examples) || examples.length === 0) throw new Error('examples must be a non-empty array.');
                const body: any = { inputs: classInputs, examples };
                if (inputs.model) body.model = String(inputs.model).trim();
                logger.log(`[Cohere] classify: inputs.length=${classInputs.length}`);
                const data = await api('POST', '/classify', body);
                return {
                    output: {
                        id: data.id ?? '',
                        classifications: data.classifications ?? [],
                    },
                };
            }

            case 'summarize': {
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');
                const body: any = { text };
                if (inputs.model) body.model = String(inputs.model).trim();
                if (inputs.length) body.length = String(inputs.length);
                if (inputs.format) body.format = String(inputs.format);
                if (inputs.extractiveness) body.extractiveness = String(inputs.extractiveness);
                logger.log(`[Cohere] summarize`);
                const data = await api('POST', '/summarize', body);
                return {
                    output: {
                        id: data.id ?? '',
                        summary: data.summary ?? '',
                    },
                };
            }

            case 'detectLanguage': {
                const texts = inputs.texts;
                if (!Array.isArray(texts) || texts.length === 0) throw new Error('texts must be a non-empty array.');
                logger.log(`[Cohere] detectLanguage: texts.length=${texts.length}`);
                const data = await api('POST', '/detect-language', { texts });
                return {
                    output: {
                        id: data.id ?? '',
                        results: data.results ?? [],
                    },
                };
            }

            case 'tokenize': {
                const text = String(inputs.text ?? '').trim();
                if (!text) throw new Error('text is required.');
                const body: any = { text };
                if (inputs.model) body.model = String(inputs.model).trim();
                logger.log(`[Cohere] tokenize`);
                const data = await api('POST', '/tokenize', body);
                return {
                    output: {
                        tokens: data.tokens ?? [],
                        tokenStrings: data.token_strings ?? [],
                    },
                };
            }

            case 'detokenize': {
                const tokens = inputs.tokens;
                if (!Array.isArray(tokens) || tokens.length === 0) throw new Error('tokens must be a non-empty array.');
                const body: any = { tokens };
                if (inputs.model) body.model = String(inputs.model).trim();
                logger.log(`[Cohere] detokenize`);
                const data = await api('POST', '/detokenize', body);
                return {
                    output: {
                        text: data.text ?? '',
                    },
                };
            }

            case 'listModels': {
                logger.log(`[Cohere] listModels`);
                const data = await api('GET', '/models');
                return {
                    output: {
                        models: data.models ?? [],
                    },
                };
            }

            case 'getModel': {
                const modelId = String(inputs.modelId ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                logger.log(`[Cohere] getModel: modelId=${modelId}`);
                const data = await api('GET', `/models/${modelId}`);
                return {
                    output: {
                        name: data.name ?? modelId,
                        endpoints: data.endpoints ?? [],
                    },
                };
            }

            case 'createDataset': {
                const name = String(inputs.name ?? '').trim();
                const type = String(inputs.type ?? '').trim();
                const dataContent = inputs.data;
                if (!name) throw new Error('name is required.');
                if (!type) throw new Error('type is required.');
                if (!dataContent) throw new Error('data is required.');
                logger.log(`[Cohere] createDataset: name=${name}, type=${type}`);
                const formData = new FormData();
                const content = typeof dataContent === 'string' ? dataContent : JSON.stringify(dataContent);
                const blob = new Blob([content], { type: 'application/octet-stream' });
                formData.append('data', blob, `${name}.jsonl`);
                const url = new URL(`${COHERE_BASE}/datasets`);
                url.searchParams.set('name', name);
                url.searchParams.set('type', type);
                const res = await fetch(url.toString(), {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}` },
                    body: formData,
                });
                const text = await res.text();
                let result: any;
                try { result = JSON.parse(text); } catch { result = { raw: text }; }
                if (!res.ok) throw new Error(result?.message || `Cohere dataset upload error: ${res.status}`);
                return {
                    output: {
                        id: result.id ?? '',
                        name: result.name ?? name,
                    },
                };
            }

            case 'createFineTunedModel': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name, settings: inputs.settings || {} };
                logger.log(`[Cohere] createFineTunedModel: name=${name}`);
                const data = await api('POST', '/finetuning/finetuned-models', body);
                return { output: data };
            }

            case 'listFineTunedModels': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.pageToken) params.set('page_token', String(inputs.pageToken));
                if (inputs.orderBy) params.set('order_by', String(inputs.orderBy));
                const query = params.toString();
                logger.log(`[Cohere] listFineTunedModels`);
                const data = await api('GET', `/finetuning/finetuned-models${query ? '?' + query : ''}`);
                return { output: { finetuned_models: data.finetuned_models ?? [], next_page_token: data.next_page_token ?? '' } };
            }

            case 'getFineTunedModel': {
                const fineTunedModelId = String(inputs.fineTunedModelId ?? inputs.modelId ?? '').trim();
                if (!fineTunedModelId) throw new Error('fineTunedModelId is required.');
                logger.log(`[Cohere] getFineTunedModel: id=${fineTunedModelId}`);
                const data = await api('GET', `/finetuning/finetuned-models/${fineTunedModelId}`);
                return { output: data };
            }

            case 'deleteFineTunedModel': {
                const fineTunedModelId = String(inputs.fineTunedModelId ?? inputs.modelId ?? '').trim();
                if (!fineTunedModelId) throw new Error('fineTunedModelId is required.');
                logger.log(`[Cohere] deleteFineTunedModel: id=${fineTunedModelId}`);
                const data = await api('DELETE', `/finetuning/finetuned-models/${fineTunedModelId}`);
                return { output: { success: true, deleted: fineTunedModelId, ...data } };
            }

            default:
                return { error: `Cohere action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Cohere action failed.' };
    }
}
