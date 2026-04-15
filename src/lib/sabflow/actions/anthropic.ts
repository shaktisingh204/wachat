
'use server';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

async function anthropicPost(apiKey: string, path: string, body: any, logger: any) {
    logger.log(`[Anthropic] POST ${path}`);
    const res = await fetch(`${ANTHROPIC_BASE}${path}`, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `Anthropic API error: ${res.status}`);
    }
    return data;
}

export async function executeAnthropicAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'sendMessage': {
                const model = String(inputs.model ?? 'claude-sonnet-4-6').trim();
                const systemPrompt = String(inputs.systemPrompt ?? '').trim();
                const userMessage = String(inputs.userMessage ?? '').trim();
                const maxTokens = inputs.maxTokens !== undefined ? Number(inputs.maxTokens) : 1024;
                const temperature = inputs.temperature !== undefined ? Number(inputs.temperature) : 1;

                if (!userMessage) throw new Error('userMessage is required.');

                const body: any = {
                    model,
                    max_tokens: maxTokens,
                    temperature,
                    messages: [{ role: 'user', content: userMessage }],
                };

                if (systemPrompt) {
                    body.system = systemPrompt;
                }

                logger.log(`[Anthropic] sendMessage: model=${model}`);
                const data = await anthropicPost(apiKey, '/messages', body, logger);

                const content = data.content?.[0]?.text ?? '';
                const inputTokens = data.usage?.input_tokens ?? 0;
                const outputTokens = data.usage?.output_tokens ?? 0;
                logger.log(`[Anthropic] sendMessage complete. input_tokens=${inputTokens}, output_tokens=${outputTokens}`);

                return {
                    output: {
                        content,
                        model: data.model ?? model,
                        inputTokens: String(inputTokens),
                        outputTokens: String(outputTokens),
                    },
                };
            }

            case 'analyzeImage': {
                const model = String(inputs.model ?? 'claude-sonnet-4-6').trim();
                const imageUrl = String(inputs.imageUrl ?? '').trim();
                const prompt = String(inputs.prompt ?? 'Describe this image.').trim();

                if (!imageUrl) throw new Error('imageUrl is required.');

                logger.log(`[Anthropic] analyzeImage: model=${model}`);
                const body: any = {
                    model,
                    max_tokens: 1024,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image',
                                    source: {
                                        type: 'url',
                                        url: imageUrl,
                                    },
                                },
                                {
                                    type: 'text',
                                    text: prompt,
                                },
                            ],
                        },
                    ],
                };

                const data = await anthropicPost(apiKey, '/messages', body, logger);
                const content = data.content?.[0]?.text ?? '';
                logger.log(`[Anthropic] analyzeImage complete.`);

                return {
                    output: {
                        content,
                    },
                };
            }

            case 'streamMessage': {
                // Coming soon — streaming requires server-sent events support
                logger.log(`[Anthropic] streamMessage: not yet supported in workflow actions.`);
                return {
                    output: {
                        content: '[Stream not yet supported. Use sendMessage instead.]',
                    },
                };
            }

            default:
                return { error: `Anthropic action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Anthropic action failed.' };
    }
}
