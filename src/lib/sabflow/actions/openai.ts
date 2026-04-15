
'use server';

const OPENAI_BASE = 'https://api.openai.com/v1';

async function openaiPost(apiKey: string, path: string, body: any, logger: any) {
    logger.log(`[OpenAI] POST ${path}`);
    const res = await fetch(`${OPENAI_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `OpenAI API error: ${res.status}`);
    }
    return data;
}

export async function executeOpenAiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'chatCompletion': {
                const model = String(inputs.model ?? 'gpt-4o-mini').trim();
                const systemPrompt = String(inputs.systemPrompt ?? '').trim();
                const userPrompt = String(inputs.userPrompt ?? '').trim();
                const temperature = inputs.temperature !== undefined ? Number(inputs.temperature) : 0.7;
                const maxTokens = inputs.maxTokens !== undefined ? Number(inputs.maxTokens) : 1024;
                const responseFormat = String(inputs.responseFormat ?? 'text').trim();

                if (!userPrompt) throw new Error('userPrompt is required.');

                const messages: any[] = [];
                if (systemPrompt) {
                    messages.push({ role: 'system', content: systemPrompt });
                }
                messages.push({ role: 'user', content: userPrompt });

                const body: any = {
                    model,
                    messages,
                    temperature,
                    max_tokens: maxTokens,
                };

                if (responseFormat === 'json') {
                    body.response_format = { type: 'json_object' };
                }

                logger.log(`[OpenAI] chatCompletion: model=${model}`);
                const data = await openaiPost(apiKey, '/chat/completions', body, logger);
                const content = data.choices?.[0]?.message?.content ?? '';
                const tokens = data.usage?.total_tokens ?? 0;
                logger.log(`[OpenAI] chatCompletion complete. tokens=${tokens}`);

                return {
                    output: {
                        content,
                        model: data.model ?? model,
                        tokens: String(tokens),
                    },
                };
            }

            case 'generateImage': {
                const prompt = String(inputs.prompt ?? '').trim();
                const size = String(inputs.size ?? '1024x1024').trim();
                const quality = String(inputs.quality ?? 'standard').trim();
                const style = String(inputs.style ?? 'vivid').trim();

                if (!prompt) throw new Error('prompt is required.');

                logger.log(`[OpenAI] generateImage: size=${size}, quality=${quality}`);
                const data = await openaiPost(apiKey, '/images/generations', {
                    model: 'dall-e-3',
                    prompt,
                    n: 1,
                    size,
                    quality,
                    style,
                }, logger);

                const imageUrl = data.data?.[0]?.url ?? '';
                const revisedPrompt = data.data?.[0]?.revised_prompt ?? prompt;
                logger.log(`[OpenAI] generateImage complete.`);

                return {
                    output: {
                        imageUrl,
                        revisedPrompt,
                    },
                };
            }

            case 'transcribeAudio': {
                const audioUrl = String(inputs.audioUrl ?? '').trim();
                if (!audioUrl) throw new Error('audioUrl is required.');

                logger.log(`[OpenAI] transcribeAudio: fetching audio from URL`);
                const audioRes = await fetch(audioUrl);
                if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
                const audioBlob = await audioRes.blob();

                const formData = new FormData();
                formData.append('file', audioBlob, 'audio.mp3');
                formData.append('model', 'whisper-1');
                formData.append('response_format', 'verbose_json');

                const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}` },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `OpenAI Whisper error: ${res.status}`);

                logger.log(`[OpenAI] transcribeAudio complete.`);
                return {
                    output: {
                        text: data.text ?? '',
                        language: data.language ?? '',
                    },
                };
            }

            case 'moderateContent': {
                const content = String(inputs.content ?? '').trim();
                if (!content) throw new Error('content is required.');

                logger.log(`[OpenAI] moderateContent`);
                const data = await openaiPost(apiKey, '/moderations', { input: content }, logger);
                const result = data.results?.[0] ?? {};
                logger.log(`[OpenAI] moderateContent complete. flagged=${result.flagged}`);

                return {
                    output: {
                        flagged: String(Boolean(result.flagged)),
                        categories: result.categories ?? {},
                    },
                };
            }

            case 'generateEmbedding': {
                const text = String(inputs.text ?? '').trim();
                const model = String(inputs.model ?? 'text-embedding-3-small').trim();
                if (!text) throw new Error('text is required.');

                logger.log(`[OpenAI] generateEmbedding: model=${model}`);
                const data = await openaiPost(apiKey, '/embeddings', { model, input: text }, logger);
                const embedding = data.data?.[0]?.embedding ?? [];
                logger.log(`[OpenAI] generateEmbedding complete. dimensions=${embedding.length}`);

                return {
                    output: {
                        embedding,
                    },
                };
            }

            default:
                return { error: `OpenAI action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'OpenAI action failed.' };
    }
}
