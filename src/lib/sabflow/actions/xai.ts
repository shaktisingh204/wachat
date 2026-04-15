'use server';

const XAI_BASE = 'https://api.x.ai/v1';

async function xaiFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[xAI] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${XAI_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `xAI API error: ${res.status}`);
    }
    return data;
}

export async function executeXAiAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const xai = (method: string, path: string, body?: any) => xaiFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'chat':
            case 'createChatCompletion': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const messages = inputs.messages;
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                if (inputs.tools !== undefined) body.tools = inputs.tools;
                if (inputs.toolChoice !== undefined) body.tool_choice = inputs.toolChoice;
                if (inputs.responseFormat !== undefined) body.response_format = inputs.responseFormat;
                if (inputs.seed !== undefined) body.seed = inputs.seed;
                const data = await xai('POST', '/chat/completions', body);
                return { output: { ...data, message: data.choices?.[0]?.message } };
            }
            case 'listModels': {
                const data = await xai('GET', '/models');
                return { output: { models: data.data ?? [] } };
            }
            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await xai('GET', `/models/${encodeURIComponent(modelId)}`);
                return { output: data };
            }
            case 'createEmbedding': {
                const model = String(inputs.model ?? 'v1').trim();
                const input = inputs.input ?? inputs.text;
                if (!input) throw new Error('input is required.');
                const data = await xai('POST', '/embeddings', { model, input });
                return { output: { ...data, embedding: data.data?.[0]?.embedding } };
            }
            case 'streamChat': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const messages = inputs.messages;
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages, stream: true };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                const data = await xai('POST', '/chat/completions', body);
                return { output: data };
            }
            case 'createCompletion': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const prompt = inputs.prompt;
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                const data = await xai('POST', '/completions', body);
                return { output: { ...data, text: data.choices?.[0]?.text } };
            }
            case 'analyzeImage': {
                const model = String(inputs.model ?? 'grok-2-vision').trim();
                const imageUrl = String(inputs.imageUrl ?? inputs.url ?? '').trim();
                const prompt = String(inputs.prompt ?? 'Describe this image.').trim();
                if (!imageUrl) throw new Error('imageUrl is required.');
                const messages = [
                    {
                        role: 'user',
                        content: [
                            { type: 'image_url', image_url: { url: imageUrl } },
                            { type: 'text', text: prompt },
                        ],
                    },
                ];
                const data = await xai('POST', '/chat/completions', { model, messages });
                return { output: { ...data, message: data.choices?.[0]?.message } };
            }
            case 'generateText': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const messages = [{ role: 'user', content: prompt }];
                const body: any = { model, messages };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                const data = await xai('POST', '/chat/completions', body);
                return { output: { text: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'summarizeText': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const text = String(inputs.text ?? inputs.content ?? '').trim();
                if (!text) throw new Error('text is required.');
                const style = inputs.style ? ` in ${inputs.style} style` : '';
                const messages = [
                    { role: 'system', content: `Summarize the following text concisely${style}.` },
                    { role: 'user', content: text },
                ];
                const data = await xai('POST', '/chat/completions', { model, messages });
                return { output: { summary: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'translateText': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const text = String(inputs.text ?? inputs.content ?? '').trim();
                const targetLanguage = String(inputs.targetLanguage ?? inputs.language ?? 'English').trim();
                if (!text) throw new Error('text is required.');
                const messages = [
                    { role: 'system', content: `Translate the following text to ${targetLanguage}. Return only the translated text.` },
                    { role: 'user', content: text },
                ];
                const data = await xai('POST', '/chat/completions', { model, messages });
                return { output: { translation: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'extractData': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const text = String(inputs.text ?? inputs.content ?? '').trim();
                const schema = inputs.schema ? JSON.stringify(inputs.schema) : 'key-value pairs';
                if (!text) throw new Error('text is required.');
                const messages = [
                    { role: 'system', content: `Extract structured data from the text following this schema: ${schema}. Return valid JSON.` },
                    { role: 'user', content: text },
                ];
                const body: any = { model, messages, response_format: { type: 'json_object' } };
                const data = await xai('POST', '/chat/completions', body);
                const raw = data.choices?.[0]?.message?.content ?? '{}';
                let extracted: any;
                try { extracted = JSON.parse(raw); } catch { extracted = raw; }
                return { output: { extracted, ...data } };
            }
            case 'classifyText': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const text = String(inputs.text ?? inputs.content ?? '').trim();
                const categories = Array.isArray(inputs.categories) ? inputs.categories.join(', ') : String(inputs.categories ?? '');
                if (!text) throw new Error('text is required.');
                const messages = [
                    {
                        role: 'system',
                        content: categories
                            ? `Classify the following text into one of these categories: ${categories}. Return only the category name.`
                            : 'Classify the following text. Return only the classification label.',
                    },
                    { role: 'user', content: text },
                ];
                const data = await xai('POST', '/chat/completions', { model, messages });
                return { output: { category: data.choices?.[0]?.message?.content?.trim(), ...data } };
            }
            case 'sentimentAnalysis': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const text = String(inputs.text ?? inputs.content ?? '').trim();
                if (!text) throw new Error('text is required.');
                const messages = [
                    { role: 'system', content: 'Analyze the sentiment of the following text. Return a JSON object with fields: sentiment (positive/negative/neutral), score (0-1), and explanation.' },
                    { role: 'user', content: text },
                ];
                const body: any = { model, messages, response_format: { type: 'json_object' } };
                const data = await xai('POST', '/chat/completions', body);
                const raw = data.choices?.[0]?.message?.content ?? '{}';
                let sentiment: any;
                try { sentiment = JSON.parse(raw); } catch { sentiment = { raw }; }
                return { output: { sentiment, ...data } };
            }
            case 'questionAnswer': {
                const model = String(inputs.model ?? 'grok-3').trim();
                const question = String(inputs.question ?? inputs.prompt ?? '').trim();
                const context = inputs.context ? String(inputs.context) : null;
                if (!question) throw new Error('question is required.');
                const messages: any[] = [];
                if (context) messages.push({ role: 'system', content: `Answer the question based on the following context:\n\n${context}` });
                messages.push({ role: 'user', content: question });
                const body: any = { model, messages };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                const data = await xai('POST', '/chat/completions', body);
                return { output: { answer: data.choices?.[0]?.message?.content, ...data } };
            }
            default:
                throw new Error(`Unknown xAI action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[xAI] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
