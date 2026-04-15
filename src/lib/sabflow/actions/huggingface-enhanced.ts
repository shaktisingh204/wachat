'use server';

const HF_BASE = 'https://api-inference.huggingface.co';

async function hfFetch(
    apiKey: string,
    method: string,
    path: string,
    logger: any,
    body?: any,
    isFormData?: boolean,
): Promise<any> {
    logger.log(`[HuggingFaceEnhanced] ${method} ${path}`);
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
    };
    if (!isFormData && body !== undefined) headers['Content-Type'] = 'application/json';
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = isFormData ? body : JSON.stringify(body);
    const res = await fetch(`${HF_BASE}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error || data?.message || `HuggingFace API error: ${res.status}`);
    return data;
}

export async function executeHuggingFaceEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const api = (method: string, path: string, body?: any, isFormData?: boolean) =>
            hfFetch(apiKey, method, path, logger, body, isFormData);

        switch (actionName) {
            case 'runInference': {
                const model = String(inputs.model ?? '').trim();
                if (!model) throw new Error('model is required.');
                const payload = inputs.payload ?? inputs.inputs ?? inputs.data ?? {};
                const body: any = { inputs: payload };
                if (inputs.parameters) body.parameters = inputs.parameters;
                if (inputs.options) body.options = inputs.options;
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, body);
                return { output: { result: data } };
            }

            case 'textGeneration': {
                const model = String(inputs.model ?? 'gpt2').trim();
                const inputText = String(inputs.text ?? inputs.inputs ?? '').trim();
                if (!inputText) throw new Error('text is required.');
                const body: any = { inputs: inputText };
                const parameters: any = {};
                if (inputs.maxNewTokens !== undefined) parameters.max_new_tokens = Number(inputs.maxNewTokens);
                if (inputs.temperature !== undefined) parameters.temperature = Number(inputs.temperature);
                if (inputs.topP !== undefined) parameters.top_p = Number(inputs.topP);
                if (inputs.topK !== undefined) parameters.top_k = Number(inputs.topK);
                if (inputs.repetitionPenalty !== undefined) parameters.repetition_penalty = Number(inputs.repetitionPenalty);
                if (inputs.returnFullText !== undefined) parameters.return_full_text = Boolean(inputs.returnFullText);
                if (inputs.numReturnSequences !== undefined) parameters.num_return_sequences = Number(inputs.numReturnSequences);
                if (Object.keys(parameters).length) body.parameters = parameters;
                logger.log(`[HFEnhanced] textGeneration: model=${model}`);
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, body);
                const generated = Array.isArray(data) ? data[0]?.generated_text ?? '' : data?.generated_text ?? '';
                return { output: { generatedText: generated, raw: data } };
            }

            case 'textClassification': {
                const model = String(inputs.model ?? 'distilbert-base-uncased-finetuned-sst-2-english').trim();
                const inputText = String(inputs.text ?? inputs.inputs ?? '').trim();
                if (!inputText) throw new Error('text is required.');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, { inputs: inputText });
                const result = Array.isArray(data) ? data[0] : data;
                return { output: { classifications: result, label: result?.[0]?.label ?? '', score: result?.[0]?.score ?? 0 } };
            }

            case 'tokenClassification': {
                const model = String(inputs.model ?? 'dbmdz/bert-large-cased-finetuned-conll03-english').trim();
                const inputText = String(inputs.text ?? inputs.inputs ?? '').trim();
                if (!inputText) throw new Error('text is required.');
                const body: any = { inputs: inputText };
                if (inputs.aggregationStrategy) body.parameters = { aggregation_strategy: String(inputs.aggregationStrategy) };
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, body);
                return { output: { entities: data ?? [], raw: data } };
            }

            case 'questionAnswering': {
                const model = String(inputs.model ?? 'deepset/roberta-base-squad2').trim();
                const question = String(inputs.question ?? '').trim();
                const context = String(inputs.context ?? '').trim();
                if (!question) throw new Error('question is required.');
                if (!context) throw new Error('context is required.');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, { inputs: { question, context } });
                return { output: { answer: data.answer ?? '', score: data.score ?? 0, start: data.start, end: data.end } };
            }

            case 'summarization': {
                const model = String(inputs.model ?? 'facebook/bart-large-cnn').trim();
                const inputText = String(inputs.text ?? inputs.inputs ?? '').trim();
                if (!inputText) throw new Error('text is required.');
                const body: any = { inputs: inputText };
                const parameters: any = {};
                if (inputs.maxLength !== undefined) parameters.max_length = Number(inputs.maxLength);
                if (inputs.minLength !== undefined) parameters.min_length = Number(inputs.minLength);
                if (inputs.doSample !== undefined) parameters.do_sample = Boolean(inputs.doSample);
                if (Object.keys(parameters).length) body.parameters = parameters;
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, body);
                const summary = Array.isArray(data) ? data[0]?.summary_text ?? '' : data?.summary_text ?? '';
                return { output: { summary, raw: data } };
            }

            case 'translation': {
                const model = String(inputs.model ?? 'Helsinki-NLP/opus-mt-en-fr').trim();
                const inputText = String(inputs.text ?? inputs.inputs ?? '').trim();
                if (!inputText) throw new Error('text is required.');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, { inputs: inputText });
                const translated = Array.isArray(data) ? data[0]?.translation_text ?? '' : data?.translation_text ?? '';
                return { output: { translatedText: translated, raw: data } };
            }

            case 'featureExtraction': {
                const model = String(inputs.model ?? 'sentence-transformers/all-MiniLM-L6-v2').trim();
                const inputText = inputs.text ?? inputs.inputs ?? '';
                if (!inputText) throw new Error('text is required.');
                const body: any = { inputs: inputText };
                if (inputs.pooling !== undefined) body.parameters = { pooling: String(inputs.pooling) };
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, body);
                return { output: { features: data, embedding: Array.isArray(data) ? data : [] } };
            }

            case 'imageClassification': {
                const model = String(inputs.model ?? 'google/vit-base-patch16-224').trim();
                const imageBase64 = String(inputs.imageBase64 ?? '').trim();
                if (!imageBase64) throw new Error('imageBase64 is required.');
                const buffer = Buffer.from(imageBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'image/jpeg' });
                const formData = new FormData();
                formData.append('file', blob, inputs.filename ?? 'image.jpg');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, formData, true);
                const result = Array.isArray(data) ? data : [];
                return { output: { classifications: result, label: result[0]?.label ?? '', score: result[0]?.score ?? 0 } };
            }

            case 'objectDetection': {
                const model = String(inputs.model ?? 'facebook/detr-resnet-50').trim();
                const imageBase64 = String(inputs.imageBase64 ?? '').trim();
                if (!imageBase64) throw new Error('imageBase64 is required.');
                const buffer = Buffer.from(imageBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'image/jpeg' });
                const formData = new FormData();
                formData.append('file', blob, inputs.filename ?? 'image.jpg');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, formData, true);
                return { output: { objects: data ?? [], total: Array.isArray(data) ? data.length : 0 } };
            }

            case 'imageSegmentation': {
                const model = String(inputs.model ?? 'facebook/detr-resnet-50-panoptic').trim();
                const imageBase64 = String(inputs.imageBase64 ?? '').trim();
                if (!imageBase64) throw new Error('imageBase64 is required.');
                const buffer = Buffer.from(imageBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'image/jpeg' });
                const formData = new FormData();
                formData.append('file', blob, inputs.filename ?? 'image.jpg');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, formData, true);
                return { output: { segments: data ?? [], raw: data } };
            }

            case 'textToImage': {
                const model = String(inputs.model ?? 'stabilityai/stable-diffusion-2-1').trim();
                const prompt = String(inputs.prompt ?? inputs.inputs ?? '').trim();
                if (!prompt) throw new Error('prompt is required.');
                const body: any = { inputs: prompt };
                const parameters: any = {};
                if (inputs.negativePrompt) parameters.negative_prompt = String(inputs.negativePrompt);
                if (inputs.width !== undefined) parameters.width = Number(inputs.width);
                if (inputs.height !== undefined) parameters.height = Number(inputs.height);
                if (inputs.numInferenceSteps !== undefined) parameters.num_inference_steps = Number(inputs.numInferenceSteps);
                if (inputs.guidanceScale !== undefined) parameters.guidance_scale = Number(inputs.guidanceScale);
                if (Object.keys(parameters).length) body.parameters = parameters;
                const res = await fetch(`${HF_BASE}/models/${encodeURIComponent(model)}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`HuggingFace text-to-image error: ${res.status} - ${errText}`);
                }
                const arrayBuffer = await res.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                return { output: { imageBase64: base64, mimeType: res.headers.get('content-type') ?? 'image/png' } };
            }

            case 'automaticSpeechRecognition': {
                const model = String(inputs.model ?? 'openai/whisper-large-v3').trim();
                const audioBase64 = String(inputs.audioBase64 ?? '').trim();
                if (!audioBase64) throw new Error('audioBase64 is required.');
                const buffer = Buffer.from(audioBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'audio/mp3' });
                const formData = new FormData();
                formData.append('file', blob, inputs.filename ?? 'audio.mp3');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, formData, true);
                return { output: { text: data.text ?? '', chunks: data.chunks ?? [] } };
            }

            case 'audioClassification': {
                const model = String(inputs.model ?? 'superb/hubert-large-superb-er').trim();
                const audioBase64 = String(inputs.audioBase64 ?? '').trim();
                if (!audioBase64) throw new Error('audioBase64 is required.');
                const buffer = Buffer.from(audioBase64, 'base64');
                const blob = new Blob([buffer], { type: inputs.mimeType ?? 'audio/mp3' });
                const formData = new FormData();
                formData.append('file', blob, inputs.filename ?? 'audio.mp3');
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, formData, true);
                return { output: { classifications: data ?? [], label: Array.isArray(data) ? data[0]?.label ?? '' : '' } };
            }

            case 'zeroShotClassification': {
                const model = String(inputs.model ?? 'facebook/bart-large-mnli').trim();
                const inputText = String(inputs.text ?? inputs.inputs ?? '').trim();
                const candidateLabels: string[] = inputs.candidateLabels ?? [];
                if (!inputText) throw new Error('text is required.');
                if (!candidateLabels.length) throw new Error('candidateLabels array is required.');
                const body: any = { inputs: inputText, parameters: { candidate_labels: candidateLabels } };
                if (inputs.multiLabel !== undefined) body.parameters.multi_label = Boolean(inputs.multiLabel);
                const data = await api('POST', `/models/${encodeURIComponent(model)}`, body);
                return { output: { sequence: data.sequence ?? '', labels: data.labels ?? [], scores: data.scores ?? [], topLabel: data.labels?.[0] ?? '' } };
            }

            default:
                throw new Error(`Unknown HuggingFace Enhanced action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[HuggingFaceEnhanced] Error in action "${actionName}": ${err.message}`);
        return { error: err.message ?? 'Unknown HuggingFace Enhanced error' };
    }
}
