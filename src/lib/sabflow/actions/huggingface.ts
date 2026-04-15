
'use server';

const HF_BASE = 'https://api-inference.huggingface.co/models';

async function hfFetch(apiKey: string, model: string, body: any, logger?: any) {
    logger?.log(`[HuggingFace] POST /models/${model}`);
    const res = await fetch(`${HF_BASE}/${model}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HuggingFace API error: ${res.status}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        return res.json();
    }
    // binary response (e.g. image)
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

export async function executeHuggingFaceAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const model = String(inputs.model ?? '').trim();
        if (!model) throw new Error('model is required.');

        switch (actionName) {
            case 'textGeneration': {
                const parameters = inputs.parameters ?? {};
                const data = await hfFetch(apiKey, model, { inputs: inputs.inputs ?? inputs.prompt, parameters }, logger);
                return { output: { result: data } };
            }
            case 'textClassification': {
                const data = await hfFetch(apiKey, model, { inputs: inputs.inputs ?? inputs.text }, logger);
                return { output: { result: data } };
            }
            case 'tokenClassification': {
                const data = await hfFetch(apiKey, model, { inputs: inputs.inputs ?? inputs.text }, logger);
                return { output: { result: data } };
            }
            case 'questionAnswering': {
                const question = String(inputs.question ?? '').trim();
                const context = String(inputs.context ?? '').trim();
                if (!question || !context) throw new Error('question and context are required.');
                const data = await hfFetch(apiKey, model, { inputs: { question, context } }, logger);
                return { output: { result: data } };
            }
            case 'summarization': {
                const parameters = inputs.parameters ?? {};
                const data = await hfFetch(apiKey, model, { inputs: inputs.inputs ?? inputs.text, parameters }, logger);
                return { output: { result: data } };
            }
            case 'translation': {
                const data = await hfFetch(apiKey, model, { inputs: inputs.inputs ?? inputs.text }, logger);
                return { output: { result: data } };
            }
            case 'fillMask': {
                const data = await hfFetch(apiKey, model, { inputs: inputs.inputs ?? inputs.text }, logger);
                return { output: { result: data } };
            }
            case 'featureExtraction': {
                const data = await hfFetch(apiKey, model, { inputs: inputs.inputs ?? inputs.text }, logger);
                return { output: { embeddings: data } };
            }
            case 'imageClassification': {
                const imageBase64 = String(inputs.imageBase64 ?? inputs.inputs ?? '').trim();
                if (!imageBase64) throw new Error('imageBase64 is required.');
                const data = await hfFetch(apiKey, model, { inputs: imageBase64 }, logger);
                return { output: { result: data } };
            }
            case 'speechRecognition': {
                const audioUrl = String(inputs.audioUrl ?? inputs.inputs ?? '').trim();
                if (!audioUrl) throw new Error('audioUrl is required.');
                const data = await hfFetch(apiKey, model, { inputs: audioUrl }, logger);
                return { output: { result: data } };
            }
            case 'textToImage': {
                const prompt = String(inputs.prompt ?? inputs.inputs ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const data = await hfFetch(apiKey, model, { inputs: prompt }, logger);
                return { output: { imageBase64: data } };
            }
            case 'zeroShotClassification': {
                const candidateLabels = inputs.candidateLabels;
                if (!Array.isArray(candidateLabels)) throw new Error('candidateLabels must be an array.');
                const data = await hfFetch(apiKey, model, {
                    inputs: inputs.inputs ?? inputs.text,
                    parameters: { candidate_labels: candidateLabels },
                }, logger);
                return { output: { result: data } };
            }
            case 'conversational': {
                const pastUserInputs = inputs.pastUserInputs ?? [];
                const generatedResponses = inputs.generatedResponses ?? [];
                const text = String(inputs.text ?? inputs.inputs ?? '').trim();
                if (!text) throw new Error('text is required.');
                const data = await hfFetch(apiKey, model, {
                    inputs: { past_user_inputs: pastUserInputs, generated_responses: generatedResponses, text },
                }, logger);
                return { output: { result: data } };
            }
            case 'sentenceSimilarity': {
                const sourceSentence = String(inputs.sourceSentence ?? '').trim();
                const sentences = inputs.sentences;
                if (!sourceSentence || !Array.isArray(sentences)) throw new Error('sourceSentence and sentences array are required.');
                const data = await hfFetch(apiKey, model, {
                    inputs: { source_sentence: sourceSentence, sentences },
                }, logger);
                return { output: { scores: data } };
            }
            default:
                throw new Error(`Unknown HuggingFace action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[HuggingFace] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
