
'use server';

const PERPLEXITY_BASE = 'https://api.perplexity.ai';

const PERPLEXITY_MODELS = [
    'llama-3.1-sonar-small-128k-chat',
    'llama-3.1-sonar-large-128k-chat',
    'llama-3.1-sonar-small-128k-online',
    'llama-3.1-sonar-large-128k-online',
    'llama-3.1-8b-instruct',
    'llama-3.1-70b-instruct',
];

async function perplexityPost(
    apiKey: string,
    body: any,
    logger: any,
) {
    logger.log(`[Perplexity] POST /chat/completions model=${body.model}`);
    const res = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `Perplexity API error: ${res.status}`);
    return data;
}

export async function executePerplexityAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        // listModels does not need an API key
        if (actionName === 'listModels') {
            return { output: { models: PERPLEXITY_MODELS } };
        }

        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'chatComplete': {
                const model = String(inputs.model ?? 'llama-3.1-sonar-large-128k-chat').trim();
                const messages = inputs.messages;
                if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages must be a non-empty array.');
                const body: any = { model, messages };
                if (inputs.maxTokens !== undefined) body.max_tokens = Number(inputs.maxTokens);
                if (inputs.temperature !== undefined) body.temperature = Number(inputs.temperature);
                if (inputs.searchDomainFilter !== undefined) body.search_domain_filter = inputs.searchDomainFilter;
                if (inputs.returnImages !== undefined) body.return_images = inputs.returnImages === true || inputs.returnImages === 'true';
                if (inputs.returnRelatedQuestions !== undefined) body.return_related_questions = inputs.returnRelatedQuestions === true || inputs.returnRelatedQuestions === 'true';
                const data = await perplexityPost(apiKey, body, logger);
                return {
                    output: {
                        id: data.id ?? '',
                        choices: data.choices ?? [],
                        usage: data.usage ?? {},
                        citations: data.citations ?? [],
                    },
                };
            }

            case 'search': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const model = String(inputs.model ?? 'llama-3.1-sonar-large-128k-online').trim();
                const body: any = {
                    model,
                    messages: [{ role: 'user', content: query }],
                };
                if (inputs.searchRecency) body.search_recency_filter = inputs.searchRecency;
                const data = await perplexityPost(apiKey, body, logger);
                return {
                    output: {
                        answer: data.choices?.[0]?.message?.content ?? '',
                        citations: data.citations ?? [],
                    },
                };
            }

            case 'askWithContext': {
                const question = String(inputs.question ?? '').trim();
                const context = String(inputs.context ?? '').trim();
                if (!question) throw new Error('question is required.');
                if (!context) throw new Error('context is required.');
                const model = String(inputs.model ?? 'llama-3.1-sonar-large-128k-chat').trim();
                const data = await perplexityPost(apiKey, {
                    model,
                    messages: [
                        { role: 'system', content: context },
                        { role: 'user', content: question },
                    ],
                }, logger);
                return {
                    output: {
                        answer: data.choices?.[0]?.message?.content ?? '',
                        citations: data.citations ?? [],
                    },
                };
            }

            case 'researchTopic': {
                const topic = String(inputs.topic ?? '').trim();
                if (!topic) throw new Error('topic is required.');
                const depth = String(inputs.depth ?? 'detailed').trim();
                const systemPrompt = depth === 'brief'
                    ? 'You are a research assistant. Provide a concise but informative summary.'
                    : 'You are a thorough research assistant. Provide a comprehensive, well-structured summary with key facts, context, and insights.';
                const data = await perplexityPost(apiKey, {
                    model: 'llama-3.1-sonar-large-128k-online',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Research the following topic and provide a ${depth} summary: ${topic}` },
                    ],
                }, logger);
                return {
                    output: {
                        summary: data.choices?.[0]?.message?.content ?? '',
                        citations: data.citations ?? [],
                    },
                };
            }

            case 'factCheck': {
                const claim = String(inputs.claim ?? '').trim();
                if (!claim) throw new Error('claim is required.');
                const systemPrompt = 'You are a fact-checking assistant. Evaluate the claim and respond with a JSON object containing: "verdict" (TRUE, FALSE, MISLEADING, or UNVERIFIABLE), and "explanation" (a brief explanation of your assessment). Only respond with valid JSON.';
                const data = await perplexityPost(apiKey, {
                    model: 'llama-3.1-sonar-large-128k-online',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Fact-check this claim: "${claim}"` },
                    ],
                }, logger);
                const rawContent: string = data.choices?.[0]?.message?.content ?? '{}';
                let verdict = '';
                let explanation = '';
                try {
                    // Strip possible markdown code fences
                    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
                    const parsed = JSON.parse(cleaned);
                    verdict = parsed.verdict ?? '';
                    explanation = parsed.explanation ?? rawContent;
                } catch {
                    verdict = 'UNVERIFIABLE';
                    explanation = rawContent;
                }
                return {
                    output: {
                        verdict,
                        explanation,
                        citations: data.citations ?? [],
                    },
                };
            }

            default:
                return { error: `Perplexity action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Perplexity action failed.' };
    }
}
