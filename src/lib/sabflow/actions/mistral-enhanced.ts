'use server';

export async function executeMistralEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.mistral.ai/v1';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'chatCompletion': {
                const body: any = {
                    model: inputs.model || 'mistral-small-latest',
                    messages: inputs.messages,
                };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.topP !== undefined) body.top_p = inputs.topP;
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'streamChatCompletion': {
                const body: any = {
                    model: inputs.model || 'mistral-small-latest',
                    messages: inputs.messages,
                    stream: true,
                };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.message || `HTTP ${res.status}` };
                }
                const text = await res.text();
                const lines = text.split('\n').filter(l => l.startsWith('data: ') && !l.includes('[DONE]'));
                const chunks = lines.map(l => {
                    try { return JSON.parse(l.replace('data: ', '')); } catch { return null; }
                }).filter(Boolean);
                return { output: { chunks, rawText: text } };
            }

            case 'createEmbedding': {
                const body: any = {
                    model: inputs.model || 'mistral-embed',
                    input: inputs.input,
                };
                if (inputs.encodingFormat) body.encoding_format = inputs.encodingFormat;
                const res = await fetch(`${baseUrl}/embeddings`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listModels': {
                const res = await fetch(`${baseUrl}/models`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getModel': {
                const modelId = inputs.modelId;
                const res = await fetch(`${baseUrl}/models/${modelId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'chatWithMistralLarge': {
                const body: any = {
                    model: 'mistral-large-latest',
                    messages: inputs.messages,
                };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.systemPrompt) {
                    body.messages = [{ role: 'system', content: inputs.systemPrompt }, ...(inputs.messages || [])];
                }
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'chatWithMistralSmall': {
                const body: any = {
                    model: 'mistral-small-latest',
                    messages: inputs.messages,
                };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'chatWithCodestral': {
                const body: any = {
                    model: 'codestral-latest',
                    messages: inputs.messages,
                };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.stopSequences) body.stop = inputs.stopSequences;
                const res = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'fimCompletion': {
                const body: any = {
                    model: inputs.model || 'codestral-latest',
                    prompt: inputs.prompt,
                    suffix: inputs.suffix || '',
                };
                if (inputs.maxTokens !== undefined) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.stopSequences) body.stop = inputs.stopSequences;
                const res = await fetch(`${baseUrl}/fim/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createBatch': {
                const body: any = {
                    model: inputs.model || 'mistral-small-latest',
                    input_files: inputs.inputFiles,
                    endpoint: inputs.endpoint || '/v1/chat/completions',
                    metadata: inputs.metadata || {},
                };
                const res = await fetch(`${baseUrl}/batch/jobs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getBatch': {
                const jobId = inputs.jobId;
                const res = await fetch(`${baseUrl}/batch/jobs/${jobId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'cancelBatch': {
                const jobId = inputs.jobId;
                const res = await fetch(`${baseUrl}/batch/jobs/${jobId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listBatches': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.pageSize) params.append('page_size', String(inputs.pageSize));
                if (inputs.status) params.append('status', inputs.status);
                const url = `${baseUrl}/batch/jobs${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'uploadFile': {
                const formData = new FormData();
                formData.append('purpose', inputs.purpose || 'batch');
                if (inputs.fileContent && inputs.fileName) {
                    const blob = new Blob([inputs.fileContent], { type: 'application/octet-stream' });
                    formData.append('file', blob, inputs.fileName);
                }
                const uploadHeaders: Record<string, string> = {
                    'Authorization': `Bearer ${apiKey}`,
                };
                const res = await fetch(`${baseUrl}/files`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listFiles': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.pageSize) params.append('page_size', String(inputs.pageSize));
                if (inputs.purpose) params.append('purpose', inputs.purpose);
                const url = `${baseUrl}/files${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`MistralEnhanced error: ${err.message}`);
        return { error: err.message || 'Unknown error occurred' };
    }
}
