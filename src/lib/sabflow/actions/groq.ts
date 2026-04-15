'use server';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

async function groqFetch(
    apiKey: string,
    method: string,
    path: string,
    logger: any,
    body?: any,
    isFormData?: boolean,
): Promise<any> {
    logger.log(`[Groq] ${method} ${path}`);
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
    };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = isFormData ? body : JSON.stringify(body);
    const res = await fetch(`${GROQ_BASE}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `Groq API error: ${res.status}`);
    return data;
}

export async function executeGroqAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const api = (method: string, path: string, body?: any, isFormData?: boolean) =>
            groqFetch(apiKey, method, path, logger, body, isFormData);

        switch (actionName) {
            case 'chat':
            case 'createChatCompletion': {
                const model = String(inputs.model ?? 'llama3-8b-8192').trim();
                const messages = inputs.messages ?? [{ role: 'user', content: String(inputs.message ?? inputs.prompt ?? '') }];
                const body: any = { model, messages };
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                if (inputs.topP !== undefined) body.top_p = Number(inputs.topP);
                if (inputs.stop !== undefined) body.stop = inputs.stop;
                if (inputs.stream === true) body.stream = false; // server actions don't support streaming
                logger.log(`[Groq] chat: model=${model}, messages=${messages.length}`);
                const data = await api('POST', '/chat/completions', body);
                return { output: { id: data.id, model: data.model, content: data.choices?.[0]?.message?.content ?? '', choices: data.choices, usage: data.usage } };
            }

            case 'listModels': {
                const data = await api('GET', '/models');
                return { output: { models: data.data ?? [], total: data.data?.length ?? 0 } };
            }

            case 'getModel': {
                const modelId = String(inputs.modelId ?? inputs.model ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await api('GET', `/models/${modelId}`);
                return { output: data };
            }

            case 'createTranscription': {
                const audioUrl = String(inputs.audioUrl ?? '').trim();
                const audioBase64 = String(inputs.audioBase64 ?? '').trim();
                if (!audioUrl && !audioBase64) throw new Error('audioUrl or audioBase64 is required.');
                const model = String(inputs.model ?? 'whisper-large-v3').trim();
                const formData = new FormData();
                formData.append('model', model);
                if (audioBase64) {
                    const buffer = Buffer.from(audioBase64, 'base64');
                    const blob = new Blob([buffer], { type: inputs.mimeType ?? 'audio/mp3' });
                    formData.append('file', blob, inputs.filename ?? 'audio.mp3');
                } else {
                    formData.append('file', audioUrl);
                }
                if (inputs.language) formData.append('language', String(inputs.language));
                if (inputs.prompt) formData.append('prompt', String(inputs.prompt));
                if (inputs.responseFormat) formData.append('response_format', String(inputs.responseFormat));
                const data = await api('POST', '/audio/transcriptions', formData, true);
                return { output: { text: data.text ?? '', segments: data.segments ?? [], language: data.language } };
            }

            case 'createTranslation': {
                const audioBase64 = String(inputs.audioBase64 ?? '').trim();
                if (!audioBase64) throw new Error('audioBase64 is required.');
                const model = String(inputs.model ?? 'whisper-large-v3').trim();
                const formData = new FormData();
                formData.append('model', model);
                const buffer = Buffer.from(audioBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'audio/mp3' });
                formData.append('file', blob, inputs.filename ?? 'audio.mp3');
                if (inputs.prompt) formData.append('prompt', String(inputs.prompt));
                const data = await api('POST', '/audio/translations', formData, true);
                return { output: { text: data.text ?? '' } };
            }

            case 'createEmbedding': {
                const model = String(inputs.model ?? 'nomic-embed-text-v1_5').trim();
                const input = inputs.input ?? inputs.text ?? '';
                const body: any = { model, input };
                if (inputs.encodingFormat) body.encoding_format = String(inputs.encodingFormat);
                const data = await api('POST', '/embeddings', body);
                return { output: { embedding: data.data?.[0]?.embedding ?? [], data: data.data, usage: data.usage } };
            }

            case 'streamChat': {
                // Non-streaming fallback for server environment
                const model = String(inputs.model ?? 'llama3-8b-8192').trim();
                const messages = inputs.messages ?? [{ role: 'user', content: String(inputs.message ?? inputs.prompt ?? '') }];
                const body: any = { model, messages, stream: false };
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                const data = await api('POST', '/chat/completions', body);
                return { output: { content: data.choices?.[0]?.message?.content ?? '', usage: data.usage } };
            }

            case 'batchChat': {
                const model = String(inputs.model ?? 'llama3-8b-8192').trim();
                const batchMessages: any[] = inputs.batchMessages ?? [];
                if (!batchMessages.length) throw new Error('batchMessages array is required.');
                const results = await Promise.all(
                    batchMessages.map((msgs: any) =>
                        api('POST', '/chat/completions', { model, messages: Array.isArray(msgs) ? msgs : [{ role: 'user', content: String(msgs) }] })
                    )
                );
                return { output: { results: results.map((d: any) => ({ content: d.choices?.[0]?.message?.content ?? '', usage: d.usage })) } };
            }

            case 'createCompletion': {
                const model = String(inputs.model ?? 'llama3-8b-8192').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                const data = await api('POST', '/completions', body);
                return { output: { text: data.choices?.[0]?.text ?? '', choices: data.choices, usage: data.usage } };
            }

            case 'listFiles': {
                const data = await api('GET', '/files');
                return { output: { files: data.data ?? [], total: data.data?.length ?? 0 } };
            }

            case 'uploadFile': {
                const fileBase64 = String(inputs.fileBase64 ?? '').trim();
                const purpose = String(inputs.purpose ?? 'assistants').trim();
                if (!fileBase64) throw new Error('fileBase64 is required.');
                const formData = new FormData();
                const buffer = Buffer.from(fileBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'application/octet-stream' });
                formData.append('file', blob, inputs.filename ?? 'file.bin');
                formData.append('purpose', purpose);
                const data = await api('POST', '/files', formData, true);
                return { output: data };
            }

            case 'deleteFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await api('DELETE', `/files/${fileId}`);
                return { output: { deleted: data.deleted ?? true, id: fileId } };
            }

            case 'getFile': {
                const fileId = String(inputs.fileId ?? '').trim();
                if (!fileId) throw new Error('fileId is required.');
                const data = await api('GET', `/files/${fileId}`);
                return { output: data };
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

            default:
                throw new Error(`Unknown Groq action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[Groq] Error in action "${actionName}": ${err.message}`);
        return { error: err.message ?? 'Unknown Groq error' };
    }
}
