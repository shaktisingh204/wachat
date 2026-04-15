'use server';

export async function executeAnthropicClaudeAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.anthropic.com/v1';

    function buildHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'x-api-key': inputs.apiKey || '',
            'anthropic-version': inputs.anthropicVersion || '2023-06-01',
        };
    }

    try {
        switch (actionName) {
            case 'createMessage': {
                const res = await fetch(`${BASE_URL}/messages`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'claude-3-5-sonnet-20241022',
                        max_tokens: inputs.maxTokens || 1024,
                        messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                        system: inputs.system,
                        temperature: inputs.temperature,
                        top_p: inputs.topP,
                        top_k: inputs.topK,
                        stop_sequences: inputs.stopSequences,
                        metadata: inputs.metadata,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createMessage failed' };
                return { output: data };
            }

            case 'createMessageWithTools': {
                const res = await fetch(`${BASE_URL}/messages`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'claude-3-5-sonnet-20241022',
                        max_tokens: inputs.maxTokens || 1024,
                        messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                        tools: inputs.tools || [],
                        tool_choice: inputs.toolChoice,
                        system: inputs.system,
                        temperature: inputs.temperature,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createMessageWithTools failed' };
                return { output: data };
            }

            case 'countTokens': {
                const res = await fetch(`${BASE_URL}/messages/count_tokens`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'claude-3-5-sonnet-20241022',
                        messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                        system: inputs.system,
                        tools: inputs.tools,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'countTokens failed' };
                return { output: data };
            }

            case 'createBatch': {
                const res = await fetch(`${BASE_URL}/messages/batches`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({ requests: inputs.requests || [] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createBatch failed' };
                return { output: data };
            }

            case 'getBatch': {
                const batchId = inputs.batchId || inputs.id;
                const res = await fetch(`${BASE_URL}/messages/batches/${batchId}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getBatch failed' };
                return { output: data };
            }

            case 'cancelBatch': {
                const batchId = inputs.batchId || inputs.id;
                const res = await fetch(`${BASE_URL}/messages/batches/${batchId}/cancel`, {
                    method: 'POST',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'cancelBatch failed' };
                return { output: data };
            }

            case 'listBatches': {
                const params = new URLSearchParams();
                if (inputs.beforeId) params.set('before_id', inputs.beforeId);
                if (inputs.afterId) params.set('after_id', inputs.afterId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString();
                const res = await fetch(`${BASE_URL}/messages/batches${query ? '?' + query : ''}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listBatches failed' };
                return { output: data };
            }

            case 'getBatchResults': {
                const batchId = inputs.batchId || inputs.id;
                const res = await fetch(`${BASE_URL}/messages/batches/${batchId}/results`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const text = await res.text();
                if (!res.ok) return { error: 'getBatchResults failed' };
                const lines = text.trim().split('\n').filter(Boolean).map((l) => {
                    try { return JSON.parse(l); } catch { return l; }
                });
                return { output: { results: lines } };
            }

            case 'streamMessage': {
                const res = await fetch(`${BASE_URL}/messages`, {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: inputs.model || 'claude-3-5-sonnet-20241022',
                        max_tokens: inputs.maxTokens || 1024,
                        messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                        stream: true,
                        system: inputs.system,
                        temperature: inputs.temperature,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'streamMessage failed' };
                return { output: data };
            }

            case 'createEmbedding': {
                return {
                    error: 'Anthropic does not currently offer an embeddings API. Consider using a different provider such as OpenAI, Cohere, or Google Gemini for embedding functionality.',
                };
            }

            case 'listModels': {
                const params = new URLSearchParams();
                if (inputs.beforeId) params.set('before_id', inputs.beforeId);
                if (inputs.afterId) params.set('after_id', inputs.afterId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString();
                const res = await fetch(`${BASE_URL}/models${query ? '?' + query : ''}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listModels failed' };
                return { output: data };
            }

            case 'getModel': {
                const modelId = inputs.modelId || inputs.model;
                const res = await fetch(`${BASE_URL}/models/${modelId}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getModel failed' };
                return { output: data };
            }

            case 'createFile': {
                const formData = new FormData();
                if (inputs.file) formData.append('file', inputs.file);
                if (inputs.purpose) formData.append('purpose', inputs.purpose);
                const headers = buildHeaders();
                delete headers['Content-Type']; // let fetch set multipart boundary
                const res = await fetch(`${BASE_URL}/files`, {
                    method: 'POST',
                    headers,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createFile failed' };
                return { output: data };
            }

            case 'getFile': {
                const fileId = inputs.fileId || inputs.id;
                const res = await fetch(`${BASE_URL}/files/${fileId}`, {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getFile failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown Anthropic Claude action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Anthropic Claude action error: ${err.message}`);
        return { error: err.message || 'Anthropic Claude action failed' };
    }
}
