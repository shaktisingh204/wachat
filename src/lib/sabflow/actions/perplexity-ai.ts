'use server';

export async function executePerplexityAiAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.perplexity.ai';

    function buildHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${inputs.apiKey || ''}`,
        };
    }

    async function chatCompletion(body: any) {
        const res = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error?.message || data.message || 'Perplexity API request failed' };
        return { output: data };
    }

    try {
        switch (actionName) {
            case 'createChatCompletion': {
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                    max_tokens: inputs.maxTokens,
                    temperature: inputs.temperature,
                    top_p: inputs.topP,
                    top_k: inputs.topK,
                    stream: false,
                    presence_penalty: inputs.presencePenalty,
                    frequency_penalty: inputs.frequencyPenalty,
                    search_domain_filter: inputs.searchDomainFilter,
                    return_images: inputs.returnImages,
                    return_related_questions: inputs.returnRelatedQuestions,
                    search_recency_filter: inputs.searchRecencyFilter,
                });
            }

            case 'streamChatCompletion': {
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: inputs.messages || [{ role: 'user', content: inputs.prompt || '' }],
                    max_tokens: inputs.maxTokens,
                    temperature: inputs.temperature,
                    stream: true,
                    search_domain_filter: inputs.searchDomainFilter,
                    search_recency_filter: inputs.searchRecencyFilter,
                });
            }

            case 'listModels': {
                // Perplexity does not expose a list models endpoint; return known models
                return {
                    output: {
                        models: [
                            { id: 'sonar', description: 'Perplexity Sonar - search-enhanced model' },
                            { id: 'sonar-pro', description: 'Perplexity Sonar Pro - advanced search model' },
                            { id: 'sonar-reasoning', description: 'Perplexity Sonar Reasoning' },
                            { id: 'sonar-reasoning-pro', description: 'Perplexity Sonar Reasoning Pro' },
                            { id: 'sonar-deep-research', description: 'Perplexity Sonar Deep Research' },
                            { id: 'r1-1776', description: 'DeepSeek R1 (offline, no web search)' },
                        ],
                    },
                };
            }

            case 'searchWeb': {
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: inputs.query || inputs.prompt || '' }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.2,
                    search_domain_filter: inputs.searchDomainFilter,
                    search_recency_filter: inputs.searchRecencyFilter,
                    return_related_questions: inputs.returnRelatedQuestions,
                });
            }

            case 'searchWithCitations': {
                const result = await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: inputs.query || inputs.prompt || '' }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.2,
                    return_related_questions: true,
                    search_domain_filter: inputs.searchDomainFilter,
                    search_recency_filter: inputs.searchRecencyFilter,
                });
                if ('error' in result) return result;
                const raw = result.output;
                return {
                    output: {
                        answer: raw.choices?.[0]?.message?.content || '',
                        citations: raw.citations || [],
                        related_questions: raw.related_questions || [],
                        usage: raw.usage,
                    },
                };
            }

            case 'askQuestion': {
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: inputs.question || inputs.prompt || '' }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.2,
                    return_related_questions: inputs.returnRelatedQuestions || false,
                    search_recency_filter: inputs.searchRecencyFilter,
                });
            }

            case 'summarizeUrl': {
                const url = inputs.url || '';
                const prompt = `Please summarize the content at the following URL: ${url}${inputs.additionalInstructions ? '\n\n' + inputs.additionalInstructions : ''}`;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.2,
                });
            }

            case 'translateText': {
                const targetLang = inputs.targetLanguage || 'English';
                const prompt = `Translate the following text to ${targetLang}. Provide only the translation without any explanation:\n\n${inputs.text || ''}`;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 2048,
                    temperature: inputs.temperature || 0.1,
                });
            }

            case 'analyzeText': {
                const prompt = `Analyze the following text and provide insights:\n\n${inputs.text || ''}${inputs.analysisType ? '\n\nFocus on: ' + inputs.analysisType : ''}`;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.3,
                });
            }

            case 'extractKeyPoints': {
                const prompt = `Extract the key points from the following text. Return them as a concise bulleted list:\n\n${inputs.text || ''}`;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.2,
                });
            }

            case 'generateCode': {
                const language = inputs.language || 'TypeScript';
                const prompt = `Generate ${language} code for the following requirement:\n\n${inputs.requirement || inputs.prompt || ''}${inputs.context ? '\n\nContext:\n' + inputs.context : ''}`;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 2048,
                    temperature: inputs.temperature || 0.2,
                });
            }

            case 'reviewCode': {
                const prompt = `Review the following code and provide feedback on correctness, performance, security, and best practices:\n\n\`\`\`${inputs.language || ''}\n${inputs.code || ''}\n\`\`\``;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 2048,
                    temperature: inputs.temperature || 0.3,
                });
            }

            case 'explainCode': {
                const prompt = `Explain the following code in clear, simple terms:\n\n\`\`\`${inputs.language || ''}\n${inputs.code || ''}\n\`\`\``;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.2,
                });
            }

            case 'writeEmail': {
                const prompt = `Write a professional email with the following details:\nSubject: ${inputs.subject || ''}\nRecipient: ${inputs.recipient || ''}\nPurpose: ${inputs.purpose || inputs.prompt || ''}\nTone: ${inputs.tone || 'professional'}${inputs.additionalContext ? '\nAdditional context: ' + inputs.additionalContext : ''}`;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 1024,
                    temperature: inputs.temperature || 0.5,
                });
            }

            case 'improveWriting': {
                const prompt = `Improve the following text for clarity, grammar, and style${inputs.style ? ' in a ' + inputs.style + ' style' : ''}. Return only the improved text:\n\n${inputs.text || ''}`;
                return await chatCompletion({
                    model: inputs.model || 'sonar',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: inputs.maxTokens || 2048,
                    temperature: inputs.temperature || 0.4,
                });
            }

            default:
                return { error: `Unknown Perplexity AI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Perplexity AI action error: ${err.message}`);
        return { error: err.message || 'Perplexity AI action failed' };
    }
}
