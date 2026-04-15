'use server';

export async function executeGoogleGeminiAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
    const apiKey = inputs.apiKey;
    const accessToken = inputs.accessToken;

    function buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return headers;
    }

    function buildUrl(path: string): string {
        const url = `${BASE_URL}${path}`;
        if (apiKey && !accessToken) {
            return `${url}${url.includes('?') ? '&' : '?'}key=${apiKey}`;
        }
        return url;
    }

    try {
        switch (actionName) {
            case 'generateContent': {
                const model = inputs.model || 'gemini-pro';
                const res = await fetch(buildUrl(`/models/${model}:generateContent`), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        contents: inputs.contents || [{ parts: [{ text: inputs.prompt || '' }] }],
                        generationConfig: inputs.generationConfig,
                        safetySettings: inputs.safetySettings,
                        systemInstruction: inputs.systemInstruction,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateContent failed' };
                return { output: data };
            }

            case 'streamGenerateContent': {
                const model = inputs.model || 'gemini-pro';
                const res = await fetch(buildUrl(`/models/${model}:streamGenerateContent`), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        contents: inputs.contents || [{ parts: [{ text: inputs.prompt || '' }] }],
                        generationConfig: inputs.generationConfig,
                        safetySettings: inputs.safetySettings,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'streamGenerateContent failed' };
                return { output: data };
            }

            case 'countTokens': {
                const model = inputs.model || 'gemini-pro';
                const res = await fetch(buildUrl(`/models/${model}:countTokens`), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        contents: inputs.contents || [{ parts: [{ text: inputs.prompt || '' }] }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'countTokens failed' };
                return { output: data };
            }

            case 'embedContent': {
                const model = inputs.model || 'embedding-001';
                const res = await fetch(buildUrl(`/models/${model}:embedContent`), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        model: `models/${model}`,
                        content: inputs.content || { parts: [{ text: inputs.text || '' }] },
                        taskType: inputs.taskType,
                        title: inputs.title,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'embedContent failed' };
                return { output: data };
            }

            case 'batchEmbedContent': {
                const model = inputs.model || 'embedding-001';
                const res = await fetch(buildUrl(`/models/${model}:batchEmbedContents`), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({ requests: inputs.requests || [] }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'batchEmbedContent failed' };
                return { output: data };
            }

            case 'listModels': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const query = params.toString();
                const res = await fetch(buildUrl(`/models${query ? '?' + query : ''}`), {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listModels failed' };
                return { output: data };
            }

            case 'getModel': {
                const model = inputs.model || 'gemini-pro';
                const res = await fetch(buildUrl(`/models/${model}`), {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getModel failed' };
                return { output: data };
            }

            case 'createTunedModel': {
                const res = await fetch(buildUrl('/tunedModels'), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        displayName: inputs.displayName,
                        baseModel: inputs.baseModel || 'models/gemini-1.0-pro-001',
                        tuningTask: inputs.tuningTask,
                        temperature: inputs.temperature,
                        topP: inputs.topP,
                        topK: inputs.topK,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createTunedModel failed' };
                return { output: data };
            }

            case 'getTunedModel': {
                const tunedModelName = inputs.tunedModelName || inputs.model;
                const res = await fetch(buildUrl(`/tunedModels/${tunedModelName}`), {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getTunedModel failed' };
                return { output: data };
            }

            case 'listTunedModels': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.filter) params.set('filter', inputs.filter);
                const query = params.toString();
                const res = await fetch(buildUrl(`/tunedModels${query ? '?' + query : ''}`), {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listTunedModels failed' };
                return { output: data };
            }

            case 'deleteTunedModel': {
                const tunedModelName = inputs.tunedModelName || inputs.model;
                const res = await fetch(buildUrl(`/tunedModels/${tunedModelName}`), {
                    method: 'DELETE',
                    headers: buildHeaders(),
                });
                if (res.status === 204 || res.ok) return { output: { success: true, deleted: tunedModelName } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteTunedModel failed' };
            }

            case 'generateContentFromFile': {
                const model = inputs.model || 'gemini-pro-vision';
                const res = await fetch(buildUrl(`/models/${model}:generateContent`), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        contents: inputs.contents || [{
                            parts: [
                                { text: inputs.prompt || '' },
                                { fileData: { mimeType: inputs.mimeType, fileUri: inputs.fileUri } },
                            ],
                        }],
                        generationConfig: inputs.generationConfig,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateContentFromFile failed' };
                return { output: data };
            }

            case 'createFile': {
                const res = await fetch(buildUrl('/files'), {
                    method: 'POST',
                    headers: buildHeaders(),
                    body: JSON.stringify({
                        file: {
                            displayName: inputs.displayName,
                            mimeType: inputs.mimeType,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createFile failed' };
                return { output: data };
            }

            case 'getFile': {
                const fileName = inputs.fileName || inputs.name;
                const res = await fetch(buildUrl(`/files/${fileName}`), {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getFile failed' };
                return { output: data };
            }

            case 'listFiles': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const query = params.toString();
                const res = await fetch(buildUrl(`/files${query ? '?' + query : ''}`), {
                    method: 'GET',
                    headers: buildHeaders(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listFiles failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown Google Gemini action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Google Gemini action error: ${err.message}`);
        return { error: err.message || 'Google Gemini action failed' };
    }
}
