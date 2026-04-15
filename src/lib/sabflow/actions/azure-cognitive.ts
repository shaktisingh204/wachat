'use server';

export async function executeAzureCognitiveAction(actionName: string, inputs: any, user: any, logger: any) {
    const subscriptionKey = inputs.subscriptionKey;
    const endpoint = inputs.endpoint?.replace(/\/$/, '');

    function cogHeaders(extra: Record<string, string> = {}): Record<string, string> {
        return {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'application/json',
            ...extra,
        };
    }

    try {
        switch (actionName) {
            case 'analyzeText': {
                const url = `${endpoint}/text/analytics/v3.1/analyze`;
                const body = {
                    analysisInput: { documents: inputs.documents || [] },
                    tasks: inputs.tasks || {},
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, result: data } };
            }

            case 'detectSentiment': {
                const url = `${endpoint}/text/analytics/v3.1/sentiment`;
                const body = { documents: inputs.documents || [] };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, sentiment: data } };
            }

            case 'extractKeyPhrases': {
                const url = `${endpoint}/text/analytics/v3.1/keyPhrases`;
                const body = { documents: inputs.documents || [] };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, keyPhrases: data } };
            }

            case 'recognizeEntities': {
                const url = `${endpoint}/text/analytics/v3.1/entities/recognition/general`;
                const body = { documents: inputs.documents || [] };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, entities: data } };
            }

            case 'translateText': {
                const translatorEndpoint = inputs.translatorEndpoint || 'https://api.cognitive.microsofttranslator.com';
                const toLanguages: string[] = inputs.toLanguages || ['en'];
                const from = inputs.fromLanguage ? `&from=${inputs.fromLanguage}` : '';
                const toParam = toLanguages.map((l: string) => `to=${l}`).join('&');
                const url = `${translatorEndpoint}/translate?api-version=3.0&${toParam}${from}`;
                const body = inputs.texts?.map((t: string) => ({ Text: t })) || [{ Text: inputs.text || '' }];
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, translations: data } };
            }

            case 'detectLanguage': {
                const url = `${endpoint}/text/analytics/v3.1/languages`;
                const body = { documents: inputs.documents || [] };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, languages: data } };
            }

            case 'detectObjects': {
                const url = `${endpoint}/vision/v3.2/detect`;
                const body = { url: inputs.imageUrl };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, objects: data } };
            }

            case 'analyzeImage': {
                const features = (inputs.features || ['Tags', 'Description']).join(',');
                const url = `${endpoint}/vision/v3.2/analyze?visualFeatures=${features}`;
                const body = { url: inputs.imageUrl };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, analysis: data } };
            }

            case 'generateCaption': {
                const url = `${endpoint}/vision/v3.2/describe`;
                const body = { url: inputs.imageUrl };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, description: data } };
            }

            case 'readOCR': {
                const url = `${endpoint}/vision/v3.2/ocr`;
                const body = { url: inputs.imageUrl };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, ocr: data } };
            }

            case 'detectFaces': {
                const url = `${endpoint}/face/v1.0/detect?returnFaceAttributes=${inputs.attributes || 'age,gender'}`;
                const body = { url: inputs.imageUrl };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, faces: data } };
            }

            case 'verifySpeaker': {
                const url = `${endpoint}/speaker/verification/v2.0/text-dependent/profiles/${inputs.profileId}/verify`;
                const formData = inputs.audioData;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Ocp-Apim-Subscription-Key': subscriptionKey, 'Content-Type': 'audio/wav' },
                    body: formData,
                });
                const data = await res.json();
                return { output: { status: res.status, verification: data } };
            }

            case 'transcribeAudio': {
                const url = `${endpoint}/speechtotext/v3.1/transcriptions`;
                const body = {
                    contentUrls: inputs.audioUrls || [],
                    locale: inputs.locale || 'en-US',
                    displayName: inputs.displayName || 'Transcription',
                    properties: inputs.properties || {},
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: cogHeaders(),
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: { status: res.status, transcription: data } };
            }

            case 'synthesizeSpeech': {
                const region = inputs.region || 'eastus';
                const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
                const voice = inputs.voice || 'en-US-JennyNeural';
                const ssml = inputs.ssml || `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}">${inputs.text || ''}</voice></speak>`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Ocp-Apim-Subscription-Key': subscriptionKey,
                        'Content-Type': 'application/ssml+xml',
                        'X-Microsoft-OutputFormat': inputs.outputFormat || 'riff-24khz-16bit-mono-pcm',
                    },
                    body: ssml,
                });
                const buffer = await res.arrayBuffer();
                const base64Audio = Buffer.from(buffer).toString('base64');
                return { output: { status: res.status, audio: base64Audio, contentType: 'audio/wav' } };
            }

            case 'moderateContent': {
                const url = `${endpoint}/contentmoderator/moderate/v1.0/ProcessText/Screen`;
                const body = inputs.text || '';
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Ocp-Apim-Subscription-Key': subscriptionKey, 'Content-Type': 'text/plain' },
                    body,
                });
                const data = await res.json();
                return { output: { status: res.status, moderation: data } };
            }

            default:
                return { error: `Unknown Azure Cognitive action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Azure Cognitive action error: ${err.message}`);
        return { error: err.message || 'Azure Cognitive action failed' };
    }
}
