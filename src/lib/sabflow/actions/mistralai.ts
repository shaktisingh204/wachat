
'use server';

const MISTRAL_BASE = 'https://api.mistral.ai/v1';

async function mistralFetch(
    apiKey: string,
    method: string,
    path: string,
    logger: any,
    body?: any,
) {
    logger.log(`[MistralAI] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${MISTRAL_BASE}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || data?.error?.message || `Mistral API error: ${res.status}`);
    return data;
}

export async function executeMistralaiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const api = (method: string, path: string, body?: any) => mistralFetch(apiKey, method, path, logger, body);

        switch (actionName) {
            case 'chatComplete': {
                const model = String(inputs.model ?? 'mistral-small-latest').trim();
                const messages = inputs.messages;
                if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages must be a non-empty array.');
                const body: any = { model, messages, stream: false };
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                logger.log(`[MistralAI] chatComplete: model=${model}`);
                const data = await api('POST', '/chat/completions', body);
                return {
                    output: {
                        id: data.id ?? '',
                        choices: data.choices ?? [],
                        usage: data.usage ?? {},
                    },
                };
            }

            case 'complete': {
                const model = String(inputs.model ?? 'codestral-latest').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { model, prompt };
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                logger.log(`[MistralAI] complete: model=${model}`);
                const data = await api('POST', '/fim/completions', body);
                return {
                    output: {
                        id: data.id ?? '',
                        choices: data.choices ?? [],
                        usage: data.usage ?? {},
                    },
                };
            }

            case 'embeddings': {
                const model = String(inputs.model ?? 'mistral-embed').trim();
                const input = inputs.input;
                if (!input) throw new Error('input is required.');
                logger.log(`[MistralAI] embeddings: model=${model}`);
                const data = await api('POST', '/embeddings', { model, input });
                return {
                    output: {
                        data: data.data ?? [],
                        usage: data.usage ?? {},
                    },
                };
            }

            case 'listModels': {
                logger.log(`[MistralAI] listModels`);
                const data = await api('GET', '/models');
                return {
                    output: {
                        data: data.data ?? [],
                    },
                };
            }

            case 'getModel': {
                const modelId = String(inputs.modelId ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                logger.log(`[MistralAI] getModel: modelId=${modelId}`);
                const data = await api('GET', `/models/${modelId}`);
                return {
                    output: {
                        id: data.id ?? modelId,
                        owned_by: data.owned_by ?? '',
                        capabilities: data.capabilities ?? {},
                    },
                };
            }

            case 'deleteModel': {
                const modelId = String(inputs.modelId ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                logger.log(`[MistralAI] deleteModel: modelId=${modelId}`);
                const data = await api('DELETE', `/models/${modelId}`);
                return {
                    output: {
                        id: data.id ?? modelId,
                        deleted: data.deleted ?? true,
                    },
                };
            }

            case 'createFineTuningJob': {
                const model = String(inputs.model ?? '').trim();
                const trainingFiles = inputs.trainingFiles;
                if (!model) throw new Error('model is required.');
                if (!Array.isArray(trainingFiles) || trainingFiles.length === 0) throw new Error('trainingFiles must be a non-empty array.');
                const body: any = { model, training_files: trainingFiles };
                if (inputs.hyperparameters) body.hyperparameters = inputs.hyperparameters;
                logger.log(`[MistralAI] createFineTuningJob: model=${model}`);
                const data = await api('POST', '/fine_tuning/jobs', body);
                return {
                    output: {
                        id: data.id ?? '',
                        status: data.status ?? '',
                    },
                };
            }

            case 'getFineTuningJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                logger.log(`[MistralAI] getFineTuningJob: jobId=${jobId}`);
                const data = await api('GET', `/fine_tuning/jobs/${jobId}`);
                return {
                    output: {
                        id: data.id ?? jobId,
                        status: data.status ?? '',
                        fine_tuned_model: data.fine_tuned_model ?? null,
                    },
                };
            }

            case 'listFineTuningJobs': {
                logger.log(`[MistralAI] listFineTuningJobs`);
                const data = await api('GET', '/fine_tuning/jobs');
                return {
                    output: {
                        data: data.data ?? [],
                    },
                };
            }

            case 'cancelFineTuningJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                if (!jobId) throw new Error('jobId is required.');
                logger.log(`[MistralAI] cancelFineTuningJob: jobId=${jobId}`);
                const data = await api('POST', `/fine_tuning/jobs/${jobId}/cancel`);
                return {
                    output: {
                        id: data.id ?? jobId,
                        status: data.status ?? 'cancelled',
                    },
                };
            }

            case 'uploadFile': {
                const purpose = String(inputs.purpose ?? 'fine-tune').trim();
                const fileContent = String(inputs.fileContent ?? '').trim();
                const filename = String(inputs.filename ?? 'upload.jsonl').trim();
                if (!fileContent) throw new Error('fileContent is required.');
                logger.log(`[MistralAI] uploadFile: filename=${filename}, purpose=${purpose}`);
                const formData = new FormData();
                const blob = new Blob([fileContent], { type: 'application/octet-stream' });
                formData.append('file', blob, filename);
                formData.append('purpose', purpose);
                const res = await fetch(`${MISTRAL_BASE}/files`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}` },
                    body: formData,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.message || `Mistral file upload error: ${res.status}`);
                return {
                    output: {
                        id: data.id ?? '',
                        purpose: data.purpose ?? purpose,
                        filename: data.filename ?? filename,
                    },
                };
            }

            case 'listFiles': {
                logger.log(`[MistralAI] listFiles`);
                const data = await api('GET', '/files');
                return {
                    output: {
                        data: data.data ?? [],
                    },
                };
            }

            default:
                return { error: `MistralAI action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'MistralAI action failed.' };
    }
}
