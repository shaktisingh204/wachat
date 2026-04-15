
'use server';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function geminiPost(apiKey: string, model: string, path: string, body: any, logger: any) {
    const url = `${GEMINI_BASE}/models/${model}:${path}?key=${apiKey}`;
    logger.log(`[Gemini] POST models/${model}:${path}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `Gemini API error: ${res.status}`);
    }
    return data;
}

function extractGeminiText(data: any): string {
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function executeGeminiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'generateContent': {
                const model = String(inputs.model ?? 'gemini-2.0-flash').trim();
                const prompt = String(inputs.prompt ?? '').trim();
                const systemInstruction = String(inputs.systemInstruction ?? '').trim();
                const temperature = inputs.temperature !== undefined ? Number(inputs.temperature) : 1;

                if (!prompt) throw new Error('prompt is required.');

                const body: any = {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature },
                };

                if (systemInstruction) {
                    body.systemInstruction = { parts: [{ text: systemInstruction }] };
                }

                logger.log(`[Gemini] generateContent: model=${model}`);
                const data = await geminiPost(apiKey, model, 'generateContent', body, logger);
                const text = extractGeminiText(data);
                logger.log(`[Gemini] generateContent complete.`);

                return {
                    output: {
                        text,
                        model,
                    },
                };
            }

            case 'analyzeImage': {
                const model = 'gemini-2.0-flash';
                const imageUrl = String(inputs.imageUrl ?? '').trim();
                const prompt = String(inputs.prompt ?? 'Describe this image.').trim();

                if (!imageUrl) throw new Error('imageUrl is required.');

                logger.log(`[Gemini] analyzeImage: fetching image`);
                const imgRes = await fetch(imageUrl);
                if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
                const imgBuffer = await imgRes.arrayBuffer();
                const base64Image = Buffer.from(imgBuffer).toString('base64');
                const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

                const body = {
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { inline_data: { mime_type: mimeType, data: base64Image } },
                                { text: prompt },
                            ],
                        },
                    ],
                };

                const data = await geminiPost(apiKey, model, 'generateContent', body, logger);
                const text = extractGeminiText(data);
                logger.log(`[Gemini] analyzeImage complete.`);

                return {
                    output: {
                        text,
                    },
                };
            }

            case 'generateCode': {
                const model = String(inputs.model ?? 'gemini-2.0-flash').trim();
                const language = String(inputs.language ?? 'javascript').trim();
                const task = String(inputs.task ?? '').trim();

                if (!task) throw new Error('task is required.');

                const codePrompt = `You are an expert ${language} developer. Write clean, production-ready ${language} code for the following task. Respond with a JSON object containing exactly two fields: "code" (the complete code as a string) and "explanation" (a brief explanation of what the code does).\n\nTask: ${task}`;

                const body: any = {
                    contents: [{ role: 'user', parts: [{ text: codePrompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        response_mime_type: 'application/json',
                    },
                };

                logger.log(`[Gemini] generateCode: model=${model}, language=${language}`);
                const data = await geminiPost(apiKey, model, 'generateContent', body, logger);
                const rawText = extractGeminiText(data);

                let code = '';
                let explanation = '';
                try {
                    const parsed = JSON.parse(rawText);
                    code = parsed.code ?? rawText;
                    explanation = parsed.explanation ?? '';
                } catch {
                    code = rawText;
                    explanation = '';
                }

                logger.log(`[Gemini] generateCode complete.`);

                return {
                    output: {
                        code,
                        explanation,
                    },
                };
            }

            default:
                return { error: `Gemini action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Gemini action failed.' };
    }
}
