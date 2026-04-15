'use server';

export async function executeAnthropicEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const baseUrl = 'https://api.anthropic.com/v1';
        const headers: Record<string, string> = {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        };

        switch (actionName) {
            case 'createMessage': {
                const body: any = {
                    model: inputs.model || 'claude-3-5-sonnet-20241022',
                    max_tokens: inputs.maxTokens || 1024,
                    messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                };
                if (inputs.system) body.system = inputs.system;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createMessage failed' };
                return { output: data };
            }

            case 'createMessageWithTools': {
                const body: any = {
                    model: inputs.model || 'claude-3-5-sonnet-20241022',
                    max_tokens: inputs.maxTokens || 1024,
                    messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                    tools: inputs.tools || [],
                };
                if (inputs.toolChoice) body.tool_choice = inputs.toolChoice;
                if (inputs.system) body.system = inputs.system;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createMessageWithTools failed' };
                return { output: data };
            }

            case 'streamMessage': {
                const body: any = {
                    model: inputs.model || 'claude-3-5-sonnet-20241022',
                    max_tokens: inputs.maxTokens || 1024,
                    messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                    stream: true,
                };
                if (inputs.system) body.system = inputs.system;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'streamMessage failed' };
                }
                const text = await res.text();
                return { output: { streamData: text, status: res.status } };
            }

            case 'listModels': {
                const res = await fetch(`${baseUrl}/models`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listModels failed' };
                return { output: data };
            }

            case 'countTokens': {
                const body: any = {
                    model: inputs.model || 'claude-3-5-sonnet-20241022',
                    messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                };
                if (inputs.system) body.system = inputs.system;
                const res = await fetch(`${baseUrl}/messages/count_tokens`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'countTokens failed' };
                return { output: data };
            }

            case 'createEmbedding': {
                // Anthropic does not have a native embedding endpoint; proxy through messages for semantic representation
                const body: any = {
                    model: inputs.model || 'claude-3-haiku-20240307',
                    max_tokens: 256,
                    messages: [{ role: 'user', content: `Summarize semantically: ${inputs.input || inputs.text || ''}` }],
                };
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createEmbedding failed' };
                return { output: { model: body.model, text: inputs.input || inputs.text, response: data } };
            }

            case 'generateWithClaude3Opus': {
                const body: any = {
                    model: 'claude-3-opus-20240229',
                    max_tokens: inputs.maxTokens || 2048,
                    messages: [{ role: 'user', content: inputs.prompt || '' }],
                };
                if (inputs.system) body.system = inputs.system;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateWithClaude3Opus failed' };
                return { output: data };
            }

            case 'generateWithClaude3Sonnet': {
                const body: any = {
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: inputs.maxTokens || 2048,
                    messages: [{ role: 'user', content: inputs.prompt || '' }],
                };
                if (inputs.system) body.system = inputs.system;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateWithClaude3Sonnet failed' };
                return { output: data };
            }

            case 'generateWithClaude3Haiku': {
                const body: any = {
                    model: 'claude-3-haiku-20240307',
                    max_tokens: inputs.maxTokens || 1024,
                    messages: [{ role: 'user', content: inputs.prompt || '' }],
                };
                if (inputs.system) body.system = inputs.system;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateWithClaude3Haiku failed' };
                return { output: data };
            }

            case 'generateWithClaudeSonnet45': {
                const body: any = {
                    model: 'claude-sonnet-4-5',
                    max_tokens: inputs.maxTokens || 2048,
                    messages: [{ role: 'user', content: inputs.prompt || '' }],
                };
                if (inputs.system) body.system = inputs.system;
                if (inputs.temperature !== undefined) body.temperature = inputs.temperature;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'generateWithClaudeSonnet45 failed' };
                return { output: data };
            }

            case 'vision': {
                const imageUrl = inputs.imageUrl;
                const imageBase64 = inputs.imageBase64;
                const mediaType = inputs.mediaType || 'image/jpeg';
                const imageContent = imageUrl
                    ? { type: 'image', source: { type: 'url', url: imageUrl } }
                    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } };
                const body: any = {
                    model: inputs.model || 'claude-3-5-sonnet-20241022',
                    max_tokens: inputs.maxTokens || 1024,
                    messages: [{ role: 'user', content: [imageContent, { type: 'text', text: inputs.prompt || 'Describe this image.' }] }],
                };
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'vision failed' };
                return { output: data };
            }

            case 'extractJSON': {
                const prompt = `Extract structured JSON from the following text. Return only valid JSON, no markdown.\n\nText:\n${inputs.text || ''}`;
                const body: any = {
                    model: inputs.model || 'claude-3-5-sonnet-20241022',
                    max_tokens: inputs.maxTokens || 2048,
                    messages: [{ role: 'user', content: prompt }],
                    system: 'You are a JSON extraction assistant. Always respond with valid JSON only.',
                };
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'extractJSON failed' };
                const rawText = data.content?.[0]?.text || '';
                let parsed: any = rawText;
                try { parsed = JSON.parse(rawText); } catch {}
                return { output: { raw: rawText, parsed, messageData: data } };
            }

            case 'summarize': {
                const prompt = `Summarize the following text concisely:\n\n${inputs.text || ''}`;
                const body: any = {
                    model: inputs.model || 'claude-3-haiku-20240307',
                    max_tokens: inputs.maxTokens || 512,
                    messages: [{ role: 'user', content: prompt }],
                };
                if (inputs.system) body.system = inputs.system;
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'summarize failed' };
                return { output: { summary: data.content?.[0]?.text || '', messageData: data } };
            }

            case 'translate': {
                const targetLang = inputs.targetLanguage || 'English';
                const prompt = `Translate the following text to ${targetLang}. Return only the translation.\n\n${inputs.text || ''}`;
                const body: any = {
                    model: inputs.model || 'claude-3-haiku-20240307',
                    max_tokens: inputs.maxTokens || 1024,
                    messages: [{ role: 'user', content: prompt }],
                };
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'translate failed' };
                return { output: { translation: data.content?.[0]?.text || '', targetLanguage: targetLang, messageData: data } };
            }

            case 'classifyText': {
                const categories = inputs.categories || [];
                const prompt = `Classify the following text into one of these categories: ${categories.join(', ')}.\nReturn only the category name.\n\nText:\n${inputs.text || ''}`;
                const body: any = {
                    model: inputs.model || 'claude-3-haiku-20240307',
                    max_tokens: 64,
                    messages: [{ role: 'user', content: prompt }],
                };
                const res = await fetch(`${baseUrl}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'classifyText failed' };
                return { output: { category: (data.content?.[0]?.text || '').trim(), categories, messageData: data } };
            }

            default:
                return { error: `Unknown Anthropic Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeAnthropicEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeAnthropicEnhancedAction' };
    }
}
