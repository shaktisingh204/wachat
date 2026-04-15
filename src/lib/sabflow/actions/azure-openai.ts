'use server';

export async function executeAzureOpenaiAction(actionName: string, inputs: any, user: any, logger: any) {
    const resourceName = inputs.resourceName;
    const deploymentId = inputs.deploymentId;
    const apiKey = inputs.apiKey;
    const apiVersion = inputs.apiVersion || '2024-02-01';

    const deploymentBase = `https://${resourceName}.openai.azure.com/openai/deployments/${deploymentId}`;
    const resourceBase = `https://${resourceName}.openai.azure.com/openai`;

    function headers(extra: Record<string, string> = {}): Record<string, string> {
        return {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            ...extra,
        };
    }

    try {
        switch (actionName) {
            case 'createChatCompletion': {
                const url = `${deploymentBase}/chat/completions?api-version=${apiVersion}`;
                const body = {
                    messages: inputs.messages || [],
                    temperature: inputs.temperature ?? 0.7,
                    max_tokens: inputs.maxTokens || 1000,
                    ...(inputs.additionalParams || {}),
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, completion: data } };
            }

            case 'streamChatCompletion': {
                const url = `${deploymentBase}/chat/completions?api-version=${apiVersion}`;
                const body = {
                    messages: inputs.messages || [],
                    temperature: inputs.temperature ?? 0.7,
                    max_tokens: inputs.maxTokens || 1000,
                    stream: true,
                    ...(inputs.additionalParams || {}),
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                return { output: { status: res.status, stream: text } };
            }

            case 'createCompletion': {
                const url = `${deploymentBase}/completions?api-version=${apiVersion}`;
                const body = {
                    prompt: inputs.prompt || '',
                    max_tokens: inputs.maxTokens || 500,
                    temperature: inputs.temperature ?? 0.7,
                    ...(inputs.additionalParams || {}),
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, completion: data } };
            }

            case 'createEmbedding': {
                const url = `${deploymentBase}/embeddings?api-version=${apiVersion}`;
                const body = {
                    input: inputs.input || '',
                    ...(inputs.additionalParams || {}),
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, embeddings: data } };
            }

            case 'createImage': {
                const url = `${deploymentBase}/images/generations?api-version=${apiVersion}`;
                const body = {
                    prompt: inputs.prompt || '',
                    n: inputs.n || 1,
                    size: inputs.size || '1024x1024',
                    ...(inputs.additionalParams || {}),
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, images: data } };
            }

            case 'createImageVariation': {
                const url = `${deploymentBase}/images/variations?api-version=${apiVersion}`;
                const imageData = inputs.imageBase64 || '';
                const imageBuffer = Buffer.from(imageData, 'base64');
                const formData = new FormData();
                formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');
                if (inputs.n) formData.append('n', String(inputs.n));
                if (inputs.size) formData.append('size', inputs.size);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'api-key': apiKey },
                    body: formData,
                });
                const data = await res.json();
                return { output: { status: res.status, variations: data } };
            }

            case 'editImage': {
                const url = `${deploymentBase}/images/edits?api-version=${apiVersion}`;
                const imageBuffer = Buffer.from(inputs.imageBase64 || '', 'base64');
                const formData = new FormData();
                formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');
                formData.append('prompt', inputs.prompt || '');
                if (inputs.maskBase64) {
                    const maskBuffer = Buffer.from(inputs.maskBase64, 'base64');
                    formData.append('mask', new Blob([maskBuffer], { type: 'image/png' }), 'mask.png');
                }
                if (inputs.n) formData.append('n', String(inputs.n));
                if (inputs.size) formData.append('size', inputs.size);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'api-key': apiKey },
                    body: formData,
                });
                const data = await res.json();
                return { output: { status: res.status, edits: data } };
            }

            case 'createTranscription': {
                const url = `${deploymentBase}/audio/transcriptions?api-version=${apiVersion}`;
                const audioBuffer = Buffer.from(inputs.audioBase64 || '', 'base64');
                const formData = new FormData();
                formData.append('file', new Blob([audioBuffer], { type: inputs.mimeType || 'audio/wav' }), inputs.fileName || 'audio.wav');
                if (inputs.language) formData.append('language', inputs.language);
                if (inputs.prompt) formData.append('prompt', inputs.prompt);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'api-key': apiKey },
                    body: formData,
                });
                const data = await res.json();
                return { output: { status: res.status, transcription: data } };
            }

            case 'createTranslation': {
                const url = `${deploymentBase}/audio/translations?api-version=${apiVersion}`;
                const audioBuffer = Buffer.from(inputs.audioBase64 || '', 'base64');
                const formData = new FormData();
                formData.append('file', new Blob([audioBuffer], { type: inputs.mimeType || 'audio/wav' }), inputs.fileName || 'audio.wav');
                if (inputs.prompt) formData.append('prompt', inputs.prompt);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'api-key': apiKey },
                    body: formData,
                });
                const data = await res.json();
                return { output: { status: res.status, translation: data } };
            }

            case 'listDeployments': {
                const url = `${resourceBase}/deployments?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: headers() });
                const data = await res.json();
                return { output: { status: res.status, deployments: data } };
            }

            case 'getDeployment': {
                const url = `${deploymentBase}?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: headers() });
                const data = await res.json();
                return { output: { status: res.status, deployment: data } };
            }

            case 'createFineTuningJob': {
                const url = `${resourceBase}/fine_tuning/jobs?api-version=${apiVersion}`;
                const body = {
                    training_file: inputs.trainingFile,
                    model: inputs.model || deploymentId,
                    ...(inputs.hyperparameters ? { hyperparameters: inputs.hyperparameters } : {}),
                    ...(inputs.suffix ? { suffix: inputs.suffix } : {}),
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, job: data } };
            }

            case 'getFineTuningJob': {
                const jobId = inputs.jobId;
                const url = `${resourceBase}/fine_tuning/jobs/${jobId}?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: headers() });
                const data = await res.json();
                return { output: { status: res.status, job: data } };
            }

            case 'listModels': {
                const url = `${resourceBase}/models?api-version=${apiVersion}`;
                const res = await fetch(url, { headers: headers() });
                const data = await res.json();
                return { output: { status: res.status, models: data } };
            }

            case 'moderateContent': {
                const url = `${deploymentBase}/chat/completions?api-version=${apiVersion}`;
                const body = {
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a content moderation assistant. Analyze the following content and return a JSON object with fields: flagged (boolean), categories (object with hate, violence, sexual, selfHarm booleans), and reason (string).',
                        },
                        { role: 'user', content: inputs.content || '' },
                    ],
                    max_tokens: 300,
                    temperature: 0,
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: headers(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                const raw = data?.choices?.[0]?.message?.content || '{}';
                let parsed: any = {};
                try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
                return { output: { status: res.status, moderation: parsed } };
            }

            default:
                return { error: `Unknown Azure OpenAI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Azure OpenAI action error: ${err.message}`);
        return { error: err.message || 'Azure OpenAI action failed' };
    }
}
