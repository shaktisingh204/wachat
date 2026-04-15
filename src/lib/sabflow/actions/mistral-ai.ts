'use server';

export async function executeMistralAiAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.mistral.ai/v1';

    function buildHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${inputs.apiKey || ''}`,
        };
    }

    try {
        switch (actionName) {
            case 'createChatCompletion': {
                const res = await fetch(`${BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'mistral-small-latest',
                        messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                        temperature: inputs.temperature,
                        top_p: inputs.topP,
                        max_tokens: inputs.maxTokens,
                        stream: false,
                        safe_prompt: inputs.safePrompt,
                        random_seed: inputs.randomSeed,
                        response_format: inputs.responseFormat,
                        tools: inputs.tools,
                        tool_choice: inputs.toolChoice,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'createChatCompletion failed' };
                return { output: data };
            }

            case 'streamChatCompletion': {
                const res = await fetch(`${BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'mistral-small-latest',
                        messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                        temperature: inputs.temperature,
                        top_p: inputs.topP,
                        max_tokens: inputs.maxTokens,
                        stream: true,
                        safe_prompt: inputs.safePrompt,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'streamChatCompletion failed' };
                return { output: data };
            }

            case 'createEmbedding': {
                const res = await fetch(`${BASE_URL}/embeddings`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'mistral-embed',
                        input: inputs.input || inputs.texts || [inputs.text || ''],
                        encoding_format: inputs.encodingFormat || 'float',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'createEmbedding failed' };
                return { output: data };
            }

            case 'listModels': {
                const res = await fetch(`${BASE_URL}/models`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'listModels failed' };
                return { output: data };
            }

            case 'getModel': {
                const modelId = inputs.modelId || inputs.model;
                const res = await fetch(`${BASE_URL}/models/${modelId}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'getModel failed' };
                return { output: data };
            }

            case 'deleteModel': {
                const modelId = inputs.modelId || inputs.model;
                const res = await fetch(`${BASE_URL}/models/${modelId}`, {
                    method: 'DELETE',
                    headers: buildHeaders(),
                });
                if (res.status === 204 || res.ok) return { output: { success: true, deleted: modelId } };
                const data = await res.json();
                return { error: data.message || data.error?.message || 'deleteModel failed' };
            }

            case 'createFineTuningJob': {
                const res = await fetch(`${BASE_URL}/fine_tuning/jobs`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'open-mistral-7b',
                        training_files: inputs.trainingFiles || [],
                        validation_files: inputs.validationFiles,
                        hyperparameters: inputs.hyperparameters,
                        suffix: inputs.suffix,
                        integrations: inputs.integrations,
                        repositories: inputs.repositories,
                        auto_start: inputs.autoStart,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'createFineTuningJob failed' };
                return { output: data };
            }

            case 'getFineTuningJob': {
                const jobId = inputs.jobId || inputs.id;
                const res = await fetch(`${BASE_URL}/fine_tuning/jobs/${jobId}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'getFineTuningJob failed' };
                return { output: data };
            }

            case 'listFineTuningJobs': {
                const params = new URLSearchParams();
                if (inputs.page !== undefined) params.set('page', String(inputs.page));
                if (inputs.pageSize !== undefined) params.set('page_size', String(inputs.pageSize));
                if (inputs.model) params.set('model', inputs.model);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.createdAfter) params.set('created_after', inputs.createdAfter);
                if (inputs.createdByMe !== undefined) params.set('created_by_me', String(inputs.createdByMe));
                const query = params.toString();
                const res = await fetch(`${BASE_URL}/fine_tuning/jobs${query ? '?' + query : ''}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'listFineTuningJobs failed' };
                return { output: data };
            }

            case 'cancelFineTuningJob': {
                const jobId = inputs.jobId || inputs.id;
                const res = await fetch(`${BASE_URL}/fine_tuning/jobs/${jobId}/cancel`, {
                    method: 'POST',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'cancelFineTuningJob failed' };
                return { output: data };
            }

            case 'uploadFile': {
                const formData = new FormData();
                if (inputs.file) formData.append('file', inputs.file);
                if (inputs.purpose) formData.append('purpose', inputs.purpose || 'fine-tune');
                const headers = buildHeaders();
                delete headers['Content-Type'];
                const res = await fetch(`${BASE_URL}/files`, {
                    method: 'POST',
                    headers,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'uploadFile failed' };
                return { output: data };
            }

            case 'listFiles': {
                const params = new URLSearchParams();
                if (inputs.page !== undefined) params.set('page', String(inputs.page));
                if (inputs.pageSize !== undefined) params.set('page_size', String(inputs.pageSize));
                if (inputs.sampleType) params.set('sample_type', inputs.sampleType);
                if (inputs.source) params.set('source', inputs.source);
                if (inputs.search) params.set('search', inputs.search);
                const query = params.toString();
                const res = await fetch(`${BASE_URL}/files${query ? '?' + query : ''}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'listFiles failed' };
                return { output: data };
            }

            case 'deleteFile': {
                const fileId = inputs.fileId || inputs.id;
                const res = await fetch(`${BASE_URL}/files/${fileId}`, {
                    method: 'DELETE',
                    headers: buildHeaders(),
                });
                if (res.status === 204 || res.ok) return { output: { success: true, deleted: fileId } };
                const data = await res.json();
                return { error: data.message || data.error?.message || 'deleteFile failed' };
            }

            case 'createBatch': {
                const res = await fetch(`${BASE_URL}/batch/jobs`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        input_files: inputs.inputFiles || [],
                        endpoint: inputs.endpoint || '/v1/chat/completions',
                        model: inputs.model,
                        metadata: inputs.metadata,
                        timeout_hours: inputs.timeoutHours,
                        completion_window: inputs.completionWindow,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'createBatch failed' };
                return { output: data };
            }

            case 'getBatch': {
                const batchId = inputs.batchId || inputs.id;
                const res = await fetch(`${BASE_URL}/batch/jobs/${batchId}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error?.message || 'getBatch failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown Mistral AI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Mistral AI action error: ${err.message}`);
        return { error: err.message || 'Mistral AI action failed' };
    }
}
