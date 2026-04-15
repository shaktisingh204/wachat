'use server';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

async function elGet(apiKey: string, path: string, logger: any) {
    logger.log(`[ElevenLabs] GET ${path}`);
    const res = await fetch(`${ELEVENLABS_BASE}${path}`, {
        method: 'GET',
        headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail?.message || data?.detail || `ElevenLabs API error: ${res.status}`);
    }
    return res.json();
}

async function elPost(apiKey: string, path: string, body: any, logger: any, extraHeaders: Record<string, string> = {}) {
    logger.log(`[ElevenLabs] POST ${path}`);
    const res = await fetch(`${ELEVENLABS_BASE}${path}`, {
        method: 'POST',
        headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            ...extraHeaders,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail?.message || data?.detail || `ElevenLabs API error: ${res.status}`);
    }
    return res.json();
}

async function elDelete(apiKey: string, path: string, logger: any) {
    logger.log(`[ElevenLabs] DELETE ${path}`);
    const res = await fetch(`${ELEVENLABS_BASE}${path}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail?.message || data?.detail || `ElevenLabs API error: ${res.status}`);
    }
    return res.json().catch(() => ({ success: true }));
}

export async function executeElevenLabsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        if (!apiKey) throw new Error('ElevenLabs apiKey is required');

        switch (actionName) {
            case 'listVoices': {
                const data = await elGet(apiKey, '/voices', logger);
                return { output: { voices: data.voices } };
            }
            case 'getVoice': {
                const voiceId: string = inputs.voiceId;
                if (!voiceId) throw new Error('voiceId is required');
                const data = await elGet(apiKey, `/voices/${voiceId}`, logger);
                return { output: data };
            }
            case 'addVoice': {
                // ElevenLabs addVoice requires multipart/form-data — simulate via JSON body approach
                const { name, description, labels } = inputs;
                if (!name) throw new Error('name is required');
                // For server-side usage we pass a JSON-based body; actual file upload
                // needs FormData from the caller. Here we construct the request body.
                const body: any = { name };
                if (description) body.description = description;
                if (labels) body.labels = labels;
                const data = await elPost(apiKey, '/voices/add', body, logger);
                return { output: data };
            }
            case 'editVoice': {
                const { voiceId, name, description, labels } = inputs;
                if (!voiceId) throw new Error('voiceId is required');
                const body: any = {};
                if (name) body.name = name;
                if (description) body.description = description;
                if (labels) body.labels = labels;
                const data = await elPost(apiKey, `/voices/${voiceId}/edit`, body, logger);
                return { output: data };
            }
            case 'deleteVoice': {
                const { voiceId } = inputs;
                if (!voiceId) throw new Error('voiceId is required');
                const data = await elDelete(apiKey, `/voices/${voiceId}`, logger);
                return { output: data };
            }
            case 'textToSpeech': {
                const { voiceId, text, modelId, voiceSettings } = inputs;
                if (!voiceId || !text) throw new Error('voiceId and text are required');
                const body: any = { text };
                if (modelId) body.model_id = modelId;
                if (voiceSettings) body.voice_settings = voiceSettings;
                const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.detail?.message || `ElevenLabs TTS error: ${res.status}`);
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { audioBase64: base64, mimeType: 'audio/mpeg' } };
            }
            case 'textToSpeechStream': {
                const { voiceId, text, modelId, voiceSettings } = inputs;
                if (!voiceId || !text) throw new Error('voiceId and text are required');
                const body: any = { text };
                if (modelId) body.model_id = modelId;
                if (voiceSettings) body.voice_settings = voiceSettings;
                const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}/stream`, {
                    method: 'POST',
                    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.detail?.message || `ElevenLabs TTS stream error: ${res.status}`);
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { audioBase64: base64, mimeType: 'audio/mpeg', streaming: true } };
            }
            case 'getModels': {
                const data = await elGet(apiKey, '/models', logger);
                return { output: { models: data } };
            }
            case 'listHistory': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.startAfterHistoryItemId) params.set('start_after_history_item_id', inputs.startAfterHistoryItemId);
                const qs = params.toString() ? `?${params}` : '';
                const data = await elGet(apiKey, `/history${qs}`, logger);
                return { output: data };
            }
            case 'getHistoryItem': {
                const { historyItemId } = inputs;
                if (!historyItemId) throw new Error('historyItemId is required');
                const data = await elGet(apiKey, `/history/${historyItemId}`, logger);
                return { output: data };
            }
            case 'downloadHistoryItem': {
                const { historyItemId } = inputs;
                if (!historyItemId) throw new Error('historyItemId is required');
                const res = await fetch(`${ELEVENLABS_BASE}/history/${historyItemId}/audio`, {
                    method: 'GET',
                    headers: { 'xi-api-key': apiKey },
                });
                if (!res.ok) throw new Error(`ElevenLabs download error: ${res.status}`);
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { audioBase64: base64, mimeType: 'audio/mpeg' } };
            }
            case 'deleteHistoryItem': {
                const { historyItemId } = inputs;
                if (!historyItemId) throw new Error('historyItemId is required');
                const data = await elDelete(apiKey, `/history/${historyItemId}`, logger);
                return { output: data };
            }
            case 'getUserInfo': {
                const data = await elGet(apiKey, '/user', logger);
                return { output: data };
            }
            case 'getSubscription': {
                const data = await elGet(apiKey, '/user/subscription', logger);
                return { output: data };
            }
            case 'getSpeechToSpeech': {
                const { voiceId, audioBase64, modelId, voiceSettings } = inputs;
                if (!voiceId || !audioBase64) throw new Error('voiceId and audioBase64 are required');
                const body: any = { audio: audioBase64 };
                if (modelId) body.model_id = modelId;
                if (voiceSettings) body.voice_settings = voiceSettings;
                const res = await fetch(`${ELEVENLABS_BASE}/speech-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.detail?.message || `ElevenLabs STS error: ${res.status}`);
                }
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { output: { audioBase64: base64, mimeType: 'audio/mpeg' } };
            }
            default:
                return { error: `ElevenLabs action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`[ElevenLabs] Error: ${err.message}`);
        return { error: err.message };
    }
}
