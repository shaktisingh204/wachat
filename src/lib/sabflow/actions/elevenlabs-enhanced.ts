'use server';

export async function executeElevenLabsEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const baseUrl = 'https://api.elevenlabs.io/v1';
        const headers: Record<string, string> = {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'textToSpeech': {
                const voiceId = inputs.voiceId || '21m00Tcm4TlvDq8ikWAM';
                const body: any = {
                    text: inputs.text || '',
                    model_id: inputs.modelId || 'eleven_multilingual_v2',
                };
                if (inputs.voiceSettings) body.voice_settings = inputs.voiceSettings;
                else body.voice_settings = { stability: inputs.stability ?? 0.5, similarity_boost: inputs.similarityBoost ?? 0.75 };
                const res = await fetch(`${baseUrl}/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.detail?.message || data.message || 'textToSpeech failed' };
                }
                const arrayBuffer = await res.arrayBuffer();
                const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                return { output: { audioBase64, contentType: 'audio/mpeg', voiceId } };
            }

            case 'streamTextToSpeech': {
                const voiceId = inputs.voiceId || '21m00Tcm4TlvDq8ikWAM';
                const body: any = {
                    text: inputs.text || '',
                    model_id: inputs.modelId || 'eleven_multilingual_v2',
                    voice_settings: inputs.voiceSettings || { stability: 0.5, similarity_boost: 0.75 },
                };
                const res = await fetch(`${baseUrl}/text-to-speech/${voiceId}/stream`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.detail?.message || data.message || 'streamTextToSpeech failed' };
                }
                const arrayBuffer = await res.arrayBuffer();
                const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                return { output: { audioBase64, contentType: 'audio/mpeg', voiceId } };
            }

            case 'getVoices': {
                const res = await fetch(`${baseUrl}/voices`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'getVoices failed' };
                return { output: data };
            }

            case 'getVoice': {
                const voiceId = inputs.voiceId || inputs.id;
                const res = await fetch(`${baseUrl}/voices/${voiceId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'getVoice failed' };
                return { output: data };
            }

            case 'addVoice': {
                const formData = new FormData();
                formData.append('name', inputs.name || 'New Voice');
                if (inputs.description) formData.append('description', inputs.description);
                if (inputs.labels) formData.append('labels', JSON.stringify(inputs.labels));
                if (inputs.fileBase64) {
                    const buf = Buffer.from(inputs.fileBase64, 'base64');
                    formData.append('files', new Blob([buf], { type: inputs.fileType || 'audio/mpeg' }), inputs.fileName || 'sample.mp3');
                }
                const addHeaders = { 'xi-api-key': apiKey };
                const res = await fetch(`${baseUrl}/voices/add`, {
                    method: 'POST',
                    headers: addHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'addVoice failed' };
                return { output: data };
            }

            case 'editVoice': {
                const voiceId = inputs.voiceId || inputs.id;
                const formData = new FormData();
                if (inputs.name) formData.append('name', inputs.name);
                if (inputs.description) formData.append('description', inputs.description);
                if (inputs.labels) formData.append('labels', JSON.stringify(inputs.labels));
                const editHeaders = { 'xi-api-key': apiKey };
                const res = await fetch(`${baseUrl}/voices/${voiceId}/edit`, {
                    method: 'POST',
                    headers: editHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'editVoice failed' };
                return { output: data };
            }

            case 'deleteVoice': {
                const voiceId = inputs.voiceId || inputs.id;
                const res = await fetch(`${baseUrl}/voices/${voiceId}`, { method: 'DELETE', headers });
                if (res.status === 200) return { output: { deleted: true, voiceId } };
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'deleteVoice failed' };
                return { output: data };
            }

            case 'cloneVoice': {
                const formData = new FormData();
                formData.append('name', inputs.name || 'Cloned Voice');
                if (inputs.description) formData.append('description', inputs.description);
                const files: string[] = Array.isArray(inputs.filesBase64) ? inputs.filesBase64 : [inputs.fileBase64].filter(Boolean);
                files.forEach((fileB64: string, i: number) => {
                    const buf = Buffer.from(fileB64, 'base64');
                    formData.append('files', new Blob([buf], { type: 'audio/mpeg' }), `sample_${i}.mp3`);
                });
                if (inputs.labels) formData.append('labels', JSON.stringify(inputs.labels));
                const cloneHeaders = { 'xi-api-key': apiKey };
                const res = await fetch(`${baseUrl}/voices/add`, {
                    method: 'POST',
                    headers: cloneHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'cloneVoice failed' };
                return { output: data };
            }

            case 'listModels': {
                const res = await fetch(`${baseUrl}/models`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'listModels failed' };
                return { output: { models: data } };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/user`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'getUser failed' };
                return { output: data };
            }

            case 'getUserSubscription': {
                const res = await fetch(`${baseUrl}/user/subscription`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'getUserSubscription failed' };
                return { output: data };
            }

            case 'addVoiceFromURL': {
                const body: any = {
                    url: inputs.url,
                    name: inputs.name || 'Voice from URL',
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.labels) body.labels = inputs.labels;
                const res = await fetch(`${baseUrl}/voices/add-sharing-link`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'addVoiceFromURL failed' };
                return { output: data };
            }

            case 'speechToText': {
                const formData = new FormData();
                if (inputs.audioBase64) {
                    const buf = Buffer.from(inputs.audioBase64, 'base64');
                    formData.append('audio', new Blob([buf], { type: inputs.audioType || 'audio/mpeg' }), inputs.audioFileName || 'audio.mp3');
                }
                if (inputs.modelId) formData.append('model_id', inputs.modelId);
                if (inputs.languageCode) formData.append('language_code', inputs.languageCode);
                const sttHeaders = { 'xi-api-key': apiKey };
                const res = await fetch(`${baseUrl}/speech-to-text`, {
                    method: 'POST',
                    headers: sttHeaders,
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'speechToText failed' };
                return { output: data };
            }

            case 'soundGeneration': {
                const body: any = {
                    text: inputs.text || inputs.prompt || '',
                };
                if (inputs.durationSeconds !== undefined) body.duration_seconds = inputs.durationSeconds;
                if (inputs.promptInfluence !== undefined) body.prompt_influence = inputs.promptInfluence;
                const res = await fetch(`${baseUrl}/sound-generation`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.detail?.message || data.message || 'soundGeneration failed' };
                }
                const arrayBuffer = await res.arrayBuffer();
                const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                return { output: { audioBase64, contentType: 'audio/mpeg' } };
            }

            case 'listProjects': {
                const res = await fetch(`${baseUrl}/projects`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail?.message || data.message || 'listProjects failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown ElevenLabs Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeElevenLabsEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeElevenLabsEnhancedAction' };
    }
}
