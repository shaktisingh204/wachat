'use server';

export async function executeCohereEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.cohere.com/v2';
    const apiKey = inputs.apiKey;

    if (!apiKey) {
        return { error: 'Missing required credential: inputs.apiKey' };
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'chat': {
                const body: any = {
                    model: inputs.model || 'command-r-plus',
                    messages: inputs.messages || [{ role: 'user', content: inputs.message || '' }],
                };
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.maxTokens) body.max_tokens = inputs.maxTokens;
                if (inputs.tools) body.tools = inputs.tools;
                const res = await fetch(`${BASE_URL}/chat`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere chat failed' };
                return { output: data };
            }

            case 'chatWithTools': {
                const body: any = {
                    model: inputs.model || 'command-r-plus',
                    messages: inputs.messages || [{ role: 'user', content: inputs.message || '' }],
                    tools: inputs.tools || [],
                };
                if (inputs.toolChoice) body.tool_choice = inputs.toolChoice;
                const res = await fetch(`${BASE_URL}/chat`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere chatWithTools failed' };
                return { output: data };
            }

            case 'createEmbedding': {
                const body: any = {
                    model: inputs.model || 'embed-english-v3.0',
                    texts: inputs.texts || [inputs.text || ''],
                    input_type: inputs.inputType || 'search_document',
                    embedding_types: inputs.embeddingTypes || ['float'],
                };
                const res = await fetch(`${BASE_URL}/embed`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere createEmbedding failed' };
                return { output: data };
            }

            case 'listEmbeddingJobs': {
                const res = await fetch(`${BASE_URL}/embed-jobs`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere listEmbeddingJobs failed' };
                return { output: data };
            }

            case 'createEmbeddingJob': {
                const body: any = {
                    model: inputs.model || 'embed-english-v3.0',
                    dataset_id: inputs.datasetId,
                    input_type: inputs.inputType || 'search_document',
                    embedding_types: inputs.embeddingTypes || ['float'],
                };
                if (inputs.name) body.name = inputs.name;
                const res = await fetch(`${BASE_URL}/embed-jobs`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere createEmbeddingJob failed' };
                return { output: data };
            }

            case 'getEmbeddingJob': {
                const jobId = inputs.jobId;
                if (!jobId) return { error: 'Missing inputs.jobId' };
                const res = await fetch(`${BASE_URL}/embed-jobs/${jobId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere getEmbeddingJob failed' };
                return { output: data };
            }

            case 'rerank': {
                const body: any = {
                    model: inputs.model || 'rerank-english-v3.0',
                    query: inputs.query,
                    documents: inputs.documents || [],
                };
                if (inputs.topN) body.top_n = inputs.topN;
                if (inputs.returnDocuments !== undefined) body.return_documents = inputs.returnDocuments;
                const res = await fetch(`${BASE_URL}/rerank`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere rerank failed' };
                return { output: data };
            }

            case 'classify': {
                const body: any = {
                    model: inputs.model || 'embed-english-v2.0',
                    inputs: inputs.inputs || [inputs.input || ''],
                    examples: inputs.examples || [],
                };
                const res = await fetch(`${BASE_URL}/classify`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere classify failed' };
                return { output: data };
            }

            case 'generate': {
                const body: any = {
                    model: inputs.model || 'command',
                    prompt: inputs.prompt || '',
                };
                if (inputs.maxTokens) body.max_tokens = inputs.maxTokens;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                if (inputs.numGenerations) body.num_generations = inputs.numGenerations;
                if (inputs.stopSequences) body.stop_sequences = inputs.stopSequences;
                const res = await fetch(`${BASE_URL}/generate`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere generate failed' };
                return { output: data };
            }

            case 'listModels': {
                const params = new URLSearchParams();
                if (inputs.endpoint) params.set('endpoint', inputs.endpoint);
                if (inputs.defaultOnly !== undefined) params.set('default_only', String(inputs.defaultOnly));
                const url = `${BASE_URL}/models${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere listModels failed' };
                return { output: data };
            }

            case 'getModel': {
                const model = inputs.model;
                if (!model) return { error: 'Missing inputs.model' };
                const res = await fetch(`${BASE_URL}/models/${model}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere getModel failed' };
                return { output: data };
            }

            case 'detectLanguage': {
                const body = {
                    texts: inputs.texts || [inputs.text || ''],
                };
                const res = await fetch(`${BASE_URL}/detect-language`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere detectLanguage failed' };
                return { output: data };
            }

            case 'summarize': {
                const body: any = {
                    text: inputs.text || '',
                    model: inputs.model || 'command',
                    length: inputs.length || 'medium',
                    format: inputs.format || 'paragraph',
                    extractiveness: inputs.extractiveness || 'low',
                };
                if (inputs.additionalCommand) body.additional_command = inputs.additionalCommand;
                const res = await fetch(`${BASE_URL}/summarize`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere summarize failed' };
                return { output: data };
            }

            case 'tokenize': {
                const body = {
                    text: inputs.text || '',
                    model: inputs.model || 'command',
                };
                const res = await fetch(`${BASE_URL}/tokenize`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere tokenize failed' };
                return { output: data };
            }

            case 'detokenize': {
                const body = {
                    tokens: inputs.tokens || [],
                    model: inputs.model || 'command',
                };
                const res = await fetch(`${BASE_URL}/detokenize`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Cohere detokenize failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown Cohere Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`CohereEnhanced error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Cohere Enhanced action failed' };
    }
}
