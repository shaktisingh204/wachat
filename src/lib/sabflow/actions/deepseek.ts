'use server';

const DS_BASE = 'https://api.deepseek.com/v1';

async function dsFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[DeepSeek] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${DS_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `DeepSeek API error: ${res.status}`);
    }
    return data;
}

export async function executeDeepSeekAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const ds = (method: string, path: string, body?: any) => dsFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'chat':
            case 'createChatCompletion': {
                const model = String(inputs.model ?? 'deepseek-chat').trim();
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
                const data = await ds('POST', '/chat/completions', body);
                return { output: { ...data, message: data.choices?.[0]?.message } };
            }
            case 'createCompletion': {
                const model = String(inputs.model ?? 'deepseek-chat').trim();
                const prompt = inputs.prompt;
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                const data = await ds('POST', '/completions', body);
                return { output: { ...data, text: data.choices?.[0]?.text } };
            }
            case 'listModels': {
                const data = await ds('GET', '/models');
                return { output: { models: data.data ?? [] } };
            }
            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await ds('GET', `/models/${encodeURIComponent(modelId)}`);
                return { output: data };
            }
            case 'createEmbedding': {
                const model = String(inputs.model ?? 'deepseek-embedding').trim();
                const input = inputs.input ?? inputs.text;
                if (!input) throw new Error('input is required.');
                const data = await ds('POST', '/embeddings', { model, input });
                return { output: { ...data, embedding: data.data?.[0]?.embedding } };
            }
            case 'analyzeCode': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const language = inputs.language ? ` (${inputs.language})` : '';
                if (!code) throw new Error('code is required.');
                const messages = [
                    { role: 'system', content: 'You are an expert code analyst. Analyze the provided code and give a detailed analysis including: purpose, logic flow, potential issues, and suggestions.' },
                    { role: 'user', content: `Analyze this code${language}:\n\n\`\`\`\n${code}\n\`\`\`` },
                ];
                const data = await ds('POST', '/chat/completions', { model, messages });
                return { output: { analysis: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'explainCode': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const language = inputs.language ? ` (${inputs.language})` : '';
                if (!code) throw new Error('code is required.');
                const level = inputs.level ?? 'intermediate';
                const messages = [
                    { role: 'system', content: `Explain code clearly for a ${level} developer. Break it down step by step.` },
                    { role: 'user', content: `Explain this code${language}:\n\n\`\`\`\n${code}\n\`\`\`` },
                ];
                const data = await ds('POST', '/chat/completions', { model, messages });
                return { output: { explanation: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'refactorCode': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const language = inputs.language ? ` ${inputs.language}` : '';
                const goals = inputs.goals ?? 'improve readability, maintainability, and performance';
                if (!code) throw new Error('code is required.');
                const messages = [
                    { role: 'system', content: `You are an expert${language} developer. Refactor the provided code to ${goals}. Return only the refactored code with brief inline comments.` },
                    { role: 'user', content: `Refactor this code:\n\n\`\`\`\n${code}\n\`\`\`` },
                ];
                const data = await ds('POST', '/chat/completions', { model, messages });
                return { output: { refactoredCode: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'generateTests': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const framework = inputs.framework ?? 'Jest';
                const language = inputs.language ?? 'TypeScript';
                if (!code) throw new Error('code is required.');
                const messages = [
                    { role: 'system', content: `Generate comprehensive unit tests using ${framework} for the following ${language} code. Include edge cases and error scenarios.` },
                    { role: 'user', content: `\`\`\`\n${code}\n\`\`\`` },
                ];
                const data = await ds('POST', '/chat/completions', { model, messages });
                return { output: { tests: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'reviewCode': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const language = inputs.language ? ` ${inputs.language}` : '';
                if (!code) throw new Error('code is required.');
                const messages = [
                    {
                        role: 'system',
                        content: `Perform a thorough${language} code review. Identify bugs, security vulnerabilities, performance issues, code style violations, and best practice deviations. Return a structured JSON with fields: issues (array), suggestions (array), rating (1-10), summary (string).`,
                    },
                    { role: 'user', content: `Review this code:\n\n\`\`\`\n${code}\n\`\`\`` },
                ];
                const body: any = { model, messages, response_format: { type: 'json_object' } };
                const data = await ds('POST', '/chat/completions', body);
                const raw = data.choices?.[0]?.message?.content ?? '{}';
                let review: any;
                try { review = JSON.parse(raw); } catch { review = { raw }; }
                return { output: { review, ...data } };
            }
            case 'translateCode': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const sourceLanguage = inputs.sourceLanguage ?? 'auto-detect';
                const targetLanguage = String(inputs.targetLanguage ?? '').trim();
                if (!code || !targetLanguage) throw new Error('code and targetLanguage are required.');
                const messages = [
                    { role: 'system', content: `Translate the provided code from ${sourceLanguage} to ${targetLanguage}. Maintain the same logic and functionality. Return only the translated code.` },
                    { role: 'user', content: `\`\`\`\n${code}\n\`\`\`` },
                ];
                const data = await ds('POST', '/chat/completions', { model, messages });
                return { output: { translatedCode: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'debugCode': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const error = inputs.error ? String(inputs.error) : null;
                if (!code) throw new Error('code is required.');
                const userContent = error
                    ? `Debug this code:\n\n\`\`\`\n${code}\n\`\`\`\n\nError:\n${error}`
                    : `Find and fix bugs in this code:\n\n\`\`\`\n${code}\n\`\`\``;
                const messages = [
                    { role: 'system', content: 'You are an expert debugger. Identify the root cause of issues and provide the fixed code along with a clear explanation of each fix.' },
                    { role: 'user', content: userContent },
                ];
                const data = await ds('POST', '/chat/completions', { model, messages });
                return { output: { debuggedCode: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'optimizeCode': {
                const model = String(inputs.model ?? 'deepseek-coder').trim();
                const code = String(inputs.code ?? '').trim();
                const optimizationTarget = inputs.optimizationTarget ?? 'performance';
                const language = inputs.language ? ` ${inputs.language}` : '';
                if (!code) throw new Error('code is required.');
                const messages = [
                    { role: 'system', content: `Optimize the following${language} code for ${optimizationTarget}. Explain the optimizations applied and return the optimized code.` },
                    { role: 'user', content: `\`\`\`\n${code}\n\`\`\`` },
                ];
                const data = await ds('POST', '/chat/completions', { model, messages });
                return { output: { optimizedCode: data.choices?.[0]?.message?.content, ...data } };
            }
            case 'streamChat': {
                const model = String(inputs.model ?? 'deepseek-chat').trim();
                const messages = inputs.messages;
                if (!Array.isArray(messages)) throw new Error('messages must be an array.');
                const body: any = { model, messages, stream: true };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                const data = await ds('POST', '/chat/completions', body);
                return { output: data };
            }
            default:
                throw new Error(`Unknown DeepSeek action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[DeepSeek] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
